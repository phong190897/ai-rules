'use strict';
// Quick, cheap scan of a repository root: stack, check commands and things that matter for setup.
// It only reads a few fixed files and calls git; it never walks the source tree.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const exists = (p) => fs.existsSync(p);
const FRONTEND = ['react', 'vue', 'svelte', 'next', 'nuxt', '@angular/core', 'solid-js', 'astro'];
const BACKEND = ['express', 'fastify', '@nestjs/core', 'koa', 'hono'];
const ENV_FILE = /^\.env(\..+)?$/;
const ENV_SAFE = /\.(example|sample|template)$/;

function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'ignore'] });
}

function readPackage(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')) || {};
  } catch {
    return {};
  }
}

function detectStack(dir) {
  const has = (f) => exists(path.join(dir, f));
  let files = [];
  try { files = fs.readdirSync(dir); } catch { /* unreadable */ }
  const stack = [];
  if (has('package.json')) stack.push('node');
  if (has('pyproject.toml') || has('requirements.txt')) stack.push('python');
  if (has('go.mod')) stack.push('go');
  if (has('Cargo.toml')) stack.push('rust');
  if (has('pom.xml') || has('build.gradle') || has('build.gradle.kts')) stack.push('java');
  if (files.some((f) => /\.(csproj|sln)$/.test(f))) stack.push('dotnet');
  if (has('composer.json')) stack.push('php');
  if (has('Gemfile')) stack.push('ruby');
  return stack;
}

function detectPackageManager(dir, stack) {
  const has = (f) => exists(path.join(dir, f));
  if (has('pnpm-lock.yaml')) return 'pnpm';
  if (has('yarn.lock')) return 'yarn';
  if (has('bun.lockb') || has('bun.lock')) return 'bun';
  return stack.includes('node') ? 'npm' : null;
}

function detectCommands(pkg, pm, framework) {
  const commands = { e2e: [], test: [], build: [], lint: [] };
  if (!pm) return commands;
  const scripts = pkg.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};
  const test = scripts.test;
  if (typeof test === 'string' && !test.includes('no test specified')) {
    commands.test.push(pm === 'bun' ? 'bun run test' : `${pm} test`);
  }
  for (const name of ['build', 'lint']) if (scripts[name]) commands[name].push(`${pm} run ${name}`);
  for (const name of Object.keys(scripts)) if (name.includes('e2e')) commands.e2e.push(`${pm} run ${name}`);
  if (!commands.e2e.length && framework) {
    commands.e2e.push(framework === 'playwright' ? 'npx playwright test' : 'npx cypress run');
  }
  return commands;
}

function scanRepo(dir) {
  const has = (f) => exists(path.join(dir, f));
  const isGitRoot = has('.git');
  const stack = detectStack(dir);
  const packageManager = detectPackageManager(dir, stack);
  const pkg = readPackage(dir);
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const hasDep = (names) => names.some((n) => n in deps);

  let e2eFramework = null;
  if (hasDep(['@playwright/test', 'playwright'])) e2eFramework = 'playwright';
  else if ('cypress' in deps) e2eFramework = 'cypress';

  let claudeMdLines = null;
  if (has('CLAUDE.md')) {
    const text = fs.readFileSync(path.join(dir, 'CLAUDE.md'), 'utf8');
    claudeMdLines = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  }

  let gitHooks = null;
  if (has('.husky')) gitHooks = 'husky';
  else if (isGitRoot) {
    try { if (git(dir, ['config', 'core.hooksPath']).trim()) gitHooks = 'hooksPath'; } catch { /* unset */ }
  }

  let trackedEnvFiles = [];
  if (isGitRoot) {
    try {
      trackedEnvFiles = git(dir, ['ls-files']).split('\n').map((l) => l.trim()).filter(Boolean)
        .filter((f) => ENV_FILE.test(path.basename(f)) && !ENV_SAFE.test(f));
    } catch { /* not readable */ }
  }

  const suggestedSkills = [];
  if (hasDep(FRONTEND)) suggestedSkills.push('frontend-design');
  if (hasDep(BACKEND) || stack.some((s) => s !== 'node')) suggestedSkills.push('ai-rules-backend-basics');

  return {
    isGitRoot, stack, packageManager,
    commands: detectCommands(pkg, packageManager, e2eFramework),
    e2eFramework,
    existing: { claudeMdLines, agentsMd: has('AGENTS.md'), settings: has('.claude/settings.json'), gitHooks },
    trackedEnvFiles, suggestedSkills,
  };
}

