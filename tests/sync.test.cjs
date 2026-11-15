const test = require('node:test'); const assert = require('node:assert');
const fs = require('node:fs'); const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { makeRepo } = require('./helpers.cjs');
const sync = require('../plugins/ai-rules/scripts/sync.cjs');
const MARK = '<!-- Managed by ai-rules. Do not edit; overwritten on sync. -->';
const H = (s) => ({ type: 'command', command: 'node', args: ['${CLAUDE_PROJECT_DIR}/.claude/ai-rules/scripts/' + s] });
const FRAG = { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [H('hook-pre-tool.cjs')] }] },
  permissions: { deny: ['Read(./.env)', 'Read(./.env.local)'] } };
const payload = (over = {}) => makeRepo({
  'managed/rules/ai-rules-core.md': `${MARK}\n# Core rules\n\n- Scope: only what was asked.\n\n## Claude Code only\n\n- Superpowers: install it.\n`,
  'managed/skills/ai-rules-x/SKILL.md': `---\nname: ai-rules-x\ndescription: Use when doing x.\n---\n${MARK}\nBody\n`,
  'managed/ai-rules/scripts/a.cjs': '// Managed by ai-rules. Do not edit; overwritten on sync.\n',
  'settings-fragment.json': JSON.stringify(FRAG),
  'starter/CLAUDE.md': '# Project\n', 'starter/ai-rules.json': '{"source":"phong190897/ai-rules"}\n',
  'starter/settings.json': '{"enabledPlugins":{"ai-rules@ai-rules-marketplace":true}}\n',
  'starter/known-issues.md': '# Known issues\n', 'starter/ai-rules-sync.yml': 'name: ai-rules sync\n', ...over });
const read = (d, f) => fs.readFileSync(path.join(d, f), 'utf8');
const has = (d, f) => fs.existsSync(path.join(d, f));

