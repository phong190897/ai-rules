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
const SKILLS = {
  'ai-rules-repo-setup': ['CLAUDE.md', 'catalog.md', '.claude/ai-rules.json', 'e2ePreflight'],
  'ai-rules-creating-prs': ['## Summary', '## Why', '## Changes', '## Testing', '72', 'refactor'],
  'ai-rules-writing-comments': ['commit', 'pull request'],
  'ai-rules-handling-failures': ['known-issues.md', 'environment', 'flaky'],
  'ai-rules-saving-tokens': ['search', 'output'],
  'ai-rules-backend-basics': ['migration', 'timeout'],
  'ai-rules-security-basics': ['injection', '/security-review'],
  'ai-rules-architecture': ['architectures.md', 'one at a time', 'two or three', 'the user decides', '## Architecture',
    'Dependency rules:', 'New code:', '## Structure', 'not decided (user choice)', '(target;', 'not in the catalog',
    'verify.commands.lint', 'Monorepo'],
};
test('architecture catalog has every style in the same shape, plus the boundary tools', () => {
  const f = `${MANAGED}/ai-rules/architectures.md`; const text = fs.readFileSync(f, 'utf8');
  const names = ['Modular monolith', 'N-Layer', 'Clean / Hexagonal', 'Vertical slice', 'Microservices',
    'Microfrontend', 'Event-driven', 'Serverless'];
  assert.deepEqual([...text.matchAll(/^### (.+)$/gm)].map((m) => m[1]), names);
  for (const label of ['- What it is:', '- Fits when:', '- Does not fit when:', '- Typical modules and rule:'])
    assert.equal(text.split(label).length - 1, names.length, label);
  assert.match(text, /^Last reviewed: \d{4}-\d{2}-\d{2}$/m);
  assert.match(text, /^## Boundary tools$/m);
  for (const tool of ['dependency-cruiser', 'eslint-plugin-boundaries', 'import-linter', 'ArchUnit', 'NetArchTest', 'depguard'])
    assert.ok(text.includes(tool), tool);
  assert.ok(lines(f) <= 150, `catalog has ${lines(f)} lines`);
  const skill = fs.readFileSync(`${MANAGED}/skills/ai-rules-architecture/SKILL.md`, 'utf8');
  for (const n of names) assert.equal(skill.includes(`### ${n}`), false, `${n} belongs in the catalog, not the skill`);
  assert.doesNotMatch(skill, /by default|default to/i);
});
test('each content skill has valid frontmatter, required content and size', () => {
  assert.deepEqual(fs.readdirSync(`${MANAGED}/skills`).sort(), Object.keys(SKILLS).sort());
  for (const [name, needles] of Object.entries(SKILLS)) {
    const f = `${MANAGED}/skills/${name}/SKILL.md`; const text = fs.readFileSync(f, 'utf8');
    assert.match(text, new RegExp(`^---\\nname: ${name}\\ndescription: Use when .+\\n---\\n<!-- Managed by ai-rules`), name);
    for (const n of needles) assert.ok(text.includes(n), `${name} lacks ${n}`);
    assert.ok(lines(f) <= (name.endsWith('-basics') ? 100 : 150), `${name} has ${lines(f)} lines`);
  }
});
test('catalog lists the three approved areas and cloud availability', () => {
  const c = fs.readFileSync(`${MANAGED}/ai-rules/catalog.md`, 'utf8');
  for (const n of ['frontend-design', '/security-review', 'ai-rules-security-basics', 'ai-rules-backend-basics',
    'ai-rules-architecture', 'Available in cloud sessions']) assert.ok(c.includes(n), n);
});
test('AGENTS.md lists every content skill', () => {
  const a = sync.generateAgentsMd(PAYLOAD);
  for (const name of Object.keys(SKILLS)) assert.ok(a.includes(`.claude/skills/${name}/SKILL.md`), name);
});
test('AGENTS.md carries the shared rules without the Claude-only section', () => {
  const a = sync.generateAgentsMd(PAYLOAD);
  assert.match(a, /- Scope: change only what was asked\./);
  assert.doesNotMatch(a, /Superpowers|Cloud sessions|Claude Code only/);
});
