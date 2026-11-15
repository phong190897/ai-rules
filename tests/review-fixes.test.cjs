// Regression tests for the findings of the whole-branch review.
const test = require('node:test'); const assert = require('node:assert');
const fs = require('node:fs'); const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { spawnSync } = require('node:child_process');
const { makeRepo, runHook } = require('./helpers.cjs');
const sync = require('../plugins/ai-rules/scripts/sync.cjs');
const S = '../plugins/ai-rules/payload/managed/ai-rules/scripts';
const { splitCommands, classifyCommand } = require(`${S}/lib/commands.cjs`);
const { checkDanger } = require(`${S}/guards/danger.cjs`);
const { checkPr } = require(`${S}/guards/pr-check.cjs`);
const { mergeConfig, loadConfig, configProblem } = require(`${S}/lib/config.cjs`);
const MARK = '<!-- Managed by ai-rules. Do not edit; overwritten on sync. -->';
const payload = (extra = {}) => makeRepo({
  'managed/rules/ai-rules-core.md': `${MARK}\n# Core rules\n\n- Scope: x.\n`,
  'managed/ai-rules/scripts/a.cjs': '// Managed by ai-rules. Do not edit; overwritten on sync.\n',
  'settings-fragment.json': JSON.stringify({ hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [
    { type: 'command', command: 'node', args: ['${CLAUDE_PROJECT_DIR}/.claude/ai-rules/scripts/h.cjs'] }] }] } }),
  ...extra });
const read = (d, f) => fs.readFileSync(path.join(d, f), 'utf8');
const has = (d, f) => fs.existsSync(path.join(d, f));
const none = () => null;

// 1. sync must never delete a user's own AGENTS.md
test('a foreign AGENTS.md that replaced a managed one is not deleted', () => {
  const p = payload(), t = makeRepo({});
  sync.syncRepo({ payloadDir: p, targetDir: t });
  fs.writeFileSync(path.join(t, 'AGENTS.md'), '# Ours\n');
  const r = sync.syncRepo({ payloadDir: p, targetDir: t });
  assert.equal(read(t, 'AGENTS.md'), '# Ours\n');
  assert.deepEqual(r.removed, []);
});

// 2. the manifest is not a license to delete arbitrary paths
test('manifest entries outside the managed areas are never deleted', () => {
  const p = payload(), t = makeRepo({ 'CLAUDE.md': '# mine\n' });
  const outside = path.join(path.dirname(t), `outside-${path.basename(t)}.txt`);
  fs.writeFileSync(outside, 'keep');
  sync.syncRepo({ payloadDir: p, targetDir: t });
  const mf = path.join(t, '.claude/ai-rules/manifest.json');
  const m = JSON.parse(fs.readFileSync(mf, 'utf8'));
  m.files.push(`../${path.basename(outside)}`, 'CLAUDE.md', 'C:/Windows/win.ini', '.claude/ai-rules/../../CLAUDE.md');
  fs.writeFileSync(mf, JSON.stringify(m));
  const r = sync.syncRepo({ payloadDir: p, targetDir: t });
  assert.ok(has(t, 'CLAUDE.md')); assert.equal(fs.readFileSync(outside, 'utf8'), 'keep');
  assert.deepEqual(r.removed, []);
  fs.rmSync(outside);
});

