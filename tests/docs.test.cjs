const test = require('node:test'); const assert = require('node:assert');
const fs = require('node:fs');
test('sync workflow', () => {
  const y = fs.readFileSync('plugins/ai-rules/payload/starter/ai-rules-sync.yml', 'utf8');
  for (const n of ['workflow_dispatch', 'schedule', 'repository: phong190897/ai-rules', 'pull-requests: write',
    'sync.cjs --target .', 'chore: sync ai-rules', '## Testing'])
    assert.ok(y.includes(n), n);
  assert.equal(y.includes('\t'), false);
});
test('README covers install, environments and configuration', () => {
  const r = fs.readFileSync('README.md', 'utf8');
  for (const n of ['claude plugin marketplace add phong190897/ai-rules',
    'claude plugin install ai-rules@ai-rules-marketplace', 'ai-rules:init-repo', 'Project thread',
    'AGENTS.md', 'maxFailedRunsWithoutChange', 'commitMsg', 'npm test',
    'ai-rules-architecture', 'architectures.md', 'dependency-cruiser'])
    assert.ok(r.includes(n), n);
});
