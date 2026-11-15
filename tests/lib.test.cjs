const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const S = '../plugins/ai-rules/payload/managed/ai-rules/scripts';
const io = require(`${S}/lib/io.cjs`);
const { DEFAULTS, mergeConfig, loadConfig } = require(`${S}/lib/config.cjs`);
const st = require(`${S}/lib/state.cjs`);
const { checkTitle } = require(`${S}/lib/conventions.cjs`);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'air-'));

test('parseInput tolerates empty and invalid input', () => {
  assert.deepEqual(io.parseInput(''), {});
  assert.deepEqual(io.parseInput('not json'), {});
  assert.deepEqual(io.parseInput('{"a":1}'), { a: 1 });
});
test('commandFailed', () => {
  assert.equal(io.commandFailed({ hook_event_name: 'PostToolUseFailure' }), true);
  assert.equal(io.commandFailed({ tool_response: { exitCode: 1 } }), true);
  assert.equal(io.commandFailed({ tool_response: { exit_code: 0 } }), false);
  assert.equal(io.commandFailed({ tool_response: { is_error: true } }), true);
  assert.equal(io.commandFailed({ tool_response: 'Exit code 2\nboom' }), true);
  assert.equal(io.commandFailed({ tool_response: { stdout: 'ok' } }), false);
  assert.equal(io.commandFailed({}), false);
});
test('decision shapes', () => {
  assert.deepEqual(io.preToolDecision('deny', 'ai-rules: x').hookSpecificOutput,
    { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'ai-rules: x' });
  assert.deepEqual(io.contextOutput('PostToolUse', 'hi').hookSpecificOutput,
    { hookEventName: 'PostToolUse', additionalContext: 'hi' });
});
test('config merges deeply and survives bad files', () => {
  const c = mergeConfig({ guards: { danger: false }, verify: { commands: { e2e: ['npm run e2e'] } } });
  assert.equal(c.guards.danger, false); assert.equal(c.guards.verify, true);
  assert.deepEqual(c.verify.commands.e2e, ['npm run e2e']);
  assert.equal(c.verify.maxFailedRunsWithoutChange, 2);
  const d = tmp(); assert.deepEqual(loadConfig(d), DEFAULTS);
  fs.mkdirSync(path.join(d, '.claude')); fs.writeFileSync(path.join(d, '.claude/ai-rules.json'), '{broken');
  assert.deepEqual(loadConfig(d), DEFAULTS);
});
test('state round-trips, recovers from corruption, resets', () => {
  process.env.AI_RULES_STATE_DIR = tmp();
  const s = st.newState(); s.turn.toolCalls = 5; s.failedWithoutChange.e2e = 2; s.preflightPassed = true;
  st.saveState('abc/../x', s);
  assert.equal(st.loadState('abc/../x').turn.toolCalls, 5);
  fs.writeFileSync(path.join(process.env.AI_RULES_STATE_DIR, 'bad.json'), '{"turn":');
  assert.deepEqual(st.loadState('bad'), st.newState());
  const r = st.resetTurn(s);
  assert.equal(r.turn.toolCalls, 0); assert.equal(r.failedWithoutChange.e2e, 0); assert.equal(r.preflightPassed, true);
  s.failedWithoutChange.test = 1; s.lastFailed = { command: 'x', count: 2 };
  const e = st.resetOnEdit(s);
  assert.equal(e.failedWithoutChange.test, 0); assert.equal(e.lastFailed.count, 0);
});
test('checkTitle', () => {
  for (const ok of ['feat: add login', 'fix(api): handle 404', 'feat!: drop v1', 'chore(deps-dev): bump x'])
    assert.equal(checkTitle(ok), null, ok);
  for (const bad of ['Add login', 'feature: x', 'feat:x', 'feat: ' + 'a'.repeat(70)])
    assert.equal(typeof checkTitle(bad), 'string', bad);
});