test('init creates starter and managed files', () => {
  const p = payload(), t = makeRepo({});
  const r = sync.syncRepo({ payloadDir: p, targetDir: t, init: true });
  for (const f of ['CLAUDE.md', '.claude/ai-rules.json', '.claude/known-issues.md', '.github/workflows/ai-rules-sync.yml',
    '.claude/rules/ai-rules-core.md', '.claude/skills/ai-rules-x/SKILL.md', '.claude/ai-rules/scripts/a.cjs', 'AGENTS.md'])
    assert.ok(has(t, f), f);
  const agents = read(t, 'AGENTS.md');
  assert.ok(agents.startsWith(MARK)); assert.match(agents, /- Scope: only what was asked\./);
  assert.doesNotMatch(agents, /Superpowers/); assert.match(agents, /read `CLAUDE\.md`/);
  assert.match(agents, /\| Use when doing x\. \| `\.claude\/skills\/ai-rules-x\/SKILL\.md` \|/);
  const m = sync.readManifest(t);
  assert.equal(m.sourceVersion, r.sourceVersion); assert.match(m.sourceVersion, /^[0-9a-f]{12}$/);
  assert.ok(m.files.includes('AGENTS.md')); assert.deepEqual(m.managedDeny, FRAG.permissions.deny);
  const s = JSON.parse(read(t, '.claude/settings.json'));
  assert.equal(s.enabledPlugins['ai-rules@ai-rules-marketplace'], true);
  assert.equal(s.hooks.PreToolUse.length, 1);
});
test('second sync is a no-op; starter files are never overwritten', () => {
  const p = payload(), t = makeRepo({});
  sync.syncRepo({ payloadDir: p, targetDir: t, init: true });
  fs.writeFileSync(path.join(t, 'CLAUDE.md'), '# Mine\n');
  const r = sync.syncRepo({ payloadDir: p, targetDir: t, init: true });
  assert.deepEqual(r.written, []); assert.deepEqual(r.removed, []);
  assert.equal(read(t, 'CLAUDE.md'), '# Mine\n');
  assert.ok(r.skipped.some((s) => s.path === 'CLAUDE.md' && s.reason === 'exists'));
  assert.equal(JSON.parse(read(t, '.claude/settings.json')).hooks.PreToolUse.length, 1);
});
test('files dropped from the payload are removed from the target', () => {
  const p = payload(), t = makeRepo({});
  sync.syncRepo({ payloadDir: p, targetDir: t });
  fs.rmSync(path.join(p, 'managed/skills/ai-rules-x'), { recursive: true });
  const r = sync.syncRepo({ payloadDir: p, targetDir: t });
  assert.deepEqual(r.removed, ['.claude/skills/ai-rules-x/SKILL.md']);
  assert.equal(has(t, '.claude/skills/ai-rules-x'), false);
  assert.equal(sync.readManifest(t).files.includes('.claude/skills/ai-rules-x/SKILL.md'), false);
});
test('a foreign AGENTS.md is left alone', () => {
  const p = payload(), t = makeRepo({ 'AGENTS.md': '# Ours\n' });
  const r = sync.syncRepo({ payloadDir: p, targetDir: t });
  assert.equal(read(t, 'AGENTS.md'), '# Ours\n');
  assert.ok(r.skipped.some((s) => s.reason === 'foreign AGENTS.md'));
  assert.equal(sync.readManifest(t).files.includes('AGENTS.md'), false);
});
test('mergeSettings keeps the repo own settings and replaces managed entries', () => {
  const own = { matcher: 'Write', hooks: [{ type: 'command', command: 'npx prettier --write' }] };
  const existing = { model: 'x', hooks: { PreToolUse: [own, { matcher: 'Bash', hooks: [H('old.cjs')] }], Stop: [own] },
    permissions: { allow: ['Bash(ls)'], deny: ['Read(./secret.txt)', 'Read(./.env.old)'] } };
  const out = sync.mergeSettings(existing, FRAG, ['Read(./.env.old)']);
  assert.equal(out.model, 'x'); assert.deepEqual(out.hooks.Stop, [own]);
  assert.deepEqual(out.hooks.PreToolUse, [own, FRAG.hooks.PreToolUse[0]]);
  assert.deepEqual(out.permissions.allow, ['Bash(ls)']);
  assert.deepEqual(out.permissions.deny, ['Read(./secret.txt)', 'Read(./.env)', 'Read(./.env.local)']);
  assert.deepEqual(sync.mergeSettings(out, FRAG, FRAG.permissions.deny), out);
});
test('an invalid settings.json is not touched', () => {
  const p = payload(), t = makeRepo({ '.claude/settings.json': '{broken' });
  const r = sync.syncRepo({ payloadDir: p, targetDir: t });
  assert.equal(read(t, '.claude/settings.json'), '{broken');
  assert.ok(r.skipped.some((s) => s.reason === 'invalid settings.json'));
});
test('CRLF payloads hash and write the same as LF payloads', () => {
  const lf = payload();
  const crlf = payload({ 'managed/rules/ai-rules-core.md':
    `${MARK}\r\n# Core rules\r\n\r\n- Scope: only what was asked.\r\n\r\n## Claude Code only\r\n\r\n- Superpowers: install it.\r\n` });
  assert.equal(sync.computeSourceVersion(crlf), sync.computeSourceVersion(lf));
  const t = makeRepo({}); sync.syncRepo({ payloadDir: crlf, targetDir: t });
  assert.equal(read(t, '.claude/rules/ai-rules-core.md').includes('\r'), false);
});
test('CLI --check reports without writing', () => {
  const t = makeRepo({});
  const r = spawnSync('node', ['plugins/ai-rules/scripts/sync.cjs', '--target', t, '--check'], { encoding: 'utf8' });
  const out = JSON.parse(r.stdout);
  assert.equal(out.current, null); assert.equal(out.upToDate, false); assert.match(out.latest, /^[0-9a-f]{12}$/);
  assert.deepEqual(fs.readdirSync(t), []);
});