// 3. git context follows the directory the command really runs in
test('commit on a feature-branch worktree is not denied when the project dir is on main', () => {
  const git = (d, ...a) => execFileSync('git', ['-c', 'user.email=a@b.c', '-c', 'user.name=n', ...a], { cwd: d, encoding: 'utf8' });
  const main = makeRepo({ 'a.txt': 'x' });
  git(main, 'init', '-q', '-b', 'main'); git(main, 'add', '-A'); git(main, 'commit', '-q', '-m', 'init');
  const wt = path.join(path.dirname(main), `wt-${path.basename(main)}`);
  git(main, 'worktree', 'add', '-q', '-b', 'feat/x', wt);
  const run = (command, cwd) => runHook('hook-pre-tool.cjs', { session_id: 's', cwd, hook_event_name: 'PreToolUse',
    tool_name: 'Bash', tool_input: { command } }, { CLAUDE_PROJECT_DIR: main });
  const decision = (r) => r.json && r.json.hookSpecificOutput.permissionDecision;
  assert.equal(decision(run('git commit -m "feat: x"', wt)), null);
  assert.equal(decision(run(`cd "${wt}" && git commit -m "feat: x"`, main)), null);
  assert.equal(decision(run(`git -C "${wt}" commit -m "feat: x"`, main)), null);
  assert.equal(decision(run('git commit -m "feat: x"', main)), 'deny');
});
test('checkDanger resolves cd and -C before looking at the branch', () => {
  const feat = { currentBranch: 'feat/x', hasCommits: true }; const main = { currentBranch: 'main', hasCommits: true };
  const ctx = { cwd: path.resolve('/proj'), forDir: (d) => (path.basename(d) === 'wt' ? feat : main) };
  const dec = (c) => (checkDanger(c, mergeConfig(null), ctx) || {}).decision || null;
  assert.equal(dec('cd /proj/wt && git commit -m "x"'), null);
  assert.equal(dec('git -C /proj/wt commit -m "x"'), null);
  assert.equal(dec('git commit -m "x"'), 'deny');
});

// 4. verify commands match as tokens, not as substrings of text
test('verify classification ignores quoted text and longer command names', () => {
  const c = mergeConfig({ verify: { e2ePreflight: 'npm run e2e:check', commands: {
    e2e: [], test: ['npm test'], build: ['npm run build'], lint: ['npm run lint'] } } });
  for (const cmd of ['git commit -m "test: document npm test flake"', 'grep -rn "npm test" docs', 'pnpm test',
    'npm run build:docs', 'npm run lint:fix', 'git commit -m "ci: run playwright test in CI"', 'echo npm run e2e'])
    assert.equal(classifyCommand(cmd, c), null, cmd);
  assert.equal(classifyCommand('npx playwright test a.spec.ts', c), 'e2e');
  assert.equal(classifyCommand('npm run e2e:check', c), 'preflight');
  assert.equal(classifyCommand('npm run build -- --watch', c), 'build');
});

// 5. a body the hook cannot read must pass
test('pr body that is not literal text is let through', () => {
  const T = 'gh pr create --title "feat: x"';
  assert.equal(checkPr(`${T} --body "$(cat /tmp/pr-body.md)"`, none), null);
  assert.equal(checkPr(`${T} --body "$BODY"`, none), null);
  assert.equal(checkPr(`${T} --body "$(printf '## Summary\\nx\\n\\n## Why\\ny\\n\\n## Changes\\nz\\n\\n## Testing\\nw')"`, none), null);
  assert.equal(checkPr(`${T} --body "plain text"`, none).decision, 'deny');
});

// 6. heredoc bodies and comments are not commands
test('heredoc bodies and comments do not produce commands', () => {
  assert.deepEqual(splitCommands("cat > f <<'EOF'\ngit reset --hard\nnpm install lodash\nEOF\ngit status"),
    [['cat', '>', 'f'], ['git', 'status']]);
  assert.deepEqual(splitCommands("git commit -F - <<-EOF\n\tgit clean -fd\n\tEOF"), [['git', 'commit', '-F', '-']]);
  assert.deepEqual(splitCommands("# don't rewrite history\ngit push --force o"), [['git', 'push', '--force', 'o']]);
  assert.deepEqual(splitCommands('git commit -m "fix: x #12"'), [['git', 'commit', '-m', 'fix: x #12']]);
  const c = mergeConfig(null), ctx = { currentBranch: 'feat/x', hasCommits: true };
  assert.equal(checkDanger("cat > a.md <<'EOF'\ngit reset --hard HEAD~1\nEOF", c, ctx), null);
  assert.equal(checkDanger("# don't\ngit push --force origin feat", c, ctx).decision, 'deny');
});

