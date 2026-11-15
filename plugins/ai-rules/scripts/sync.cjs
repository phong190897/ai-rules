'use strict';
// Copies the managed ai-rules payload into a repository and keeps it up to date.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { scanRepo } = require('./scan.cjs');

const MARK = '<!-- Managed by ai-rules. Do not edit; overwritten on sync. -->';
const MANAGED_DIRS = { rules: '.claude/rules', skills: '.claude/skills', 'ai-rules': '.claude/ai-rules' };
const STARTER = {
  'CLAUDE.md': 'CLAUDE.md',
  'ai-rules.json': '.claude/ai-rules.json',
  'settings.json': '.claude/settings.json',
  'known-issues.md': '.claude/known-issues.md',
  'ai-rules-sync.yml': '.github/workflows/ai-rules-sync.yml',
};
const SETTINGS = '.claude/settings.json';
const MANIFEST = '.claude/ai-rules/manifest.json';
const SCRIPTS_MARK = '.claude/ai-rules/scripts/';

const lf = (s) => String(s).replace(/\r\n/g, '\n');
const readText = (p) => lf(fs.readFileSync(p, 'utf8'));
const exists = (p) => fs.existsSync(p);

function walk(dir) {
  if (!exists(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
}

function frontmatterDescription(text) {
  const m = /^---\n([\s\S]*?)\n---/.exec(lf(text));
  const d = m && /^description:\s*(.*)$/m.exec(m[1]);
  return d ? d[1].trim() : '';
}

function generateAgentsMd(payloadDir) {
  const corePath = path.join(payloadDir, 'managed', 'rules', 'ai-rules-core.md');
  let rules = '';
  if (exists(corePath)) {
    const all = readText(corePath).split('\n');
    const start = all.findIndex((l) => l.trim() === '# Core rules');
    const rest = all.slice(start + 1);
    const end = rest.findIndex((l) => l.trim() === '## Claude Code only');
    rules = (end === -1 ? rest : rest.slice(0, end)).join('\n').trim();
  }
  const skillsDir = path.join(payloadDir, 'managed', 'skills');
  const rows = exists(skillsDir)
    ? fs.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort()
      .map((name) => {
        const f = path.join(skillsDir, name, 'SKILL.md');
        const desc = exists(f) ? frontmatterDescription(readText(f)) : '';
        return `| ${desc} | \`.claude/skills/${name}/SKILL.md\` |`;
      })
    : [];
  return [
    MARK, '# Agent instructions', '', 'Project description: read `CLAUDE.md`.', '',
    '## Core rules', '', rules, '',
    '## Task guides', '', 'Read the matching file before doing the task.', '',
    '| When | Read |', '|---|---|', ...rows, '',
  ].join('\n');
}

// Map of target path (forward slashes) -> content for every managed file, including the generated AGENTS.md.
function planManagedFiles(payloadDir) {
  const root = path.join(payloadDir, 'managed');
  const plan = new Map();
  for (const file of walk(root)) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    const [top, ...rest] = rel.split('/');
    if (MANAGED_DIRS[top] && rest.length) plan.set(`${MANAGED_DIRS[top]}/${rest.join('/')}`, readText(file));
  }
  plan.set('AGENTS.md', generateAgentsMd(payloadDir));
  return new Map([...plan.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

function readFragment(payloadDir) {
  const f = path.join(payloadDir, 'settings-fragment.json');
  return exists(f) ? JSON.parse(readText(f)) : {};
}

function computeSourceVersion(payloadDir) {
  const entries = [...planManagedFiles(payloadDir).entries()];
  const f = path.join(payloadDir, 'settings-fragment.json');
  entries.push(['#settings-fragment', exists(f) ? readText(f) : '']);
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const hash = crypto.createHash('sha256');
  for (const [p, c] of entries) hash.update(`${p}\0${c}\0`);
  return hash.digest('hex').slice(0, 12);
}

function readManifest(targetDir) {
  try {
    const m = JSON.parse(fs.readFileSync(path.join(targetDir, MANIFEST), 'utf8'));
    return {
      sourceVersion: String(m.sourceVersion || ''),
      files: Array.isArray(m.files) ? m.files : [],
      managedDeny: Array.isArray(m.managedDeny) ? m.managedDeny : [],
    };
  } catch {
    return null;
  }
}

const isManagedHandler = (h) => (h.args || []).some((a) => String(a).includes(SCRIPTS_MARK))
  || String(h.command || '').includes(SCRIPTS_MARK);

function mergeSettings(existing, fragment, prevManagedDeny) {
  const out = JSON.parse(JSON.stringify(existing || {}));
  const fragHooks = (fragment && fragment.hooks) || {};
  if (Object.keys(fragHooks).length) {
    out.hooks = out.hooks || {};
    for (const [event, groups] of Object.entries(fragHooks)) {
      const kept = (out.hooks[event] || []).filter((g) => !(g.hooks || []).some(isManagedHandler));
      out.hooks[event] = kept.concat(JSON.parse(JSON.stringify(groups)));
    }
  }
  const fragDeny = (fragment && fragment.permissions && fragment.permissions.deny) || [];
  if (fragDeny.length || (prevManagedDeny || []).length) {
    out.permissions = out.permissions || {};
    const prev = new Set(prevManagedDeny || []);
    const kept = (out.permissions.deny || []).filter((r) => !prev.has(r));
    out.permissions.deny = kept.concat(fragDeny.filter((r) => !kept.includes(r)));
  }
  return out;
}

function writeIfChanged(file, content) {
  if (exists(file) && readText(file) === content) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}

function removeEmptyDirs(dir, stop) {
  let d = dir;
  while (d.startsWith(stop) && d !== stop && exists(d) && fs.readdirSync(d).length === 0) {
    fs.rmdirSync(d);
    d = path.dirname(d);
  }
}

// Fills verify.commands in a freshly created config from what the scan found.
function withScannedCommands(configText, scan) {
  const commands = {};
  for (const [kind, list] of Object.entries(scan.commands)) if (list.length) commands[kind] = list;
  if (!Object.keys(commands).length) return configText;
  const config = JSON.parse(configText);
  config.verify = { ...(config.verify || {}), commands };
  return `${JSON.stringify(config, null, 2)}\n`;
}

function syncRepo({ payloadDir, targetDir, init = false }) {
  const target = path.resolve(targetDir);
  const written = [];
  const removed = [];
  const skipped = [];
  const prev = readManifest(target);
  const plan = planManagedFiles(payloadDir);
  const sourceVersion = computeSourceVersion(payloadDir);

  const scan = init ? scanRepo(target) : undefined;
  if (init) {
    for (const [src, dest] of Object.entries(STARTER)) {
      const from = path.join(payloadDir, 'starter', src);
      if (!exists(from)) continue;
      const to = path.join(target, dest);
      if (exists(to)) { skipped.push({ path: dest, reason: 'exists' }); continue; }
      let content = readText(from);
      if (dest === '.claude/ai-rules.json') content = withScannedCommands(content, scan);
      writeIfChanged(to, content);
      written.push(dest);
    }
  }

  const managedFiles = [];
  for (const [rel, content] of plan) {
    const to = path.join(target, rel);
    if (rel === 'AGENTS.md' && exists(to) && !readText(to).includes('Managed by ai-rules')) {
      skipped.push({ path: rel, reason: 'foreign AGENTS.md' });
      continue;
    }
    managedFiles.push(rel);
    if (writeIfChanged(to, content)) written.push(rel);
  }

  if (prev) {
    for (const rel of prev.files) {
      if (managedFiles.includes(rel)) continue;
      const to = path.join(target, rel);
      if (exists(to)) {
        fs.rmSync(to);
        removed.push(rel);
        removeEmptyDirs(path.dirname(to), target);
      }
    }
  }

  const fragment = readFragment(payloadDir);
  const settingsFile = path.join(target, SETTINGS);
  if (!exists(settingsFile)) {
    writeIfChanged(settingsFile, `${JSON.stringify(mergeSettings({}, fragment, []), null, 2)}\n`);
  } else {
    let existing = null;
    try { existing = JSON.parse(readText(settingsFile)); } catch { /* invalid */ }
    if (existing === null || typeof existing !== 'object') {
      skipped.push({ path: SETTINGS, reason: 'invalid settings.json' });
    } else {
      const merged = mergeSettings(existing, fragment, prev ? prev.managedDeny : []);
      writeIfChanged(settingsFile, `${JSON.stringify(merged, null, 2)}\n`);
    }
  }

  const manifest = {
    sourceVersion,
    files: managedFiles.slice().sort(),
    managedDeny: (fragment.permissions && fragment.permissions.deny) || [],
  };
  writeIfChanged(path.join(target, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);

  return init ? { sourceVersion, written, removed, skipped, scan } : { sourceVersion, written, removed, skipped };
}

function main(argv) {
  const payloadDir = path.join(__dirname, '..', 'payload');
  const opt = (name) => { const i = argv.indexOf(name); return i === -1 ? undefined : argv[i + 1]; };
  const targetDir = path.resolve(opt('--target') || process.cwd());
  if (argv.includes('--check')) {
    const m = readManifest(targetDir);
    const latest = computeSourceVersion(payloadDir);
    const current = m ? m.sourceVersion : null;
    process.stdout.write(`${JSON.stringify({ current, latest, upToDate: current === latest })}\n`);
    return;
  }
  const result = syncRepo({ payloadDir, targetDir, init: argv.includes('--init') });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (require.main === module) main(process.argv.slice(2));

module.exports = {
  planManagedFiles, generateAgentsMd, computeSourceVersion, readManifest, mergeSettings, syncRepo,
};
