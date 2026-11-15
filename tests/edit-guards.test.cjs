const test = require('node:test'); const assert = require('node:assert');
const S = '../plugins/ai-rules/payload/managed/ai-rules/scripts';
const { checkConfigEdit } = require(`${S}/guards/config-guard.cjs`);
const { findSecret } = require(`${S}/guards/secret.cjs`);
const { findWeakening } = require(`${S}/guards/test-weakening.cjs`);
const ask = (f, dir = '/repo', m = []) => (checkConfigEdit(f, dir, m) || {}).decision || null;

test('protected paths ask', () => {
  for (const f of ['/repo/.claude/ai-rules.json', '/repo/.claude/settings.json', '/repo/.claude/settings.local.json',
    '/repo/.claude/ai-rules/scripts/hook-pre-tool.cjs', '/repo/.claude/rules/ai-rules-core.md',
    '/repo/.claude/skills/ai-rules-creating-prs/SKILL.md', '/repo/.github/workflows/ai-rules-sync.yml',
    '.claude/ai-rules.json'])
    assert.equal(ask(f), 'ask', f);
  assert.equal(ask('/repo/AGENTS.md', '/repo', ['AGENTS.md']), 'ask');
  assert.equal(ask('C:\\Repo\\.claude\\ai-rules.json', 'c:\\repo'), 'ask');
  assert.match(checkConfigEdit('/repo/.claude/ai-rules.json', '/repo', []).reason, /^ai-rules: /);
});
test('other paths pass', () => {
  for (const f of ['/repo/src/app.js', '/repo/.claude/known-issues.md', '/repo/CLAUDE.md', '/repo/AGENTS.md',
    '/repo/.claude/skills/my-skill/SKILL.md', '/other/.claude/ai-rules.json'])
    assert.equal(ask(f), null, f);
});
test('findSecret', () => {
  const hits = {
    'private-key': '-----BEGIN RSA ' + 'PRIVATE KEY-----',
    'aws-access-key': 'AKIA' + 'ABCDEFGHIJKLMNOP',
    'github-token': 'ghp_' + 'a'.repeat(36),
    'stripe-live-key': 'sk_' + 'live_' + 'a'.repeat(24),
    'slack-token': 'xoxb-' + '1'.repeat(24),
    'anthropic-key': 'sk-ant-' + 'a'.repeat(48),
    'google-api-key': 'AIza' + 'a'.repeat(35),
  };
  for (const [name, text] of Object.entries(hits)) assert.equal(findSecret(`const k = "${text}";`), name);
  for (const text of ['const id = "a3f9c2e1b4d5a6f7a8b9c0d1e2f3a4b5";', 'sk_' + 'test_' + 'a'.repeat(24),
    'API_KEY=your-key-here', 'AKIA' + 'SHORT', ''])
    assert.equal(findSecret(text), null, text);
});
test('findWeakening reports only newly added markers', () => {
  assert.deepEqual(findWeakening({ old_string: 'it("a", f)', new_string: 'it.skip("a", f)' }), ['.skip(']);
  assert.deepEqual(findWeakening({ old_string: 'it.skip("a", f)', new_string: 'it.skip("b", f)' }), []);
  assert.deepEqual(findWeakening({ content: '// @ts-ignore\nfoo();\n/* eslint-disable */' }), ['@ts-ignore', 'eslint-disable']);
  assert.deepEqual(findWeakening({ new_source: 'x = 1  # noqa' }), ['# noqa']);
  assert.deepEqual(findWeakening({ content: 'const a = 1;' }), []);
  assert.deepEqual(findWeakening({}), []);
  assert.deepEqual(findWeakening({ content: 'process.exit(1)' }), []);
});
