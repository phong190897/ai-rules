const test = require('node:test'); const assert = require('node:assert');
const fs = require('node:fs');
test('CI workflow runs npm test on Linux and Windows for pull requests and main', () => {
  const y = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
  for (const n of ['pull_request', 'branches: [main]', 'ubuntu-latest', 'windows-latest', 'node-version', 'npm test',
    'actions/checkout@v4', 'actions/setup-node@v4'])
    assert.ok(y.includes(n), n);
  assert.equal(y.includes('\t'), false);
});
