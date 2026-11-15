const test = require('node:test'); const assert = require('node:assert');
const fs = require('node:fs'); const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { makeRepo } = require('./helpers.cjs');
const sync = require('../plugins/ai-rules/scripts/sync.cjs');
const PAYLOAD = path.resolve('plugins/ai-rules/payload');
const check = (dir, env = {}) => spawnSync('node', ['plugins/ai-rules/scripts/sync-check.cjs'], {
  input: JSON.stringify({ session_id: 's', cwd: dir, hook_event_name: 'SessionStart' }), encoding: 'utf8',
  env: { ...process.env, CLAUDE_PROJECT_DIR: dir, CLAUDE_CODE_REMOTE: '', ...env } });

test('sync-check stays silent outside ai-rules repos and when up to date', () => {
  assert.equal(check(makeRepo({})).stdout, '');
  const t = makeRepo({}); sync.syncRepo({ payloadDir: PAYLOAD, targetDir: t, init: true });
  assert.equal(check(t).stdout, '');
});
test('sync-check announces an update in one line, but not in cloud sessions', () => {
  const t = makeRepo({}); sync.syncRepo({ payloadDir: PAYLOAD, targetDir: t, init: true });
  const mf = path.join(t, '.claude/ai-rules/manifest.json');
  fs.writeFileSync(mf, JSON.stringify({ ...JSON.parse(fs.readFileSync(mf, 'utf8')), sourceVersion: '000000000000' }));
  const out = check(t).stdout.trim();
  assert.match(out, /^ai-rules: an update is available \(000000000000 -> [0-9a-f]{12}\)\./);
  assert.equal(out.split('\n').length, 1);
  assert.equal(check(t, { CLAUDE_CODE_REMOTE: 'true' }).stdout, '');
  const fresh = makeRepo({ '.claude/ai-rules.json': '{}' });
  assert.match(check(fresh).stdout, /\(none -> /);
});
test('sync-check fails open', () => {
  const r = spawnSync('node', ['plugins/ai-rules/scripts/sync-check.cjs'], { input: 'garbage', encoding: 'utf8' });
  assert.equal(r.status, 0);
});
test('plugin hooks.json and skills', () => {
  const h = JSON.parse(fs.readFileSync('plugins/ai-rules/hooks/hooks.json', 'utf8'));
  assert.equal(h.hooks.SessionStart[0].hooks[0].args[0], '${CLAUDE_PLUGIN_ROOT}/scripts/sync-check.cjs');
  for (const [name, flag] of [['init-repo', '--init --target .'], ['sync-repo', '--target .']]) {
    const s = fs.readFileSync(`plugins/ai-rules/skills/${name}/SKILL.md`, 'utf8');
    assert.match(s, new RegExp(`^---\\nname: ${name}\\ndescription: Use when `));
    assert.ok(s.includes('node "${CLAUDE_PLUGIN_ROOT}/scripts/sync.cjs" ' + flag), name);
  }
});
