const test = require('node:test'); const assert = require('node:assert');
const fs = require('node:fs'); const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const { makeRepo } = require('./helpers.cjs');
const scan = require('../plugins/ai-rules/scripts/scan.cjs');
const sync = require('../plugins/ai-rules/scripts/sync.cjs');
const PAYLOAD = path.resolve('plugins/ai-rules/payload');
const git = (d, ...a) => execFileSync('git', a, { cwd: d });
const gitRepo = (files) => { const d = makeRepo(files); git(d, 'init', '-q'); git(d, 'add', '-A'); return d; };
const pkg = (o) => JSON.stringify(o);

test('node repo with pnpm, playwright, husky and a tracked .env', () => {
  const d = gitRepo({
    'package.json': pkg({ scripts: { test: 'vitest', build: 'tsc', lint: 'eslint .', 'test:e2e': 'playwright test' },
      dependencies: { express: '4', react: '18' }, devDependencies: { '@playwright/test': '1' } }),
    'pnpm-lock.yaml': '', 'CLAUDE.md': 'a\nb\nc\n', '.husky/pre-commit': '', '.env': 'X=1', '.env.example': 'X=' });
  assert.deepEqual(scan.scanRepo(d), {
    isGitRoot: true, stack: ['node'], packageManager: 'pnpm',
    commands: { e2e: ['pnpm run test:e2e'], test: ['pnpm test'], build: ['pnpm run build'], lint: ['pnpm run lint'] },
    e2eFramework: 'playwright',
    existing: { claudeMdLines: 3, agentsMd: false, settings: false, gitHooks: 'husky' },
    trackedEnvFiles: ['.env'], suggestedSkills: ['frontend-design', 'ai-rules-backend-basics'] });
});
test('framework fallback, placeholder test script, default package manager', () => {
  const r = scan.scanRepo(gitRepo({ 'package.json': pkg({
    scripts: { test: 'echo "Error: no test specified" && exit 1' }, devDependencies: { cypress: '13' } }) }));
  assert.deepEqual(r.commands, { e2e: ['npx cypress run'], test: [], build: [], lint: [] });
  assert.equal(r.packageManager, 'npm'); assert.deepEqual(r.suggestedSkills, []);
});
test('other stacks, broken package.json, empty and non-git folders', () => {
  const go = scan.scanRepo(gitRepo({ 'go.mod': '' }));
  assert.deepEqual(go.stack, ['go']); assert.deepEqual(go.suggestedSkills, ['ai-rules-backend-basics']);
  assert.deepEqual(go.commands, { e2e: [], test: [], build: [], lint: [] });
  const broken = scan.scanRepo(gitRepo({ 'package.json': '{broken' }));
  assert.deepEqual(broken.stack, ['node']); assert.equal(broken.e2eFramework, null);
  assert.deepEqual(scan.scanRepo(gitRepo({})).stack, []);
  const plain = scan.scanRepo(makeRepo({ 'package.json': '{}' }));
  assert.equal(plain.isGitRoot, false); assert.deepEqual(plain.trackedEnvFiles, []);
});
test('formatReport', () => {
  const d = gitRepo({ 'package.json': pkg({ scripts: { test: 'vitest' }, dependencies: { react: '18' },
    devDependencies: { '@playwright/test': '1' } }), 'pnpm-lock.yaml': '', 'CLAUDE.md': 'a\nb\nc\n',
    '.husky/pre-commit': '', '.env': 'X=1' });
  const lines = scan.formatReport(scan.scanRepo(d));
  assert.deepEqual(lines, [
    'Stack: node (pnpm), e2e: playwright',
    'Commands: test "pnpm test"; e2e "npx playwright test"',
    'Existing CLAUDE.md (3 lines): will be kept as is',
    'Existing git hooks (husky): the commit message check will not be installed',
    'Tracked env files: .env — suggest removing them from git',
    'Suggested skills: frontend-design' ]);
  assert.deepEqual(scan.formatReport(scan.scanRepo(gitRepo({}))), ['Stack: unknown']);
});
test('offered repos are remembered regardless of path style', () => {
  const data = makeRepo({});
  assert.equal(scan.wasOffered(data, 'C:\\Work\\Repo'), false);
  scan.markOffered(data, 'C:\\Work\\Repo');
  assert.equal(scan.wasOffered(data, 'c:/work/repo'), true);
  assert.equal(scan.wasOffered(data, 'c:/work/other'), false);
});
test('sync-check offers setup once per unconfigured git repo', () => {
  const data = makeRepo({});
  const check = (dir, env = {}) => spawnSync('node', ['plugins/ai-rules/scripts/sync-check.cjs'], {
    input: JSON.stringify({ session_id: 's', cwd: dir, hook_event_name: 'SessionStart' }), encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: dir, CLAUDE_PLUGIN_DATA: data, CLAUDE_CODE_REMOTE: '', ...env } }).stdout;
  const d = gitRepo({ 'package.json': pkg({ scripts: { test: 'vitest' } }) });
  const first = check(d);
  assert.match(first, /^ai-rules: this repository is not set up with ai-rules\. Quick scan:\n- Stack: node \(npm\)/);
  assert.match(first, /ai-rules:init-repo/);
  assert.equal(check(d), '');
  assert.equal(check(gitRepo({}), { CLAUDE_CODE_REMOTE: 'true' }), '');
  assert.equal(check(makeRepo({ 'package.json': '{}' })), '');
  assert.match(check(gitRepo({ '.claude/ai-rules.json': '{}' })), /^ai-rules: an update is available \(none -> /);
});
test('init fills verify.commands from the scan only when it creates the config', () => {
  const fresh = gitRepo({ 'package.json': pkg({ scripts: { test: 'vitest', 'e2e': 'playwright test' } }) });
  const r = sync.syncRepo({ payloadDir: PAYLOAD, targetDir: fresh, init: true });
  const cfg = JSON.parse(fs.readFileSync(path.join(fresh, '.claude/ai-rules.json'), 'utf8'));
  assert.deepEqual(cfg.verify.commands, { e2e: ['npm run e2e'], test: ['npm test'] });
  assert.equal(cfg.source, 'phong190897/ai-rules'); assert.deepEqual(r.scan.stack, ['node']);
  const kept = gitRepo({ 'package.json': pkg({ scripts: { test: 'vitest' } }), '.claude/ai-rules.json': '{"mainBranch":"dev"}' });
  sync.syncRepo({ payloadDir: PAYLOAD, targetDir: kept, init: true });
  assert.equal(fs.readFileSync(path.join(kept, '.claude/ai-rules.json'), 'utf8'), '{"mainBranch":"dev"}');
});
