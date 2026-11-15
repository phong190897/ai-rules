const test = require('node:test'); const assert = require('node:assert');
const fs = require('node:fs');
const { makeRepo, runHook } = require('./helpers.cjs');
const CFG = JSON.stringify({ verify: { commands: { e2e: ['npm run e2e'] } }, turnNudgeAfterToolCalls: 3 });
const repo = (extra = {}) => makeRepo({ '.claude/ai-rules.json': CFG, ...extra });
const bash = (dir, command, event = 'PreToolUse', more = {}) =>
  ({ session_id: 's1', cwd: dir, hook_event_name: event, tool_name: 'Bash', tool_input: { command }, ...more });
const env = (dir) => ({ CLAUDE_PROJECT_DIR: dir });
const decision = (r) => r.json && r.json.hookSpecificOutput.permissionDecision;

test('pre-tool: deny, ask, and silence', () => {
  const d = repo();
  assert.equal(decision(runHook('hook-pre-tool.cjs', bash(d, 'git push --force'), env(d))), 'deny');
  assert.equal(decision(runHook('hook-pre-tool.cjs', bash(d, 'npm install lodash'), env(d))), 'ask');
  const edit = { session_id: 's1', cwd: d, hook_event_name: 'PreToolUse', tool_name: 'Edit',
    tool_input: { file_path: `${d}/.claude/ai-rules.json`, old_string: 'a', new_string: 'b' } };
  assert.equal(decision(runHook('hook-pre-tool.cjs', edit, env(d))), 'ask');
  const write = { ...edit, tool_name: 'Write',
    tool_input: { file_path: `${d}/src/a.js`, content: '-----BEGIN ' + 'PRIVATE KEY-----' } };
  assert.equal(decision(runHook('hook-pre-tool.cjs', write, env(d))), 'deny');
  const quiet = runHook('hook-pre-tool.cjs', bash(d, 'ls'), env(d));
  assert.equal(quiet.status, 0); assert.equal(quiet.stdout, '');
});
test('all entry scripts fail open on bad input', () => {
  const d = repo({ '.claude/ai-rules.json': '{broken' });
  for (const s of ['hook-pre-tool.cjs', 'hook-post-tool.cjs', 'hook-user-prompt.cjs'])
    for (const input of ['', 'not json', '{"tool_name":"Bash"}', '{"tool_name":"Edit","tool_input":null}']) {
      const r = runHook(s, input, env(d));
      assert.equal(r.status, 0, `${s} ${input}`); assert.equal(r.stdout, '', `${s} ${input}`);
    }
});
test('e2e: two failures block the third run; a new user message unblocks', () => {
  const d = repo(); const e = env(d);
  for (let i = 0; i < 2; i++) {
    assert.equal(decision(runHook('hook-pre-tool.cjs', bash(d, 'npm run e2e'), e)), null);
    runHook('hook-post-tool.cjs', bash(d, 'npm run e2e', 'PostToolUseFailure'), e);
  }
  assert.equal(decision(runHook('hook-pre-tool.cjs', bash(d, 'npm run e2e'), e)), 'deny');
  const up = runHook('hook-user-prompt.cjs', { session_id: 's1', cwd: d, hook_event_name: 'UserPromptSubmit' }, e);
  assert.equal(up.stdout, '');
  assert.equal(decision(runHook('hook-pre-tool.cjs', bash(d, 'npm run e2e'), e)), null);
});
test('e2e: an edit between failures resets the streak', () => {
  const d = repo(); const e = env(d);
  runHook('hook-post-tool.cjs', bash(d, 'npm run e2e', 'PostToolUseFailure'), e);
  runHook('hook-post-tool.cjs', bash(d, 'npm run e2e', 'PostToolUseFailure'), e);
  runHook('hook-post-tool.cjs', { session_id: 's1', cwd: d, hook_event_name: 'PostToolUse', tool_name: 'Edit',
    tool_input: { file_path: `${d}/src/a.js`, old_string: 'a', new_string: 'b' } }, e);
  assert.equal(decision(runHook('hook-pre-tool.cjs', bash(d, 'npm run e2e'), e)), null);
});
test('post-tool: passing e2e runs never block', () => {
  const d = repo(); const e = env(d);
  for (let i = 0; i < 6; i++)
    runHook('hook-post-tool.cjs', bash(d, 'npm run e2e', 'PostToolUse', { tool_response: { exitCode: 0 } }), e);
  assert.equal(decision(runHook('hook-pre-tool.cjs', bash(d, 'npm run e2e'), e)), null);
});
test('post-tool: nudges arrive as additionalContext', () => {
  const d = repo(); const e = env(d);
  runHook('hook-post-tool.cjs', bash(d, 'ls', 'PostToolUse'), e);
  runHook('hook-post-tool.cjs', bash(d, 'ls', 'PostToolUse'), e);
  const third = runHook('hook-post-tool.cjs', bash(d, 'ls', 'PostToolUse'), e);
  assert.match(third.json.hookSpecificOutput.additionalContext, /3 tool calls this turn/);
  const weak = runHook('hook-post-tool.cjs', { session_id: 's2', cwd: d, hook_event_name: 'PostToolUse',
    tool_name: 'Write', tool_input: { file_path: `${d}/a.test.js`, content: 'it.skip("a", f)' } }, e);
  assert.match(weak.json.hookSpecificOutput.additionalContext, /this edit adds \.skip\(/);
});
test('settings fragment wires every entry script', () => {
  const f = JSON.parse(fs.readFileSync('plugins/ai-rules/payload/settings-fragment.json', 'utf8'));
  assert.deepEqual(Object.keys(f.hooks).sort(),
    ['PostToolUse', 'PostToolUseFailure', 'PreToolUse', 'SessionStart', 'UserPromptSubmit']);
  for (const groups of Object.values(f.hooks)) for (const g of groups) for (const h of g.hooks) {
    assert.equal(h.command, 'node');
    assert.match(h.args[0], /^\$\{CLAUDE_PROJECT_DIR\}\/\.claude\/ai-rules\/scripts\/hook-[a-z-]+\.cjs$/);
  }
  assert.ok(f.permissions.deny.includes('Read(./.env)'));
  assert.ok(!f.permissions.deny.some((r) => r.includes('example')));
});
