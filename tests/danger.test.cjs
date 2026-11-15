const test = require('node:test'); const assert = require('node:assert');
const S = '../plugins/ai-rules/payload/managed/ai-rules/scripts';
const { checkDanger } = require(`${S}/guards/danger.cjs`);
const { mergeConfig } = require(`${S}/lib/config.cjs`);
const c = mergeConfig(null);
const feat = { currentBranch: 'feat/x', hasCommits: true };
const main = { currentBranch: 'main', hasCommits: true };
const dec = (cmd, ctx = feat, cfg = c) => (checkDanger(cmd, cfg, ctx) || {}).decision || null;

test('denied', () => {
  for (const cmd of ['git push --force', 'git push -f origin feat/x', 'git push --force-with-lease',
    'git push origin +feat/x', 'git push origin main', 'git push origin HEAD:main',
    'git commit --no-verify -m "fix: x"', 'git commit -n -m "fix: x"', 'git reset --hard HEAD~1',
    'git clean -fd', 'git add .env', 'git add config/.env.production', 'cd app && git push --force'])
    assert.equal(dec(cmd), 'deny', cmd);
  assert.equal(dec('git push', main), 'deny');
  assert.equal(dec('git commit -m "fix: x"', main), 'deny');
});
test('allowed', () => {
  for (const cmd of ['git push -u origin feat/x', 'git push', 'git commit -m "docs: explain git reset --hard"',
    'git commit -m "fix: a && git push --force"', 'echo "git push --force"', 'git add .env.example',
    'git clean -n', 'git reset --soft HEAD~1', 'git status', 'npm install', 'npm ci',
    'npm install --legacy-peer-deps', 'pnpm install', 'yarn', 'yarn install',
    'pip install -r requirements.txt', 'pip install -e .', 'pip install .', 'cargo build', 'go get ./...'])
    assert.equal(dec(cmd), null, cmd);
  assert.equal(dec('git commit -m "chore: first"', { currentBranch: 'main', hasCommits: false }), null);
});
test('dependency installs ask', () => {
  for (const cmd of ['npm install lodash', 'npm i -D vitest', 'pnpm add zod', 'yarn add react', 'bun add hono',
    'pip install requests', 'uv add httpx', 'poetry add rich', 'cargo add serde', 'go get github.com/x/y',
    'dotnet add package Serilog', 'composer require monolog/monolog', 'gem install rake', 'bundle add rspec'])
    assert.equal(dec(cmd), 'ask', cmd);
  assert.match(checkDanger('npm install lodash', c, feat).reason, /^ai-rules: .*lodash/);
});
test('guards can be switched off independently', () => {
  assert.equal(dec('git push --force', feat, mergeConfig({ guards: { danger: false } })), null);
  assert.equal(dec('npm install lodash', feat, mergeConfig({ guards: { dependencies: false } })), null);
  assert.equal(dec('git push --force && npm install x', feat, mergeConfig({ guards: { danger: false } })), 'ask');
});
test('custom main branch', () => {
  const cfg = mergeConfig({ mainBranch: 'trunk' });
  assert.equal(dec('git push origin trunk', feat, cfg), 'deny');
  assert.equal(dec('git push origin main', feat, cfg), null);
});
