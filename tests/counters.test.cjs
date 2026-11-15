const test = require('node:test'); const assert = require('node:assert');
const S = '../plugins/ai-rules/payload/managed/ai-rules/scripts';
const { checkVerify, recordResult } = require(`${S}/guards/verify.cjs`);
const { recordOther } = require(`${S}/guards/repeat-nudge.cjs`);
const { tick } = require(`${S}/guards/turn-budget.cjs`);
const { mergeConfig } = require(`${S}/lib/config.cjs`);
const { newState, resetOnEdit, resetTurn } = require(`${S}/lib/state.cjs`);
const cfg = (o = {}) => mergeConfig({ verify: { commands: { e2e: ['npm run e2e'], test: ['npm test'] }, ...o } });
const E = 'npm run e2e', T = 'npm test';

test('third consecutive failure without edits is blocked', () => {
  const c = cfg(), s = newState();
  assert.equal(checkVerify(E, c, s), null); recordResult(E, true, c, s);
  assert.equal(checkVerify(E, c, s), null); recordResult(E, true, c, s);
  const d = checkVerify(E, c, s);
  assert.equal(d.decision, 'deny'); assert.match(d.reason, /^ai-rules: `e2e` has failed 2 times/);
});
test('passing runs are never blocked', () => {
  const c = cfg(), s = newState();
  for (let i = 0; i < 20; i++) { assert.equal(checkVerify(E, c, s), null); recordResult(E, false, c, s); }
});
test('TDD cycle (fail, edit, pass) repeated is never blocked', () => {
  const c = cfg(), s = newState();
  for (let i = 0; i < 10; i++) {
    assert.equal(checkVerify(T, c, s), null); recordResult(T, true, c, s); resetOnEdit(s);
    assert.equal(checkVerify(T, c, s), null); recordResult(T, false, c, s);
  }
});
test('e2e per-turn cap applies even with edits, and resets on a new turn', () => {
  const c = cfg(), s = newState();
  for (let i = 0; i < 4; i++) { assert.equal(checkVerify(E, c, s), null); recordResult(E, true, c, s); resetOnEdit(s); }
  assert.match(checkVerify(E, c, s).reason, /4 times this turn/);
  resetTurn(s); assert.equal(checkVerify(E, c, s), null);
});
test('per-turn cap does not apply to unit tests', () => {
  const c = cfg(), s = newState();
  for (let i = 0; i < 10; i++) { recordResult(T, true, c, s); resetOnEdit(s); }
  assert.equal(checkVerify(T, c, s), null);
});
test('preflight must pass once per session before e2e', () => {
  const c = cfg({ e2ePreflight: 'node scripts/check-env.js' }), s = newState();
  assert.match(checkVerify(E, c, s).reason, /preflight before e2e: `node scripts\/check-env.js`/);
  recordResult('node scripts/check-env.js', true, c, s); assert.equal(checkVerify(E, c, s).decision, 'deny');
  recordResult('node scripts/check-env.js', false, c, s); assert.equal(checkVerify(E, c, s), null);
  resetTurn(s); assert.equal(checkVerify(E, c, s), null);
});
test('guard off and undeclared commands', () => {
  const s = newState(); s.failedWithoutChange.e2e = 9;
  assert.equal(checkVerify(E, mergeConfig({ guards: { verify: false } }), s), null);
  assert.equal(checkVerify('ls', cfg(), s), null);
  assert.equal(recordResult('ls', true, cfg(), s), false);
});
test('repeat nudge fires once at the threshold', () => {
  const c = cfg(), s = newState();
  assert.equal(recordOther('curl  x', true, c, s), null);
  assert.equal(recordOther('curl x', true, c, s), null);
  assert.match(recordOther('curl x', true, c, s), /same command has failed 3 times/);
  assert.equal(recordOther('curl x', true, c, s), null);
  assert.equal(recordOther('curl y', true, c, s), null);
});
test('turn budget nudges at each multiple', () => {
  const c = mergeConfig({ turnNudgeAfterToolCalls: 3 }), s = newState();
  assert.equal(tick(c, s), null); assert.equal(tick(c, s), null);
  assert.match(tick(c, s), /^ai-rules: 3 tool calls this turn/);
  tick(c, s); tick(c, s); assert.match(tick(c, s), /6 tool calls/);
  assert.equal(tick(mergeConfig({ turnNudgeAfterToolCalls: 0 }), newState()), null);
});
