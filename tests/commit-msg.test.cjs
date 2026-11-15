const test = require('node:test'); const assert = require('node:assert');
const fs = require('node:fs'); const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const { makeRepo, runHook } = require('./helpers.cjs');
const S = '../plugins/ai-rules/payload/managed/ai-rules/scripts';
const SCRIPT = path.resolve('plugins/ai-rules/payload/managed/ai-rules/scripts/git-commit-msg.cjs');
const { checkCommitMessage, shouldEnforce } = require(`${S}/git-commit-msg.cjs`);
const { installCommitMsgHook } = require(`${S}/lib/git-hook.cjs`);
const { mergeConfig } = require(`${S}/lib/config.cjs`);
const git = (dir, ...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
const gitRepo = () => { const d = makeRepo({}); git(d, 'init', '-q'); return d; };

test('checkCommitMessage', () => {
  for (const ok of ['feat(api): add login', 'fix: x\r\n\r\nbody text', '# comment\n\nfix: x',
    'Merge branch "a" into b', 'Revert "feat: x"', 'fixup! feat: x'])
    assert.equal(checkCommitMessage(ok), null, ok);
  for (const bad of ['Add login', 'feat: ' + 'a'.repeat(70), ''])
    assert.equal(typeof checkCommitMessage(bad), 'string', bad);
});
test('shouldEnforce', () => {
  const d = mergeConfig(null);
  assert.equal(shouldEnforce({ CLAUDECODE: '1' }, d), true);
  assert.equal(shouldEnforce({ CLAUDE_CODE_REMOTE: 'true' }, d), true);
  assert.equal(shouldEnforce({ AI_RULES_ENFORCE_COMMIT_MSG: '1' }, d), true);
  assert.equal(shouldEnforce({}, d), false);
  assert.equal(shouldEnforce({}, mergeConfig({ commitMsg: { scope: 'all' } })), true);
  assert.equal(shouldEnforce({ CLAUDECODE: '1' }, mergeConfig({ guards: { commitMsg: false } })), false);
});
test('CLI exits 1 only when enforced and invalid', () => {
  const d = makeRepo({ 'MSG': 'Add login\n' });
  const run = (extra) => spawnSync('node', [SCRIPT, path.join(d, 'MSG')],
    { cwd: d, encoding: 'utf8', env: { ...process.env, CLAUDECODE: '', CLAUDE_CODE_REMOTE: '', ...extra } });
  const enforced = run({ CLAUDECODE: '1' });
  assert.equal(enforced.status, 1); assert.match(enforced.stderr, /^ai-rules: /);
  assert.equal(run({}).status, 0);
  assert.equal(spawnSync('node', [SCRIPT, path.join(d, 'missing')], { cwd: d }).status, 0);
});
test('installCommitMsgHook', () => {
  const d = gitRepo(); const hook = path.join(d, '.git/hooks/commit-msg');
  assert.equal(installCommitMsgHook(d), 'installed');
  assert.match(fs.readFileSync(hook, 'utf8'), /# ai-rules commit-msg/);
  assert.equal(installCommitMsgHook(d), 'present');
  const foreign = gitRepo(); const fh = path.join(foreign, '.git/hooks/commit-msg');
  fs.mkdirSync(path.dirname(fh), { recursive: true }); fs.writeFileSync(fh, '#!/bin/sh\nexit 0\n');
  assert.equal(installCommitMsgHook(foreign), 'skipped-foreign');
  assert.equal(fs.readFileSync(fh, 'utf8'), '#!/bin/sh\nexit 0\n');
  const husky = gitRepo(); git(husky, 'config', 'core.hooksPath', '.husky');
  assert.equal(installCommitMsgHook(husky), 'skipped-hookspath');
  assert.equal(installCommitMsgHook(makeRepo({})), 'no-git');
});
test('session start prints the cloud notice only in cloud sessions', () => {
  const d = gitRepo(); const input = { session_id: 's1', cwd: d, hook_event_name: 'SessionStart' };
  const cloud = runHook('hook-session-start.cjs', input, { CLAUDE_PROJECT_DIR: d, CLAUDE_CODE_REMOTE: 'true' });
  assert.match(cloud.stdout, /^ai-rules: this is a cloud session\./);
  const local = runHook('hook-session-start.cjs', input, { CLAUDE_PROJECT_DIR: d, CLAUDE_CODE_REMOTE: '' });
  assert.equal(local.stdout, '');
  assert.equal(runHook('hook-session-start.cjs', 'garbage', { CLAUDE_PROJECT_DIR: makeRepo({}) }).status, 0);
});
