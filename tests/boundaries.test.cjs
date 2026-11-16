const test = require('node:test'); const assert = require('node:assert');
const path = require('node:path');
const { makeRepo, findEscapingRequires } = require('./helpers.cjs');

test('findEscapingRequires reports a require that leaves the folder', () => {
  const d = makeRepo({
    'lib/a.cjs': "const b = require('./b.cjs'); const fs = require('node:fs');",
    'lib/b.cjs': "module.exports = require('../../outside.cjs');",
    'lib/c.cjs': "require('lodash'); require('fs'); require('node:path'); require('..');",
    'hook.cjs': "require('./lib/a.cjs');" });
  assert.deepEqual(findEscapingRequires(d), ['lib/b.cjs: ../../outside.cjs', 'lib/c.cjs: lodash']);
});
test('managed scripts never require anything outside their own folder', () => {
  const dir = path.resolve('plugins/ai-rules/payload/managed/ai-rules/scripts');
  assert.deepEqual(findEscapingRequires(dir), []);
});
