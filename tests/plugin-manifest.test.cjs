const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

test('marketplace declares the ai-rules plugin', () => {
  const m = read('.claude-plugin/marketplace.json');
  assert.equal(m.name, 'ai-rules-marketplace');
  assert.equal(m.owner.name, 'phong190897');
  assert.deepEqual(m.plugins, [{ name: 'ai-rules', source: './plugins/ai-rules' }]);
});

test('plugin manifest has a name and no version', () => {
  const p = read('plugins/ai-rules/.claude-plugin/plugin.json');
  assert.equal(p.name, 'ai-rules');
  assert.equal('version' in p, false);
});
