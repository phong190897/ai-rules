const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPTS = path.resolve(__dirname, '../plugins/ai-rules/payload/managed/ai-rules/scripts');

// Creates a temp directory holding the given files ({ 'relative/path': 'content' }).
function makeRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'air-'));
  for (const [rel, content] of Object.entries(files || {})) {
    const p = path.join(dir, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, content);
  }
  return dir;
}

// Runs a hook script (file name inside the managed scripts dir) with JSON on stdin.
function runHook(script, input, env = {}) {
  const stdin = typeof input === 'string' ? input : JSON.stringify(input);
  const merged = { ...process.env, ...env };
  if (!merged.AI_RULES_STATE_DIR) {
    merged.AI_RULES_STATE_DIR = path.join(env.CLAUDE_PROJECT_DIR || os.tmpdir(), '.ai-rules-state');
  }
  const r = spawnSync('node', [path.join(SCRIPTS, script)], { input: stdin, encoding: 'utf8', env: merged });
  let json = null;
  try { json = JSON.parse(r.stdout); } catch { /* not JSON */ }
  return { status: r.status, stdout: r.stdout, json };
}

// Lists every relative require() in the .cjs files under rootDir whose target lies outside rootDir.
function findEscapingRequires(rootDir) {
  const root = path.resolve(rootDir);
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.name.endsWith('.cjs')) continue;
      const text = fs.readFileSync(p, 'utf8');
      for (const m of text.matchAll(/require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g)) {
        const target = path.resolve(path.dirname(p), m[1]);
        if (target !== root && !target.startsWith(root + path.sep)) {
          out.push(`${path.relative(root, p).split(path.sep).join('/')}: ${m[1]}`);
        }
      }
    }
  };
  walk(root);
  return out.sort();
}

module.exports = { makeRepo, runHook, findEscapingRequires };
