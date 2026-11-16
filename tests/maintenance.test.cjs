const test = require('node:test'); const assert = require('node:assert');
const fs = require('node:fs');
test('this repo has its own skill to update the architecture catalog', () => {
  const s = fs.readFileSync('.claude/skills/update-architectures/SKILL.md', 'utf8');
  assert.match(s, /^---\nname: update-architectures\ndescription: Use when .+\n---\n/);
  assert.equal(s.includes('Managed by ai-rules'), false);
  for (const n of ['plugins/ai-rules/payload/managed/ai-rules/architectures.md', 'Last reviewed:', 'sources',
    'two independent', 'sync.cjs --bump', 'sync.cjs --target .', 'npm test', 'pull request', 'tests/content.test.cjs'])
    assert.ok(s.includes(n), n);
  assert.ok(fs.readFileSync('README.md', 'utf8').includes('update-architectures'));
});
