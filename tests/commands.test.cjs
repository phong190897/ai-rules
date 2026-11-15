const test = require('node:test'); const assert = require('node:assert');
const S = '../plugins/ai-rules/payload/managed/ai-rules/scripts';
const { splitCommands, normalizeCommand, classifyCommand } = require(`${S}/lib/commands.cjs`);
const { mergeConfig } = require(`${S}/lib/config.cjs`);

test('splitCommands is quote-aware', () => {
  assert.deepEqual(splitCommands('cd app && git push --force'), [['cd', 'app'], ['git', 'push', '--force']]);
  assert.deepEqual(splitCommands('git commit -m "docs: a && b; c | d"'), [['git', 'commit', '-m', 'docs: a && b; c | d']]);
  assert.deepEqual(splitCommands("CI=1 FOO=bar npm run e2e"), [['npm', 'run', 'e2e']]);
  assert.deepEqual(splitCommands('a | b\nc'), [['a'], ['b'], ['c']]);
  assert.deepEqual(splitCommands(''), []);
});
test('normalizeCommand', () => assert.equal(normalizeCommand('  npm   test \n'), 'npm test'));
test('classifyCommand', () => {
  const d = mergeConfig(null);
  assert.equal(classifyCommand('npx playwright test login.spec.ts', d), 'e2e');
  assert.equal(classifyCommand('cd web && pnpm test:e2e', d), 'e2e');
  assert.equal(classifyCommand('npm test', d), null);
  const c = mergeConfig({ verify: { e2ePreflight: 'npm run e2e:check',
    commands: { e2e: ['npm run e2e'], test: ['npm test'], build: ['npm run build'], lint: ['npm run lint'] } } });
  assert.equal(classifyCommand('npm run e2e:check', c), 'preflight');
  assert.equal(classifyCommand('npm run e2e -- login', c), 'e2e');
  assert.equal(classifyCommand('npm test -- foo', c), 'test');
  assert.equal(classifyCommand('npm run build', c), 'build');
  assert.equal(classifyCommand('npm run lint', c), 'lint');
  assert.equal(classifyCommand('ls -la', c), null);
});
