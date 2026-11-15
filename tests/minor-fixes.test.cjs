// Regression tests for the minor findings of the review that affect behaviour or performance.
const test = require('node:test'); const assert = require('node:assert');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { makeRepo } = require('./helpers.cjs');
const sync = require('../plugins/ai-rules/scripts/sync.cjs');
const scan = require('../plugins/ai-rules/scripts/scan.cjs');
const S = '../plugins/ai-rules/payload/managed/ai-rules/scripts';
const { splitCommands } = require(`${S}/lib/commands.cjs`);
const { checkDanger } = require(`${S}/guards/danger.cjs`);
const { checkConfigEdit } = require(`${S}/guards/config-guard.cjs`);
const { mergeConfig } = require(`${S}/lib/config.cjs`);
const { sessionKey } = require(`${S}/lib/io.cjs`);
const c = mergeConfig(null);
const feat = { currentBranch: 'feat/x', hasCommits: true };
const main = { currentBranch: 'main', hasCommits: true };
const dec = (cmd, ctx = feat) => (checkDanger(cmd, c, ctx) || {}).decision || null;

test('push of tags and dry runs are not mistaken for dangerous commands', () => {
  assert.equal(dec('git push origin --tags', main), null);
  assert.equal(dec('git push --tags', main), null);
  assert.equal(dec('git clean -nfd'), null);
  assert.equal(dec('git clean --dry-run -f'), null);
  assert.equal(dec('git push --force-if-includes'), null);
  assert.equal(dec('git clean -fd'), 'deny');
  assert.equal(dec('git push --force-with-lease --force-if-includes'), 'deny');
});
test('wrapped and shell-in-shell git commands are still caught', () => {
  for (const cmd of ['sudo git push --force', 'bash -c "git reset --hard"', "sh -c 'git push -f'",
    'pwsh -Command "git push --force"', 'if true; then git push --force; fi', '{ git reset --hard; }',
    'git.exe push --force', 'env CI=1 git reset --hard', 'git commit -nm "fix: x"'])
    assert.equal(dec(cmd), 'deny', cmd);
  assert.equal(dec('git push origin HEAD', main), 'deny');
  assert.equal(dec('git push origin HEAD', feat), null);
  assert.equal(dec('bash -c "git status"'), null);
});
test('dependency prompts understand flag values and package-manager variants', () => {
  assert.equal(dec('npm install --prefix ./app'), null);
  assert.equal(dec('pnpm install'), null);
  for (const cmd of ['npm install --prefix ./app lodash', 'pnpm install lodash', 'bun i lodash', 'uv pip install httpx'])
    assert.equal(dec(cmd), 'ask', cmd);
});
test('a path ending in a backslash before the closing quote does not swallow the rest', () => {
  assert.deepEqual(splitCommands('Set-Location "C:\\repo\\"; git push --force'),
    [['Set-Location', 'C:\\repo\\'], ['git', 'push', '--force']]);
  assert.deepEqual(splitCommands('echo "say \\"hi\\" x"'), [['echo', 'say "hi" x']]);
});
test('config-guard understands ./, .. and Git Bash drive paths', () => {
  const ask = (f, dir) => (checkConfigEdit(f, dir, []) || {}).decision || null;
  assert.equal(ask('./.claude/ai-rules.json', '/repo'), 'ask');
  assert.equal(ask('C:\\repo\\src\\..\\.claude\\ai-rules.json', 'C:\\repo'), 'ask');
  assert.equal(ask('/c/repo/.claude/ai-rules.json', 'C:\\repo'), 'ask');
  assert.equal(ask('/repo/src/../src/app.js', '/repo'), null);
  assert.equal(ask('/repo/../other/.claude/ai-rules.json', '/repo'), null);
});
test('without a session id each project gets its own state key', () => {
  assert.equal(sessionKey({ session_id: 'abc' }, '/x'), 'abc');
  const a = sessionKey({}, '/x'), b = sessionKey({}, '/y');
  assert.match(a, /^p[0-9a-f]{12}$/); assert.notEqual(a, b); assert.equal(a, sessionKey({}, '/x'));
});

