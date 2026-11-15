const test = require('node:test'); const assert = require('node:assert');
const sync = require('../plugins/ai-rules/scripts/sync.cjs');
test('this repo runs the current version of its own payload', () => {
  const m = sync.readManifest('.');
  assert.ok(m, 'run: node plugins/ai-rules/scripts/sync.cjs --init --target .');
  assert.equal(m.sourceVersion, sync.computeSourceVersion('plugins/ai-rules/payload'),
    'run: node plugins/ai-rules/scripts/sync.cjs --target .');
});
