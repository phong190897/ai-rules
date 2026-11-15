// A branch change earlier in the same command line must be taken into account (found while using the plugin).
const test = require('node:test'); const assert = require('node:assert');
const { checkDanger } = require('../plugins/ai-rules/payload/managed/ai-rules/scripts/guards/danger.cjs');
const { mergeConfig } = require('../plugins/ai-rules/payload/managed/ai-rules/scripts/lib/config.cjs');
const c = mergeConfig(null);
const onMain = { currentBranch: 'main', hasCommits: true };
const onFeat = { currentBranch: 'feat/x', hasCommits: true };
const dec = (cmd, ctx) => (checkDanger(cmd, c, ctx) || {}).decision || null;

test('creating or switching to a feature branch first makes a later commit or push fine', () => {
  assert.equal(dec('git switch -c feat/x && git commit -m "feat: x"', onMain), null);
  assert.equal(dec('git checkout -b feat/x && git commit -m "feat: x"', onMain), null);
  assert.equal(dec('git switch feat/y && git push', onMain), null);
  assert.equal(dec('git switch -c feat/x; git push -u origin HEAD', onMain), null);
});
test('switching to main, or a command that does not change branch, keeps the guard', () => {
  assert.equal(dec('git switch main && git commit -m "x"', onFeat), 'deny');
  assert.equal(dec('git checkout main && git push', onFeat), 'deny');
  assert.equal(dec('git status && git commit -m "x"', onMain), 'deny');
  assert.equal(dec('git checkout -- file.txt && git commit -m "x"', onMain), 'deny');
});