const FRAG = { hooks: { PreToolUse: [{ matcher: 'Bash', hooks: [
  { type: 'command', command: 'node', args: ['${CLAUDE_PROJECT_DIR}/.claude/ai-rules/scripts/h.cjs'] }] }] },
permissions: { deny: ['Read(./.env)'] } };
const payload = () => makeRepo({
  'managed/rules/ai-rules-core.md': '<!-- Managed by ai-rules. Do not edit; overwritten on sync. -->\n# Core rules\n',
  'settings-fragment.json': JSON.stringify(FRAG),
  'starter/settings.json': JSON.stringify({
    extraKnownMarketplaces: { 'ai-rules-marketplace': { source: { source: 'github', repo: 'a/b' }, autoUpdate: true } },
    enabledPlugins: { 'ai-rules@ai-rules-marketplace': true, 'superpowers@x': true } }),
  'starter/CLAUDE.md': '# P\n' });
test('settings.json with the wrong shape is skipped, not crashed on', () => {
  for (const bad of ['{"hooks":[]}', '{"hooks":{"PreToolUse":[null]}}', '{"hooks":{"PreToolUse":{}}}',
    '{"permissions":{"deny":"x"}}', '{"permissions":[]}', '[]']) {
    const t = makeRepo({ '.claude/settings.json': bad });
    const r = sync.syncRepo({ payloadDir: payload(), targetDir: t });
    assert.equal(fs.readFileSync(path.join(t, '.claude/settings.json'), 'utf8'), bad, bad);
    assert.ok(r.skipped.some((s) => s.reason === 'invalid settings.json'), bad);
    assert.ok(sync.readManifest(t), `${bad}: manifest written`);
  }
});
test('init adds the marketplace and plugins to an existing settings.json without overriding choices', () => {
  const t = makeRepo({ '.claude/settings.json': JSON.stringify({ model: 'x', enabledPlugins: { 'superpowers@x': false } }) });
  sync.syncRepo({ payloadDir: payload(), targetDir: t, init: true });
  const s = JSON.parse(fs.readFileSync(path.join(t, '.claude/settings.json'), 'utf8'));
  assert.equal(s.model, 'x'); assert.equal(s.enabledPlugins['superpowers@x'], false);
  assert.equal(s.enabledPlugins['ai-rules@ai-rules-marketplace'], true);
  assert.equal(s.extraKnownMarketplaces['ai-rules-marketplace'].autoUpdate, true);
  assert.equal(s.hooks.PreToolUse.length, 1);
});

test('the setup offer checks the cheap things first and never scans an already offered repo', () => {
  const data = makeRepo({});
  const repo = makeRepo({}); fs.mkdirSync(path.join(repo, '.git'));
  let scans = 0;
  const fake = () => { scans++; return { isGitRoot: true, stack: ['node'], packageManager: 'npm', commands: { e2e: [], test: [], build: [], lint: [] },
    e2eFramework: null, existing: { claudeMdLines: null, agentsMd: false, settings: false, gitHooks: null }, trackedEnvFiles: [], suggestedSkills: [] }; };
  assert.match(scan.offerText(repo, data, fake), /^ai-rules: this repository is not set up/);
  assert.equal(scans, 1);
  assert.equal(scan.offerText(repo, data, fake), ''); assert.equal(scans, 1);
  assert.equal(scan.offerText(makeRepo({}), data, fake), ''); assert.equal(scans, 1);
});
test('the default data directory is not the temp folder that gets cleaned', () => {
  const saved = process.env.CLAUDE_PLUGIN_DATA; delete process.env.CLAUDE_PLUGIN_DATA;
  try { assert.ok(scan.defaultDataDir().startsWith(path.join(os.homedir(), '.claude'))); } finally { if (saved) process.env.CLAUDE_PLUGIN_DATA = saved; }
});
