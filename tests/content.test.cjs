const test = require('node:test'); const assert = require('node:assert');
const fs = require('node:fs'); const path = require('node:path');
const sync = require('../plugins/ai-rules/scripts/sync.cjs');
const PAYLOAD = 'plugins/ai-rules/payload'; const MANAGED = `${PAYLOAD}/managed`;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true })
  .flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const lines = (f) => fs.readFileSync(f, 'utf8').trimEnd().split('\n').length;

test('core rules fit the budget and point at every skill', () => {
  const f = `${MANAGED}/rules/ai-rules-core.md`; const text = fs.readFileSync(f, 'utf8');
  assert.ok(lines(f) <= 40, `core has ${lines(f)} lines`);
  assert.match(text, /^# Core rules$/m); assert.match(text, /^## Claude Code only$/m);
  for (const s of ['ai-rules-handling-failures', 'ai-rules-saving-tokens', 'ai-rules-creating-prs',
    'ai-rules-writing-comments', 'ai-rules-repo-setup']) assert.ok(text.includes(s), s);
});
test('every managed .md and .cjs carries the managed marker', () => {
  for (const f of walk(MANAGED).filter((x) => /\.(md|cjs)$/.test(x)))
    assert.ok(fs.readFileSync(f, 'utf8').includes('Managed by ai-rules. Do not edit; overwritten on sync.'), f);
});
test('AGENTS.md carries the shared rules without the Claude-only section', () => {
  const a = sync.generateAgentsMd(PAYLOAD);
  assert.match(a, /- Scope: change only what was asked\./);
  assert.doesNotMatch(a, /Superpowers|Cloud sessions|Claude Code only/);
});
