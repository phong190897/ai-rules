const test = require('node:test'); const assert = require('node:assert');
const S = '../plugins/ai-rules/payload/managed/ai-rules/scripts';
const { checkPr } = require(`${S}/guards/pr-check.cjs`);
const BODY = '## Summary\nx\n\n## Why\ny\n\n## Changes\nz\n\n## Testing\nw';
const heredoc = (title, body) => `gh pr create --title "${title}" --body "$(cat <<'EOF'\n${body}\nEOF\n)"`;
const none = () => null;

test('valid PR passes', () => {
  assert.equal(checkPr(heredoc('feat(api): add login', BODY), none), null);
  assert.equal(checkPr(`gh pr create -t "fix: handle 404" -b "${BODY}"`, none), null);
  assert.equal(checkPr(`gh pr create --title="feat!: drop v1" --body "${BODY}"`, none), null);
});
test('bad title is denied', () => {
  assert.match(checkPr(heredoc('Add login', BODY), none).reason, /^ai-rules: .*title/i);
  assert.equal(checkPr(heredoc('feat: ' + 'a'.repeat(70), BODY), none).decision, 'deny');
});
test('missing sections are listed', () => {
  const r = checkPr(heredoc('feat: add login', '## Summary\nx\n## Changes\nz'), none).reason;
  assert.match(r, /## Why/); assert.match(r, /## Testing/); assert.doesNotMatch(r, /## Summary/);
});
test('body file', () => {
  const cmd = 'gh pr create --title "fix: x" --body-file pr.md';
  assert.equal(checkPr(cmd, () => BODY), null);
  assert.equal(checkPr(cmd, () => '## Summary\nonly').decision, 'deny');
  assert.equal(checkPr(cmd, none), null);
  assert.equal(checkPr('gh pr create --title "fix: x" -F -', none), null);
});
test('not applicable', () => {
  for (const cmd of ['gh pr create --fill', 'gh pr create --web', 'gh pr list', 'echo "gh pr create"',
    'gh pr create --title "fix: x"', 'git status'])
    assert.equal(checkPr(cmd, none), null, cmd);
});