function formatReport(report) {
  const lines = [];
  const stack = report.stack.length
    ? report.stack.map((s) => (s === 'node' && report.packageManager ? `node (${report.packageManager})` : s)).join(', ')
    : 'unknown';
  lines.push(`Stack: ${stack}${report.e2eFramework ? `, e2e: ${report.e2eFramework}` : ''}`);
  const cmds = ['test', 'build', 'lint', 'e2e']
    .filter((k) => report.commands[k].length)
    .map((k) => `${k} ${report.commands[k].map((c) => `"${c}"`).join(', ')}`);
  if (cmds.length) lines.push(`Commands: ${cmds.join('; ')}`);
  const e = report.existing;
  if (e.claudeMdLines !== null) lines.push(`Existing CLAUDE.md (${e.claudeMdLines} lines): will be kept as is`);
  if (e.gitHooks) lines.push(`Existing git hooks (${e.gitHooks}): the commit message check will not be installed`);
  if (report.trackedEnvFiles.length) {
    lines.push(`Tracked env files: ${report.trackedEnvFiles.join(', ')} — suggest removing them from git`);
  }
  if (report.suggestedSkills.length) lines.push(`Suggested skills: ${report.suggestedSkills.join(', ')}`);
  return lines;
}

function normalizeRepoPath(p) {
  let s = String(p).replace(/\\/g, '/');
  if (!/^([A-Za-z]:)?\//.test(s)) s = path.resolve(p).replace(/\\/g, '/');
  return s.replace(/\/+$/, '').toLowerCase();
}

function offeredFile(dataDir) {
  return path.join(dataDir, 'offered.json');
}

function readOffered(dataDir) {
  try {
    const v = JSON.parse(fs.readFileSync(offeredFile(dataDir), 'utf8'));
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function wasOffered(dataDir, repoDir) {
  return readOffered(dataDir).includes(normalizeRepoPath(repoDir));
}

function markOffered(dataDir, repoDir) {
  const list = readOffered(dataDir);
  const key = normalizeRepoPath(repoDir);
  if (!list.includes(key)) list.push(key);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(offeredFile(dataDir), JSON.stringify(list));
}

// Lives under the home directory, not the temp folder, so "already offered" is not forgotten by temp cleanup.
function defaultDataDir() {
  return process.env.CLAUDE_PLUGIN_DATA || path.join(os.homedir(), '.claude', 'ai-rules-data');
}

// The setup offer for a repository, or '' when there is nothing to say. The cheap checks come first, so a repo that
// is not a git root, or was offered before, never pays for a scan. Records the offer when it returns text.
function offerText(dir, dataDir, scanFn = scanRepo) {
  if (!exists(path.join(dir, '.git')) || wasOffered(dataDir, dir)) return '';
  const report = scanFn(dir);
  if (!report.isGitRoot) return '';
  markOffered(dataDir, dir);
  const lines = formatReport(report).map((l) => `- ${l}`);
  return ['ai-rules: this repository is not set up with ai-rules. Quick scan:', ...lines,
    'Ask the user once, in their language, whether to set it up. If they agree, use the ai-rules:init-repo skill. '
    + 'If they decline, do not ask again.', ''].join('\n');
}

if (require.main === module) {
  const i = process.argv.indexOf('--target');
  const dir = path.resolve(i === -1 ? process.cwd() : process.argv[i + 1]);
  process.stdout.write(`${JSON.stringify(scanRepo(dir), null, 2)}\n`);
}

module.exports = { scanRepo, formatReport, wasOffered, markOffered, defaultDataDir, offerText };