// 7. a repo that is ahead of the plugin is not told to downgrade
test('update check compares a sequence number, not just a hash', () => {
  const PAYLOAD = path.resolve('plugins/ai-rules/payload');
  const t = makeRepo({}); sync.syncRepo({ payloadDir: PAYLOAD, targetDir: t, init: true });
  const seq = sync.readManifest(t).sourceSeq;
  assert.ok(seq >= 1, 'manifest records sourceSeq');
  const mf = path.join(t, '.claude/ai-rules/manifest.json');
  const write = (o) => fs.writeFileSync(mf, JSON.stringify({ ...JSON.parse(fs.readFileSync(mf, 'utf8')), ...o }));
  const check = () => spawnSync('node', ['plugins/ai-rules/scripts/sync-check.cjs'], { encoding: 'utf8',
    input: JSON.stringify({ session_id: 's', cwd: t, hook_event_name: 'SessionStart' }),
    env: { ...process.env, CLAUDE_PROJECT_DIR: t, CLAUDE_CODE_REMOTE: '' } }).stdout;
  write({ sourceVersion: 'aheadofplug', sourceSeq: seq + 5 });
  assert.equal(check(), '');
  write({ sourceVersion: 'aheadofplug', sourceSeq: seq });
  assert.match(check(), /an update is available/);
  write({ sourceVersion: 'older0000000', sourceSeq: seq - 1 });
  assert.match(check(), /an update is available/);
});
test('VERSION file tracks the payload hash and --bump keeps it honest', () => {
  const P = path.resolve('plugins/ai-rules/payload');
  const [seq, hash] = fs.readFileSync(path.join(P, 'VERSION'), 'utf8').trim().split(/\s+/);
  assert.ok(Number(seq) >= 1);
  assert.equal(hash, sync.computeSourceVersion(P), 'run: node plugins/ai-rules/scripts/sync.cjs --bump');
  const p = payload({ VERSION: '4 stalehash000\n' });
  assert.deepEqual(sync.bumpVersion(p), { seq: 5, hash: sync.computeSourceVersion(p) });
  assert.equal(sync.bumpVersion(p).seq, 5);
  assert.equal(sync.readSeq(p), 5);
});

// 8. a slip in config must not silently disable the guards
test('config values of the wrong type fall back to defaults', () => {
  assert.deepEqual(mergeConfig({ verify: { commands: { test: 'npm test' } } }).verify.commands.test, ['npm test']);
  assert.equal(mergeConfig({ guards: null }).guards.danger, true);
  assert.equal(mergeConfig({ guards: { danger: 'no' } }).guards.danger, true);
  assert.equal(mergeConfig({ verify: 5 }).verify.maxFailedRunsWithoutChange, 2);
  assert.equal(mergeConfig({ verify: { maxFailedRunsWithoutChange: 'x' } }).verify.maxFailedRunsWithoutChange, 2);
  assert.equal(mergeConfig({ commitMsg: { scope: 'weird' } }).commitMsg.scope, 'ai');
  assert.equal(mergeConfig({ mainBranch: 7 }).mainBranch, 'main');
});
test('config and settings written with a BOM are read', () => {
  const d = makeRepo({ '.claude/ai-rules.json': '\uFEFF{"mainBranch":"dev"}' });
  assert.equal(loadConfig(d).mainBranch, 'dev'); assert.equal(configProblem(d), null);
  const t = makeRepo({ '.claude/settings.json': '\uFEFF{"model":"x"}' });
  const r = sync.syncRepo({ payloadDir: payload(), targetDir: t });
  assert.deepEqual(r.skipped, []);
  const s = JSON.parse(read(t, '.claude/settings.json'));
  assert.equal(s.model, 'x'); assert.equal(s.hooks.PreToolUse.length, 1);
});
test('configProblem and the session-start diagnostic', () => {
  assert.equal(configProblem(makeRepo({})), null);
  const d = makeRepo({ '.claude/ai-rules.json': '{broken' });
  assert.match(configProblem(d), /not valid JSON/);
  const r = runHook('hook-session-start.cjs', { session_id: 's', cwd: d, hook_event_name: 'SessionStart' },
    { CLAUDE_PROJECT_DIR: d, CLAUDE_CODE_REMOTE: '' });
  assert.match(r.stdout, /^ai-rules: \.claude\/ai-rules\.json is not valid JSON/m);
});
test('a bad config shape still lets the shell guards run', () => {
  const d = makeRepo({ '.claude/ai-rules.json': JSON.stringify({ guards: null, verify: { commands: { test: 'npm test' } } }) });
  const r = runHook('hook-pre-tool.cjs', { session_id: 's', cwd: d, hook_event_name: 'PreToolUse', tool_name: 'Bash',
    tool_input: { command: 'git push --force' } }, { CLAUDE_PROJECT_DIR: d });
  assert.equal(r.json.hookSpecificOutput.permissionDecision, 'deny');
});
