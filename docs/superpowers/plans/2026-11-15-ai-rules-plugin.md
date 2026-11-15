# ai-rules Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây repo `phong190897/ai-rules`: một plugin Claude Code giữ rules, hooks, skills dùng chung và đồng bộ một bản sao được quản lý vào từng repo con, chạy được ở máy lẫn phiên cloud.

**Architecture:** Repo gốc vừa là marketplace vừa chứa plugin `ai-rules`. Plugin chỉ có ba việc: giữ `payload/` (nội dung gốc), đồng bộ payload vào repo con (`sync.cjs`), và báo khi có bản mới. Mọi hook chặn, rule và skill chạy từ bản sao đã commit trong repo con, nên máy và cloud hành xử giống nhau.

**Tech Stack:** Node.js ≥ 20 (CommonJS, không thư viện ngoài), `node:test` + `node:assert`, Markdown, JSON, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-15-ai-rules-plugin-design.md`

## Global Constraints

- Node.js ≥ 20; **không** thêm dependency nào. Test bằng `node --test`.
- Mọi script có đuôi **`.cjs`** (repo con có thể đặt `"type": "module"`, khi đó file `.js` sẽ bị hiểu là ESM và hỏng).
- Hook **không bao giờ chặn vì lỗi của chính nó**: mọi ngoại lệ, stdin rỗng hoặc sai JSON → thoát mã 0, không in gì.
- Mọi thông điệp gửi cho AI bắt đầu bằng `ai-rules:` và viết bằng tiếng Anh.
- Rules và skills viết bằng tiếng Anh. Rule cốt lõi ≤ 40 dòng. `backend-basics` và `security-basics` ≤ 100 dòng. Mọi skill ≤ 150 dòng.
- Mọi file `.md` và `.cjs` dưới `payload/managed/` chứa chuỗi `Managed by ai-rules. Do not edit; overwritten on sync.` (`.cjs`: comment ở dòng đầu; `SKILL.md`: comment HTML ngay sau frontmatter; `.md` khác: comment HTML ở dòng đầu).
- File sinh ra luôn dùng xuống dòng LF. JSON ghi ra thụt 2 dấu cách, có dòng trống cuối.
- Tên cố định: marketplace `ai-rules-marketplace`, plugin `ai-rules`, tiền tố skill `ai-rules-`, nguồn `phong190897/ai-rules`, nhánh chính `main`.
- Giá trị mặc định: `maxFailedRunsWithoutChange` 2, `maxE2eFailedRunsPerTurn` 4, `repeatNudgeAfter` 3, `turnNudgeAfterToolCalls` 100, tiêu đề ≤ 72 ký tự.
- Chuỗi secret giả trong test phải ghép bằng phép nối chuỗi (`'AKIA' + '…'`), không viết liền, để không bị hook và GitHub chặn.
- Sau commit đầu tiên, mọi việc làm trên nhánh `feat/ai-rules-plugin`. **Không push** khi người dùng chưa yêu cầu.

## Điểm khác với bản thiết kế (do người lập kế hoạch quyết định)

1. Script đuôi `.cjs` thay vì `.js` (lý do ở trên).
2. Bốn script đầu vào theo sự kiện (`hook-session-start`, `hook-user-prompt`, `hook-pre-tool`, `hook-post-tool`) gọi các module trong `guards/`, thay vì mỗi hook một script. Ít tiến trình hơn; logic vẫn tách theo từng guard như bảng ở mục 8 của spec.
3. Hook `commit-msg` được **chép vào thư mục hooks của git** (`.git/hooks/`) thay vì đổi `core.hooksPath`. Lý do: file commit từ Windows không giữ được quyền thực thi nên git trên Linux/cloud sẽ bỏ qua; và cách này không vô hiệu hoá hook sẵn có trong `.git/hooks`.
4. `AGENTS.md` được **sinh ra** từ rule cốt lõi và frontmatter của các skill, không có file nguồn riêng.
5. Phần hook và permission để trộn nằm ở `payload/settings-fragment.json`, ngoài `managed/`, vì nó không được chép nguyên vào repo con.
6. Trong repo con, thiếu `.claude/ai-rules.json` thì hook dùng giá trị mặc định. File này chỉ là "dấu hiệu bật" đối với `sync-check.cjs` của plugin.
7. README viết bằng tiếng Việt.

## Review Focus

1. **Lệnh ghép và lệnh có chuỗi trong ngoặc kép** (`cd app && git push --force`; `git commit -m "docs: explain git reset --hard"`): phải chặn lệnh thật, không chặn chữ nằm trong chuỗi. → test ở Task 3 và Task 5.
2. **Đầu vào hỏng** (stdin rỗng, không phải JSON, thiếu `tool_input`, `ai-rules.json` sai cú pháp): hook thoát 0, không chặn. → test ở Task 2 và Task 8.
3. **Đường dẫn Windows và CRLF** (`C:\repo\.claude\ai-rules.json`; payload bị đổi thành CRLF; commit message có `\r\n`): kết quả như với `/` và LF. → test ở Task 7, Task 9, Task 10.
4. **File trạng thái hỏng do nhiều hook ghi cùng lúc** (subagent chạy song song): đọc được trạng thái mặc định, không ném lỗi. → test ở Task 2.
5. **`settings.json` sẵn có của repo con** (đã có hook và permission riêng, hoặc sai JSON): giữ nguyên phần riêng; file sai JSON thì không đụng vào. → test ở Task 10.

---

## File Structure

Ký hiệu: `<S>` = `plugins/ai-rules/payload/managed/ai-rules/scripts`, `<P>` = `plugins/ai-rules`.

| File | Trách nhiệm |
|---|---|
| `.claude-plugin/marketplace.json` | Khai báo marketplace |
| `<P>/.claude-plugin/plugin.json` | Khai báo plugin |
| `<P>/hooks/hooks.json` | Hook `SessionStart` của plugin → `sync-check.cjs` |
| `<P>/scripts/sync.cjs` | Đồng bộ payload vào repo con; CLI và hàm |
| `<P>/scripts/sync-check.cjs` | So phiên bản, in một dòng thông báo; gợi ý thiết lập repo mới |
| `<P>/scripts/scan.cjs` | Quét nhanh repo chưa thiết lập; nhớ repo đã được gợi ý |
| `<P>/skills/init-repo/SKILL.md`, `<P>/skills/sync-repo/SKILL.md` | Skill của plugin |
| `<P>/payload/settings-fragment.json` | Hook và permission trộn vào `settings.json` repo con |
| `<P>/payload/starter/*` | File tạo một lần |
| `<P>/payload/managed/rules/ai-rules-core.md` | Rule cốt lõi |
| `<P>/payload/managed/skills/ai-rules-*/SKILL.md` | 7 skill nội dung |
| `<P>/payload/managed/ai-rules/catalog.md` | Danh mục skill đã duyệt |
| `<S>/lib/io.cjs` | Đọc stdin, in quyết định, bọc lỗi |
| `<S>/lib/config.cjs` | Mặc định + đọc `.claude/ai-rules.json` |
| `<S>/lib/state.cjs` | Trạng thái theo phiên trong thư mục tạm |
| `<S>/lib/conventions.cjs` | Chuẩn tiêu đề và mục PR |
| `<S>/lib/commands.cjs` | Tách lệnh, phân loại lệnh kiểm tra |
| `<S>/lib/git-hook.cjs` | Cài shim `commit-msg` |
| `<S>/guards/*.cjs` | `verify`, `repeat-nudge`, `turn-budget`, `danger`, `pr-check`, `config-guard`, `secret`, `test-weakening` |
| `<S>/hook-*.cjs` | 4 script đầu vào |
| `<S>/git-commit-msg.cjs` | Kiểm tra commit message |
| `tests/*.test.cjs`, `tests/helpers.cjs` | Test |

Ánh xạ payload → repo con (dùng trong `sync.cjs`):

| Nguồn | Đích |
|---|---|
| `payload/managed/rules/**` | `.claude/rules/**` |
| `payload/managed/skills/**` | `.claude/skills/**` |
| `payload/managed/ai-rules/**` | `.claude/ai-rules/**` |
| (sinh ra) | `AGENTS.md` |
| `payload/starter/CLAUDE.md` | `CLAUDE.md` |
| `payload/starter/ai-rules.json` | `.claude/ai-rules.json` |
| `payload/starter/settings.json` | `.claude/settings.json` |
| `payload/starter/known-issues.md` | `.claude/known-issues.md` |
| `payload/starter/ai-rules-sync.yml` | `.github/workflows/ai-rules-sync.yml` |

---

### Task 1: Khung repo, marketplace và plugin

**Files:**
- Create: `.gitignore`, `.gitattributes`, `package.json`, `.claude-plugin/marketplace.json`, `plugins/ai-rules/.claude-plugin/plugin.json`
- Test: `tests/plugin-manifest.test.cjs`

**Interfaces:**
- Produces: lệnh `npm test` (= `node --test`); cấu trúc thư mục `<P>`.

- [ ] **Step 1: Khởi tạo git**

```bash
git init -b main
git remote add origin https://github.com/phong190897/ai-rules.git
```

- [ ] **Step 2: Viết test fail**

```js
// tests/plugin-manifest.test.cjs
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

test('marketplace declares the ai-rules plugin', () => {
  const m = read('.claude-plugin/marketplace.json');
  assert.equal(m.name, 'ai-rules-marketplace');
  assert.equal(m.owner.name, 'phong190897');
  assert.deepEqual(m.plugins, [{ name: 'ai-rules', source: './plugins/ai-rules' }]);
});

test('plugin manifest has a name and no version', () => {
  const p = read('plugins/ai-rules/.claude-plugin/plugin.json');
  assert.equal(p.name, 'ai-rules');
  assert.equal('version' in p, false);
});
```

- [ ] **Step 3: Chạy test, xác nhận fail**

Run: `node --test tests/plugin-manifest.test.cjs` — Expected: FAIL (ENOENT).

- [ ] **Step 4: Tạo các file**

- `package.json`: `{"name":"ai-rules","private":true,"engines":{"node":">=20"},"scripts":{"test":"node --test"}}`
- `.gitattributes`: `* text=auto eol=lf`
- `.gitignore`: `node_modules/`, `*.log`, `.claude/settings.local.json`
- `marketplace.json` và `plugin.json` đúng như test; `plugin.json` thêm `"description": "Shared rules, hooks and skills for AI-written repositories"`.

- [ ] **Step 5: Chạy test, xác nhận pass**

Run: `npm test` — Expected: 2 pass.

- [ ] **Step 6: Commit đầu tiên trên `main`, rồi tạo nhánh làm việc**

```bash
git add -A
git commit -m "chore: scaffold ai-rules marketplace and plugin"
git switch -c feat/ai-rules-plugin
```

---

### Task 2: Thư viện nền (`io`, `config`, `state`, `conventions`)

**Files:**
- Create: `<S>/lib/io.cjs`, `<S>/lib/config.cjs`, `<S>/lib/state.cjs`, `<S>/lib/conventions.cjs`
- Test: `tests/lib.test.cjs`

**Interfaces — Produces:**

```js
// io.cjs
parseInput(text: string): object            // {} nếu rỗng hoặc sai JSON
readInput(): object                         // đọc toàn bộ stdin rồi parseInput
projectDir(input): string                   // env CLAUDE_PROJECT_DIR || input.cwd || process.cwd()
preToolDecision(decision: 'deny'|'ask', reason: string): object
contextOutput(eventName: string, text: string): object
commandFailed(input): boolean
runSafely(fn: (input: object) => void): void  // readInput rồi gọi fn trong try/catch → luôn thoát 0; env AI_RULES_DEBUG=1 thì ghi input vào <tmp>/ai-rules/debug.log

// config.cjs
DEFAULTS: object
mergeConfig(raw: object|null): object       // trộn sâu với DEFAULTS
loadConfig(projectDir: string): object      // thiếu file hoặc sai JSON → DEFAULTS

// state.cjs
newState(): State
loadState(sessionId: string): State         // file thiếu hoặc hỏng → newState()
saveState(sessionId: string, state: State): void   // ghi file tạm rồi rename
resetTurn(state): State                     // giữ preflightPassed
resetOnEdit(state): State
cleanupOldStates(maxAgeDays = 7): number
// thư mục: env AI_RULES_STATE_DIR || path.join(os.tmpdir(), 'ai-rules'); file: <sessionId>.json
// sessionId lọc còn [A-Za-z0-9_-]; thiếu hoặc rỗng → 'unknown'

// conventions.cjs
TITLE_TYPES = ['feat','fix','refactor','docs','test','chore','perf','build','ci']
TITLE_MAX = 72
PR_SECTIONS = ['## Summary','## Why','## Changes','## Testing']
checkTitle(title: string): string|null      // null = hợp lệ; chuỗi = lý do
```

Hình dạng cố định:

```js
// DEFAULTS
{ source: 'phong190897/ai-rules', mainBranch: 'main',
  guards: { verify: true, repeatNudge: true, turnBudget: true, testWeakening: true, prCheck: true,
            danger: true, dependencies: true, config: true, secrets: true, commitMsg: true },
  verify: { commands: { e2e: [], test: [], build: [], lint: [] }, e2ePreflight: null,
            maxFailedRunsWithoutChange: 2, maxE2eFailedRunsPerTurn: 4 },
  repeatNudgeAfter: 3, turnNudgeAfterToolCalls: 100, commitMsg: { scope: 'ai' } }

// State
{ turn: { toolCalls: 0, e2eFailed: 0 },
  failedWithoutChange: { e2e: 0, test: 0, build: 0, lint: 0 },
  lastFailed: { command: '', count: 0 }, preflightPassed: false }

// preToolDecision → { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision, permissionDecisionReason } }
// contextOutput   → { hookSpecificOutput: { hookEventName, additionalContext } }
```

`commandFailed(input)` trả `true` khi: `hook_event_name === 'PostToolUseFailure'`; hoặc `tool_response` là object có `exitCode`/`exit_code`/`code` là số khác 0, hoặc `is_error === true`, hoặc `interrupted === true`; hoặc `tool_response` là chuỗi khớp `/^Exit code [1-9]/`. Mọi trường hợp khác: `false`. (Task 15 kiểm chứng với Claude Code thật.)

`checkTitle`: regex `^(feat|fix|refactor|docs|test|chore|perf|build|ci)(\([a-z0-9._\/-]+\))?!?: \S.*$`, và độ dài ≤ 72.

- [ ] **Step 1: Viết test fail**

```js
// tests/lib.test.cjs
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const S = '../plugins/ai-rules/payload/managed/ai-rules/scripts';
const io = require(`${S}/lib/io.cjs`);
const { DEFAULTS, mergeConfig, loadConfig } = require(`${S}/lib/config.cjs`);
const st = require(`${S}/lib/state.cjs`);
const { checkTitle } = require(`${S}/lib/conventions.cjs`);
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'air-'));

test('parseInput tolerates empty and invalid input', () => {
  assert.deepEqual(io.parseInput(''), {});
  assert.deepEqual(io.parseInput('not json'), {});
  assert.deepEqual(io.parseInput('{"a":1}'), { a: 1 });
});
test('commandFailed', () => {
  assert.equal(io.commandFailed({ hook_event_name: 'PostToolUseFailure' }), true);
  assert.equal(io.commandFailed({ tool_response: { exitCode: 1 } }), true);
  assert.equal(io.commandFailed({ tool_response: { exit_code: 0 } }), false);
  assert.equal(io.commandFailed({ tool_response: { is_error: true } }), true);
  assert.equal(io.commandFailed({ tool_response: 'Exit code 2\nboom' }), true);
  assert.equal(io.commandFailed({ tool_response: { stdout: 'ok' } }), false);
  assert.equal(io.commandFailed({}), false);
});
test('decision shapes', () => {
  assert.deepEqual(io.preToolDecision('deny', 'ai-rules: x').hookSpecificOutput,
    { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: 'ai-rules: x' });
  assert.deepEqual(io.contextOutput('PostToolUse', 'hi').hookSpecificOutput,
    { hookEventName: 'PostToolUse', additionalContext: 'hi' });
});
test('config merges deeply and survives bad files', () => {
  const c = mergeConfig({ guards: { danger: false }, verify: { commands: { e2e: ['npm run e2e'] } } });
  assert.equal(c.guards.danger, false); assert.equal(c.guards.verify, true);
  assert.deepEqual(c.verify.commands.e2e, ['npm run e2e']);
  assert.equal(c.verify.maxFailedRunsWithoutChange, 2);
  const d = tmp(); assert.deepEqual(loadConfig(d), DEFAULTS);
  fs.mkdirSync(path.join(d, '.claude')); fs.writeFileSync(path.join(d, '.claude/ai-rules.json'), '{broken');
  assert.deepEqual(loadConfig(d), DEFAULTS);
});
test('state round-trips, recovers from corruption, resets', () => {
  process.env.AI_RULES_STATE_DIR = tmp();
  const s = st.newState(); s.turn.toolCalls = 5; s.failedWithoutChange.e2e = 2; s.preflightPassed = true;
  st.saveState('abc/../x', s);
  assert.equal(st.loadState('abc/../x').turn.toolCalls, 5);
  fs.writeFileSync(path.join(process.env.AI_RULES_STATE_DIR, 'bad.json'), '{"turn":');
  assert.deepEqual(st.loadState('bad'), st.newState());
  const r = st.resetTurn(s);
  assert.equal(r.turn.toolCalls, 0); assert.equal(r.failedWithoutChange.e2e, 0); assert.equal(r.preflightPassed, true);
  s.failedWithoutChange.test = 1; s.lastFailed = { command: 'x', count: 2 };
  const e = st.resetOnEdit(s);
  assert.equal(e.failedWithoutChange.test, 0); assert.equal(e.lastFailed.count, 0);
});
test('checkTitle', () => {
  for (const ok of ['feat: add login', 'fix(api): handle 404', 'feat!: drop v1', 'chore(deps-dev): bump x'])
    assert.equal(checkTitle(ok), null, ok);
  for (const bad of ['Add login', 'feature: x', 'feat:x', 'feat: ' + 'a'.repeat(70)])
    assert.equal(typeof checkTitle(bad), 'string', bad);
});
```

- [ ] **Step 2: Chạy test, xác nhận fail** — Run: `node --test tests/lib.test.cjs` — Expected: FAIL (Cannot find module).
- [ ] **Step 3: Viết bốn module theo Interfaces.** Dòng đầu mỗi file: `// Managed by ai-rules. Do not edit; overwritten on sync.`
- [ ] **Step 4: Chạy test, xác nhận pass** — Run: `node --test tests/lib.test.cjs` — Expected: 6 pass.
- [ ] **Step 5: Commit** — `git add tests/lib.test.cjs plugins && git commit -m "feat(hooks): add io, config, state and conventions libraries"`

---

### Task 3: Tách và phân loại lệnh

**Files:**
- Create: `<S>/lib/commands.cjs`
- Test: `tests/commands.test.cjs`

**Interfaces:**
- Consumes: `DEFAULTS`, `mergeConfig` (Task 2).
- Produces:

```js
splitCommands(command: string): string[][]   // mỗi phần tử = token của một lệnh con
normalizeCommand(command: string): string    // trim, gộp khoảng trắng
classifyCommand(command: string, config): 'preflight'|'e2e'|'test'|'build'|'lint'|null
```

Quy tắc `splitCommands`: tách ở `&&`, `||`, `;`, `|`, xuống dòng **khi nằm ngoài ngoặc đơn/kép**; token tách theo khoảng trắng ngoài ngoặc; bỏ dấu ngoặc bao token; bỏ các token `TÊN=giá_trị` ở đầu mỗi lệnh con.

Quy tắc `classifyCommand`: xét từng lệnh con dưới dạng `tokens.join(' ')`; khớp khi chuỗi đó **chứa** một mẫu. Thứ tự: `preflight` (`config.verify.e2ePreflight`), `e2e`, `test`, `build`, `lint`. Khi `commands.e2e` rỗng, dùng mẫu mặc định: `playwright test`, `cypress run`, và regex `\b(npm|pnpm|yarn|bun)\s+(run\s+)?\S*e2e\S*`. Ba loại còn lại không có mẫu mặc định.

- [ ] **Step 1: Viết test fail**

```js
// tests/commands.test.cjs
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
```

- [ ] **Step 2: Chạy, xác nhận fail** — Run: `node --test tests/commands.test.cjs`
- [ ] **Step 3: Viết `commands.cjs`** theo Interfaces.
- [ ] **Step 4: Chạy, xác nhận pass** — Expected: 3 pass.
- [ ] **Step 5: Commit** — `git commit -am "feat(hooks): add command splitting and classification"` (sau `git add` file mới).

---

### Task 4: Bộ đếm chạy lại (`verify`, `repeat-nudge`, `turn-budget`)

**Files:**
- Create: `<S>/guards/verify.cjs`, `<S>/guards/repeat-nudge.cjs`, `<S>/guards/turn-budget.cjs`
- Test: `tests/counters.test.cjs`

**Interfaces:**
- Consumes: `classifyCommand`, `normalizeCommand` (Task 3); `State`, `newState`, `resetOnEdit`, `resetTurn` (Task 2).
- Produces:

```js
// verify.cjs
checkVerify(command, config, state): { decision: 'deny', reason: string } | null   // không đổi state
recordResult(command, failed: boolean, config, state): boolean   // true nếu lệnh là preflight hoặc lệnh kiểm tra; có đổi state
// repeat-nudge.cjs
recordOther(command, failed: boolean, config, state): string | null   // có đổi state
// turn-budget.cjs
tick(config, state): string | null   // có đổi state
```

Hành vi:

- `checkVerify` trả `null` khi `guards.verify` tắt hoặc lệnh không thuộc 4 loại. Thứ tự kiểm tra: (1) loại `e2e`, có `e2ePreflight`, `preflightPassed` false → deny; (2) `failedWithoutChange[kind] >= maxFailedRunsWithoutChange` → deny; (3) loại `e2e` và `turn.e2eFailed >= maxE2eFailedRunsPerTurn` → deny.
- `recordResult`: `preflight` pass → `preflightPassed = true`. Lệnh kiểm tra fail → `failedWithoutChange[kind]++`, e2e thì thêm `turn.e2eFailed++`. Lệnh kiểm tra pass → `failedWithoutChange[kind] = 0`.
- `recordOther`: fail và cùng lệnh (đã normalize) với `lastFailed` → `count++`, khác lệnh → `{command, count: 1}`; pass → đặt lại `lastFailed`. Trả thông điệp **đúng lúc** `count === repeatNudgeAfter`. `guards.repeatNudge` tắt → luôn `null`.
- `tick`: `turn.toolCalls++`; trả thông điệp khi `turnNudgeAfterToolCalls > 0` và `toolCalls % turnNudgeAfterToolCalls === 0`. `guards.turnBudget` tắt → `null`.

Thông điệp cố định (`{…}` là giá trị thay vào):

- Preflight: ``ai-rules: run the environment preflight before e2e: `{cmd}`.``
- Giới hạn không đổi: ``ai-rules: `{kind}` has failed {n} times in a row with no file changes. Stop re-running it. Classify the failure with the ai-rules-handling-failures skill (read .claude/known-issues.md first) and report to the user with evidence. The limit resets when the user sends a new message.``
- Giới hạn lượt: `ai-rules: e2e has failed {n} times this turn. Stop and report to the user with evidence. The limit resets when the user sends a new message.`
- Nhắc lặp: `ai-rules: the same command has failed {n} times with no changes in between. Stop repeating it; find the cause or report to the user.`
- Nhắc lượt dài: `ai-rules: {n} tool calls this turn. If the task is not converging, stop and give the user a short status; otherwise continue.`

- [ ] **Step 1: Viết test fail**

```js
// tests/counters.test.cjs
const test = require('node:test'); const assert = require('node:assert');
const S = '../plugins/ai-rules/payload/managed/ai-rules/scripts';
const { checkVerify, recordResult } = require(`${S}/guards/verify.cjs`);
const { recordOther } = require(`${S}/guards/repeat-nudge.cjs`);
const { tick } = require(`${S}/guards/turn-budget.cjs`);
const { mergeConfig } = require(`${S}/lib/config.cjs`);
const { newState, resetOnEdit, resetTurn } = require(`${S}/lib/state.cjs`);
const cfg = (o = {}) => mergeConfig({ verify: { commands: { e2e: ['npm run e2e'], test: ['npm test'] }, ...o } });
const E = 'npm run e2e', T = 'npm test';

test('third consecutive failure without edits is blocked', () => {
  const c = cfg(), s = newState();
  assert.equal(checkVerify(E, c, s), null); recordResult(E, true, c, s);
  assert.equal(checkVerify(E, c, s), null); recordResult(E, true, c, s);
  const d = checkVerify(E, c, s);
  assert.equal(d.decision, 'deny'); assert.match(d.reason, /^ai-rules: `e2e` has failed 2 times/);
});
test('passing runs are never blocked', () => {
  const c = cfg(), s = newState();
  for (let i = 0; i < 20; i++) { assert.equal(checkVerify(E, c, s), null); recordResult(E, false, c, s); }
});
test('TDD cycle (fail, edit, pass) repeated is never blocked', () => {
  const c = cfg(), s = newState();
  for (let i = 0; i < 10; i++) {
    assert.equal(checkVerify(T, c, s), null); recordResult(T, true, c, s); resetOnEdit(s);
    assert.equal(checkVerify(T, c, s), null); recordResult(T, false, c, s);
  }
});
test('e2e per-turn cap applies even with edits, and resets on a new turn', () => {
  const c = cfg(), s = newState();
  for (let i = 0; i < 4; i++) { assert.equal(checkVerify(E, c, s), null); recordResult(E, true, c, s); resetOnEdit(s); }
  assert.match(checkVerify(E, c, s).reason, /4 times this turn/);
  resetTurn(s); assert.equal(checkVerify(E, c, s), null);
});
test('per-turn cap does not apply to unit tests', () => {
  const c = cfg(), s = newState();
  for (let i = 0; i < 10; i++) { recordResult(T, true, c, s); resetOnEdit(s); }
  assert.equal(checkVerify(T, c, s), null);
});
test('preflight must pass once per session before e2e', () => {
  const c = cfg({ e2ePreflight: 'node scripts/check-env.js' }), s = newState();
  assert.match(checkVerify(E, c, s).reason, /preflight before e2e: `node scripts\/check-env.js`/);
  recordResult('node scripts/check-env.js', true, c, s); assert.equal(checkVerify(E, c, s).decision, 'deny');
  recordResult('node scripts/check-env.js', false, c, s); assert.equal(checkVerify(E, c, s), null);
  resetTurn(s); assert.equal(checkVerify(E, c, s), null);
});
test('guard off and undeclared commands', () => {
  const s = newState(); s.failedWithoutChange.e2e = 9;
  assert.equal(checkVerify(E, mergeConfig({ guards: { verify: false } }), s), null);
  assert.equal(checkVerify('ls', cfg(), s), null);
  assert.equal(recordResult('ls', true, cfg(), s), false);
});
test('repeat nudge fires once at the threshold', () => {
  const c = cfg(), s = newState();
  assert.equal(recordOther('curl  x', true, c, s), null);
  assert.equal(recordOther('curl x', true, c, s), null);
  assert.match(recordOther('curl x', true, c, s), /same command has failed 3 times/);
  assert.equal(recordOther('curl x', true, c, s), null);
  assert.equal(recordOther('curl y', true, c, s), null);
});
test('turn budget nudges at each multiple', () => {
  const c = mergeConfig({ turnNudgeAfterToolCalls: 3 }), s = newState();
  assert.equal(tick(c, s), null); assert.equal(tick(c, s), null);
  assert.match(tick(c, s), /^ai-rules: 3 tool calls this turn/);
  tick(c, s); tick(c, s); assert.match(tick(c, s), /6 tool calls/);
  assert.equal(tick(mergeConfig({ turnNudgeAfterToolCalls: 0 }), newState()), null);
});
```

- [ ] **Step 2: Chạy, xác nhận fail** — Run: `node --test tests/counters.test.cjs`
- [ ] **Step 3: Viết ba module** theo Interfaces và thông điệp cố định.
- [ ] **Step 4: Chạy, xác nhận pass** — Expected: 9 pass.
- [ ] **Step 5: Commit** — `feat(hooks): add verify limits, repeat nudge and turn budget`

---

### Task 5: Chặn lệnh nguy hiểm và hỏi khi cài dependency

**Files:**
- Create: `<S>/guards/danger.cjs`
- Test: `tests/danger.test.cjs`

**Interfaces:**
- Consumes: `splitCommands` (Task 3).
- Produces: `checkDanger(command, config, ctx: { currentBranch: string|null, hasCommits: boolean }): { decision: 'deny'|'ask', reason: string } | null`

Chỉ xét lệnh con có token đầu là tên công cụ tương ứng (ví dụ `git`), nhờ đó chữ trong chuỗi không bị tính. Deny thắng ask.

**Deny** (khi `guards.danger` bật):

| Lệnh con | Điều kiện |
|---|---|
| `git push` | có `--force`, `-f`, `--force-with-lease`, hoặc refspec bắt đầu bằng `+` |
| `git push` | có đối số `main` hoặc kết thúc bằng `:main` (theo `config.mainBranch`); hoặc không có refspec và `ctx.currentBranch === mainBranch` |
| `git commit` | `ctx.currentBranch === mainBranch` **và** `ctx.hasCommits` |
| `git commit`, `git push` | có `--no-verify`; riêng `git commit` thêm token `-n` đứng riêng |
| `git reset` | có `--hard` |
| `git clean` | có `--force` hoặc cờ ngắn chứa `f` (`-f`, `-fd`, `-xfd`) |
| `git add` | có đối số mà tên file là `.env` hoặc `.env.<x>`, trừ đuôi `.example`, `.sample`, `.template` |

**Ask** (khi `guards.dependencies` bật): lệnh cài có **ít nhất một đối số không phải cờ** sau động từ:
`npm install|i|add`, `pnpm add`, `yarn add`, `bun add`, `pip install` (bỏ qua khi có `-r`, `-e`, hoặc đối số là `.`), `uv add`, `poetry add`, `cargo add`, `go get` (bỏ qua đối số bắt đầu bằng `.`), `dotnet add … package`, `composer require`, `gem install`, `bundle add`.

Lý do bắt đầu bằng `ai-rules:` và nêu tên luật; lý do của ask nêu tên gói.

- [ ] **Step 1: Viết test fail**

```js
// tests/danger.test.cjs
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
```

- [ ] **Step 2: Chạy, xác nhận fail** — Run: `node --test tests/danger.test.cjs`
- [ ] **Step 3: Viết `danger.cjs`** theo hai bảng trên.
- [ ] **Step 4: Chạy, xác nhận pass** — Expected: 5 pass.
- [ ] **Step 5: Commit** — `feat(hooks): add danger guard and dependency prompt`

---

### Task 6: Kiểm tra PR

**Files:**
- Create: `<S>/guards/pr-check.cjs`
- Test: `tests/pr-check.test.cjs`

**Interfaces:**
- Consumes: `splitCommands` (Task 3); `checkTitle`, `PR_SECTIONS` (Task 2).
- Produces: `checkPr(command: string, readFile: (path: string) => string|null): { decision: 'deny', reason: string } | null`

Hành vi:

- Chỉ áp dụng khi có lệnh con bắt đầu bằng `gh pr create`. Có `--fill`, `--fill-first`, `--fill-verbose`, `--web` hoặc `--template` → `null`.
- **Tiêu đề:** giá trị của `--title`/`-t` (kể cả dạng `--title=…`). Không tìm thấy → bỏ qua kiểm tra tiêu đề. Tìm thấy → `checkTitle`.
- **Nội dung:** nếu có `--body-file`/`-F`: giá trị `-` → bỏ qua; ngược lại `readFile(path)`, `null` → bỏ qua, có nội dung → tìm các mục trong đó. Nếu không có `--body-file`: tìm các mục **trong toàn bộ chuỗi lệnh gốc** (cách Claude hay viết là `--body "$(cat <<'EOF' … EOF)"`, nội dung nằm ngay trong lệnh). Không có cả `--body` lẫn `--body-file` → bỏ qua kiểm tra nội dung.
- Thiếu mục nào thì `reason` liệt kê đủ các mục thiếu.

- [ ] **Step 1: Viết test fail**

```js
// tests/pr-check.test.cjs
const test = require('node:test'); const assert = require('node:assert');
const S = '../plugins/ai-rules/payload/managed/ai-rules/scripts';
const { checkPr } = require(`${S}/guards/pr-check.cjs`);
const BODY = '## Summary\nx\n\n## Why\ny\n\n## Changes\nz\n\n## Testing\nw';
const heredoc = (title, body) => `gh pr create --title "${title}" --body "$(cat <<'EOF'\n${body}\nEOF\n)"`;
const none = () => null;

test('valid PR passes', () => {
  assert.equal(checkPr(heredoc('feat(api): add login', BODY), none), null);
  assert.equal(checkPr(`gh pr create -t "fix: handle 404" -b "${BODY}"`, none), null);
  assert.equal(checkPr(`gh pr create --title="feat!: drop v1" --body "${BODY}"`, none), null);
});
test('bad title is denied', () => {
  assert.match(checkPr(heredoc('Add login', BODY), none).reason, /^ai-rules: .*title/i);
  assert.equal(checkPr(heredoc('feat: ' + 'a'.repeat(70), BODY), none).decision, 'deny');
});
test('missing sections are listed', () => {
  const r = checkPr(heredoc('feat: add login', '## Summary\nx\n## Changes\nz'), none).reason;
  assert.match(r, /## Why/); assert.match(r, /## Testing/); assert.doesNotMatch(r, /## Summary/);
});
test('body file', () => {
  const cmd = 'gh pr create --title "fix: x" --body-file pr.md';
  assert.equal(checkPr(cmd, () => BODY), null);
  assert.equal(checkPr(cmd, () => '## Summary\nonly').decision, 'deny');
  assert.equal(checkPr(cmd, none), null);
  assert.equal(checkPr('gh pr create --title "fix: x" -F -', none), null);
});
test('not applicable', () => {
  for (const cmd of ['gh pr create --fill', 'gh pr create --web', 'gh pr list', 'echo "gh pr create"',
    'gh pr create --title "fix: x"', 'git status'])
    assert.equal(checkPr(cmd, none), null, cmd);
});
```

- [ ] **Step 2: Chạy, xác nhận fail** — Run: `node --test tests/pr-check.test.cjs`
- [ ] **Step 3: Viết `pr-check.cjs`.**
- [ ] **Step 4: Chạy, xác nhận pass** — Expected: 5 pass.
- [ ] **Step 5: Commit** — `feat(hooks): add pull request format check`

---

### Task 7: Guard cho công cụ sửa file (`config-guard`, `secret`, `test-weakening`)

**Files:**
- Create: `<S>/guards/config-guard.cjs`, `<S>/guards/secret.cjs`, `<S>/guards/test-weakening.cjs`
- Test: `tests/edit-guards.test.cjs`

**Interfaces — Produces:**

```js
checkConfigEdit(filePath: string, projectDir: string, manifestFiles: string[]): { decision: 'ask', reason: string } | null
findSecret(text: string): string | null        // tên mẫu khớp
findWeakening(toolInput: object): string[]     // các dấu hiệu MỚI thêm
```

`checkConfigEdit`: đổi `\` thành `/` ở cả hai đường dẫn; đường dẫn tương đối coi như nằm trong `projectDir`; so tiền tố không phân biệt hoa thường; file ngoài `projectDir` → `null`. Hỏi khi đường dẫn tương đối là một trong: `.claude/ai-rules.json`, `.claude/settings.json`, `.claude/settings.local.json`, `.github/workflows/ai-rules-sync.yml`; hoặc bắt đầu bằng `.claude/ai-rules/`; hoặc bằng `.claude/rules/ai-rules-core.md`; hoặc khớp `.claude/skills/ai-rules-*/…`; hoặc nằm trong `manifestFiles`. `.claude/known-issues.md` **không** được bảo vệ.

`findSecret` — mẫu và tên:

| Tên | Regex |
|---|---|
| `private-key` | `-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----` |
| `aws-access-key` | `\bAKIA[0-9A-Z]{16}\b` |
| `github-token` | `\bgh[pousr]_[A-Za-z0-9]{36,}\b` hoặc `\bgithub_pat_[A-Za-z0-9_]{60,}\b` |
| `stripe-live-key` | `\b[sr]k_live_[A-Za-z0-9]{20,}\b` |
| `slack-token` | `\bxox[baprs]-[A-Za-z0-9-]{20,}\b` |
| `anthropic-key` | `\bsk-ant-[A-Za-z0-9_-]{40,}\b` |
| `google-api-key` | `\bAIza[0-9A-Za-z_-]{35}\b` |

`findWeakening`: văn bản mới = `new_string` ?? `content` ?? `new_source`; văn bản cũ = `old_string` ?? `''`. Trả về các dấu hiệu có trong mới mà không có trong cũ, theo thứ tự danh sách: `.skip(`, `.only(`, `xit(`, `xdescribe(`, `@ts-ignore`, `@ts-nocheck`, `eslint-disable`, `# type: ignore`, `# noqa`, `@Ignore`, `@Disabled`, `t.Skip(`, `pytest.mark.skip`, `#[ignore]`.

- [ ] **Step 1: Viết test fail**

```js
// tests/edit-guards.test.cjs
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
});
```

- [ ] **Step 2: Chạy, xác nhận fail** — Run: `node --test tests/edit-guards.test.cjs`
- [ ] **Step 3: Viết ba module.**
- [ ] **Step 4: Chạy, xác nhận pass** — Expected: 4 pass.
- [ ] **Step 5: Commit** — `feat(hooks): add config, secret and test-weakening guards`

---

### Task 8: Script đầu vào cho hook và khai báo trong settings

**Files:**
- Create: `<S>/hook-pre-tool.cjs`, `<S>/hook-post-tool.cjs`, `<S>/hook-user-prompt.cjs`, `plugins/ai-rules/payload/settings-fragment.json`, `tests/helpers.cjs`
- Test: `tests/hooks.test.cjs`

**Interfaces:**
- Consumes: toàn bộ Task 2–7.
- Produces: ba script chạy bằng `node <script>` với JSON trên stdin; `tests/helpers.cjs`:

```js
makeRepo(files: Record<string, string>): string                 // thư mục tạm chứa các file
runHook(script: string, input: object|string, env?: object): { status: number, stdout: string, json: object|null }
// script là tên file trong <S>; env được trộn lên process.env;
// AI_RULES_STATE_DIR = path.join(env.CLAUDE_PROJECT_DIR || os.tmpdir(), '.ai-rules-state') nếu env chưa đặt
```

Luồng (mọi script bọc trong `runSafely(fn)` của `io.cjs`; trường thiếu trong input coi như chuỗi rỗng hoặc object rỗng):

- **`hook-user-prompt.cjs`**: `saveState(id, resetTurn(loadState(id)))`. Không in gì.
- **`hook-pre-tool.cjs`**:
  - `tool_name` là `Bash` hoặc `PowerShell`: gom kết quả của `checkDanger`, `checkVerify`, `checkPr` (nếu `guards.prCheck`). `ctx` cho `checkDanger` chỉ được lấy khi lệnh chứa `git commit` hoặc `git push`: `currentBranch` từ `git rev-parse --abbrev-ref HEAD`, `hasCommits` từ `git rev-parse --verify HEAD`, chạy trong `projectDir`; lỗi → `{ currentBranch: null, hasCommits: true }`. `readFile` cho `checkPr` đọc tương đối theo `input.cwd`.
  - `tool_name` là `Edit`, `Write` hoặc `NotebookEdit`: đường dẫn = `tool_input.file_path ?? tool_input.notebook_path`; văn bản = `new_string ?? content ?? new_source`. Gom `checkConfigEdit` (nếu `guards.config`; `manifestFiles` đọc từ `.claude/ai-rules/manifest.json`, thiếu thì `[]`) và `findSecret` (nếu `guards.secrets`) → deny với lý do `ai-rules: this content looks like a secret ({name}). Do not write secrets into the repository; use an environment variable.`
  - Chọn: có deny → in deny đầu tiên; không thì có ask → in ask đầu tiên; không thì không in gì.
- **`hook-post-tool.cjs`**: nạp state; gom các dòng ngữ cảnh:
  1. `tick` → dòng nhắc (nếu có).
  2. `Bash`/`PowerShell`: `failed = commandFailed(input)`; nếu `recordResult(...)` trả `false` thì `recordOther(...)` → dòng nhắc (nếu có).
  3. `Edit`/`Write`/`NotebookEdit` **và** `hook_event_name === 'PostToolUse'`: `resetOnEdit`; nếu `guards.testWeakening` và `findWeakening` không rỗng → ``ai-rules: this edit adds {markers nối bằng ", "}. Do not disable tests or checks to get a pass; if it is intentional, say so in your report.``
  4. Lưu state; có dòng nào thì in `contextOutput(input.hook_event_name, các dòng nối bằng "\n")`.

`settings-fragment.json` (nguyên văn; `H(x)` viết đầy đủ trong file thật là `{ "type": "command", "command": "node", "args": ["${CLAUDE_PROJECT_DIR}/.claude/ai-rules/scripts/x"], "timeout": 10 }`):

```json
{
  "hooks": {
    "SessionStart": [{ "hooks": [H("hook-session-start.cjs")] }],
    "UserPromptSubmit": [{ "hooks": [H("hook-user-prompt.cjs")] }],
    "PreToolUse": [{ "matcher": "Bash|PowerShell|Edit|Write|NotebookEdit", "hooks": [H("hook-pre-tool.cjs")] }],
    "PostToolUse": [{ "matcher": "*", "hooks": [H("hook-post-tool.cjs")] }],
    "PostToolUseFailure": [{ "matcher": "Bash|PowerShell", "hooks": [H("hook-post-tool.cjs")] }]
  },
  "permissions": {
    "deny": ["Read(./.env)", "Read(./.env.local)", "Read(./.env.development)", "Read(./.env.production)",
             "Read(./.env.staging)", "Read(./.env.test)", "Read(./.env.*.local)"]
  }
}
```

- [ ] **Step 1: Viết `tests/helpers.cjs`** theo Interfaces (dùng `child_process.spawnSync` với `input`).

- [ ] **Step 2: Viết test fail**

```js
// tests/hooks.test.cjs
const test = require('node:test'); const assert = require('node:assert');
const fs = require('node:fs');
const { makeRepo, runHook } = require('./helpers.cjs');
const CFG = JSON.stringify({ verify: { commands: { e2e: ['npm run e2e'] } }, turnNudgeAfterToolCalls: 3 });
const repo = (extra = {}) => makeRepo({ '.claude/ai-rules.json': CFG, ...extra });
const bash = (dir, command, event = 'PreToolUse', more = {}) =>
  ({ session_id: 's1', cwd: dir, hook_event_name: event, tool_name: 'Bash', tool_input: { command }, ...more });
const env = (dir) => ({ CLAUDE_PROJECT_DIR: dir });
const decision = (r) => r.json && r.json.hookSpecificOutput.permissionDecision;

test('pre-tool: deny, ask, and silence', () => {
  const d = repo();
  assert.equal(decision(runHook('hook-pre-tool.cjs', bash(d, 'git push --force'), env(d))), 'deny');
  assert.equal(decision(runHook('hook-pre-tool.cjs', bash(d, 'npm install lodash'), env(d))), 'ask');
  const edit = { session_id: 's1', cwd: d, hook_event_name: 'PreToolUse', tool_name: 'Edit',
    tool_input: { file_path: `${d}/.claude/ai-rules.json`, old_string: 'a', new_string: 'b' } };
  assert.equal(decision(runHook('hook-pre-tool.cjs', edit, env(d))), 'ask');
  const write = { ...edit, tool_name: 'Write',
    tool_input: { file_path: `${d}/src/a.js`, content: '-----BEGIN ' + 'PRIVATE KEY-----' } };
  assert.equal(decision(runHook('hook-pre-tool.cjs', write, env(d))), 'deny');
  const quiet = runHook('hook-pre-tool.cjs', bash(d, 'ls'), env(d));
  assert.equal(quiet.status, 0); assert.equal(quiet.stdout, '');
});
test('all entry scripts fail open on bad input', () => {
  const d = repo({ '.claude/ai-rules.json': '{broken' });
  for (const s of ['hook-pre-tool.cjs', 'hook-post-tool.cjs', 'hook-user-prompt.cjs'])
    for (const input of ['', 'not json', '{"tool_name":"Bash"}', '{"tool_name":"Edit","tool_input":null}']) {
      const r = runHook(s, input, env(d));
      assert.equal(r.status, 0, `${s} ${input}`); assert.equal(r.stdout, '', `${s} ${input}`);
    }
});
test('e2e: two failures block the third run; a new user message unblocks', () => {
  const d = repo(); const e = env(d);
  for (let i = 0; i < 2; i++) {
    assert.equal(decision(runHook('hook-pre-tool.cjs', bash(d, 'npm run e2e'), e)), null);
    runHook('hook-post-tool.cjs', bash(d, 'npm run e2e', 'PostToolUseFailure'), e);
  }
  assert.equal(decision(runHook('hook-pre-tool.cjs', bash(d, 'npm run e2e'), e)), 'deny');
  const up = runHook('hook-user-prompt.cjs', { session_id: 's1', cwd: d, hook_event_name: 'UserPromptSubmit' }, e);
  assert.equal(up.stdout, '');
  assert.equal(decision(runHook('hook-pre-tool.cjs', bash(d, 'npm run e2e'), e)), null);
});
test('e2e: an edit between failures resets the streak', () => {
  const d = repo(); const e = env(d);
  runHook('hook-post-tool.cjs', bash(d, 'npm run e2e', 'PostToolUseFailure'), e);
  runHook('hook-post-tool.cjs', bash(d, 'npm run e2e', 'PostToolUseFailure'), e);
  runHook('hook-post-tool.cjs', { session_id: 's1', cwd: d, hook_event_name: 'PostToolUse', tool_name: 'Edit',
    tool_input: { file_path: `${d}/src/a.js`, old_string: 'a', new_string: 'b' } }, e);
  assert.equal(decision(runHook('hook-pre-tool.cjs', bash(d, 'npm run e2e'), e)), null);
});
test('post-tool: passing e2e runs never block', () => {
  const d = repo(); const e = env(d);
  for (let i = 0; i < 6; i++)
    runHook('hook-post-tool.cjs', bash(d, 'npm run e2e', 'PostToolUse', { tool_response: { exitCode: 0 } }), e);
  assert.equal(decision(runHook('hook-pre-tool.cjs', bash(d, 'npm run e2e'), e)), null);
});
test('post-tool: nudges arrive as additionalContext', () => {
  const d = repo(); const e = env(d);
  runHook('hook-post-tool.cjs', bash(d, 'ls', 'PostToolUse'), e);
  runHook('hook-post-tool.cjs', bash(d, 'ls', 'PostToolUse'), e);
  const third = runHook('hook-post-tool.cjs', bash(d, 'ls', 'PostToolUse'), e);
  assert.match(third.json.hookSpecificOutput.additionalContext, /3 tool calls this turn/);
  const weak = runHook('hook-post-tool.cjs', { session_id: 's2', cwd: d, hook_event_name: 'PostToolUse',
    tool_name: 'Write', tool_input: { file_path: `${d}/a.test.js`, content: 'it.skip("a", f)' } }, e);
  assert.match(weak.json.hookSpecificOutput.additionalContext, /this edit adds \.skip\(/);
});
test('settings fragment wires every entry script', () => {
  const f = JSON.parse(fs.readFileSync('plugins/ai-rules/payload/settings-fragment.json', 'utf8'));
  assert.deepEqual(Object.keys(f.hooks).sort(),
    ['PostToolUse', 'PostToolUseFailure', 'PreToolUse', 'SessionStart', 'UserPromptSubmit']);
  for (const groups of Object.values(f.hooks)) for (const g of groups) for (const h of g.hooks) {
    assert.equal(h.command, 'node');
    assert.match(h.args[0], /^\$\{CLAUDE_PROJECT_DIR\}\/\.claude\/ai-rules\/scripts\/hook-[a-z-]+\.cjs$/);
  }
  assert.ok(f.permissions.deny.includes('Read(./.env)'));
  assert.ok(!f.permissions.deny.some((r) => r.includes('example')));
});
```

- [ ] **Step 3: Chạy, xác nhận fail** — Run: `node --test tests/hooks.test.cjs`
- [ ] **Step 4: Viết ba script và `settings-fragment.json`.**
- [ ] **Step 5: Chạy, xác nhận pass** — Expected: 7 pass. Rồi `npm test` — tất cả pass.
- [ ] **Step 6: Commit** — `feat(hooks): add hook entry scripts and settings fragment`

---

### Task 9: Kiểm tra commit message và hook đầu phiên

**Files:**
- Create: `<S>/git-commit-msg.cjs`, `<S>/lib/git-hook.cjs`, `<S>/hook-session-start.cjs`
- Test: `tests/commit-msg.test.cjs`

**Interfaces:**
- Consumes: `checkTitle`, `loadConfig`, `cleanupOldStates`, `runSafely` (Task 2); `makeRepo`, `runHook` của `tests/helpers.cjs` (Task 8).
- Produces:

```js
// git-commit-msg.cjs  (cũng là CLI: node git-commit-msg.cjs <file message>)
checkCommitMessage(message: string): string | null
shouldEnforce(env: object, config): boolean
// lib/git-hook.cjs
SHIM: string
installCommitMsgHook(projectDir: string): 'installed'|'present'|'skipped-hookspath'|'skipped-foreign'|'no-git'
```

Hành vi:

- `checkCommitMessage`: chuẩn hoá `\r\n` → `\n`; tiêu đề = dòng đầu tiên không rỗng và không bắt đầu bằng `#`; miễn kiểm tra khi tiêu đề bắt đầu bằng `Merge `, `Revert `, `fixup! `, `squash! `, `amend! `; còn lại → `checkTitle`.
- `shouldEnforce`: `guards.commitMsg` bật **và** (`config.commitMsg.scope === 'all'` hoặc `env.CLAUDECODE === '1'` hoặc `env.CLAUDE_CODE_REMOTE === 'true'` hoặc `env.AI_RULES_ENFORCE_COMMIT_MSG === '1'`).
- CLI: thư mục dự án = thư mục làm việc hiện tại. Không bắt buộc hoặc hợp lệ → thoát 0. Không hợp lệ → in lý do (bắt đầu `ai-rules:`) ra stderr, thoát 1. Mọi lỗi khác → thoát 0.
- `SHIM` (nguyên văn):

```sh
#!/bin/sh
# ai-rules commit-msg
root="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 0
script="$root/.claude/ai-rules/scripts/git-commit-msg.cjs"
[ -f "$script" ] || exit 0
exec node "$script" "$1"
```

- `installCommitMsgHook`: không phải repo git → `no-git`. `git config core.hooksPath` có giá trị → `skipped-hookspath`. Thư mục hooks = `git rev-parse --git-path hooks` (đúng cả với worktree; kết quả tương đối thì nối với `projectDir`). File `commit-msg` đã có: chứa `# ai-rules commit-msg` → ghi lại nếu khác `SHIM`, trả `present`; không chứa → `skipped-foreign`, không đụng. Chưa có → ghi `SHIM`, `chmod 0o755`, trả `installed`.
- `hook-session-start.cjs`: `cleanupOldStates()`; nếu `guards.commitMsg` thì `installCommitMsgHook`; in ra stdout (mỗi ý một dòng):
  - `CLAUDE_CODE_REMOTE === 'true'` → `ai-rules: this is a cloud session. Plugins (superpowers, catalog plugins) are not available here. Do not try to install them; work with the repo's rules and ai-rules-* skills, and tell the user once if a task needs a plugin-only skill.`
  - `skipped-hookspath` hoặc `skipped-foreign` → `ai-rules: commit message check is not installed because this repo already uses its own git hooks.`

- [ ] **Step 1: Viết test fail**

```js
// tests/commit-msg.test.cjs
const test = require('node:test'); const assert = require('node:assert');
const fs = require('node:fs'); const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');
const { makeRepo, runHook } = require('./helpers.cjs');
const S = '../plugins/ai-rules/payload/managed/ai-rules/scripts';
const SCRIPT = path.resolve('plugins/ai-rules/payload/managed/ai-rules/scripts/git-commit-msg.cjs');
const { checkCommitMessage, shouldEnforce } = require(`${S}/git-commit-msg.cjs`);
const { installCommitMsgHook } = require(`${S}/lib/git-hook.cjs`);
const { mergeConfig } = require(`${S}/lib/config.cjs`);
const git = (dir, ...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
const gitRepo = () => { const d = makeRepo({}); git(d, 'init', '-q'); return d; };

test('checkCommitMessage', () => {
  for (const ok of ['feat(api): add login', 'fix: x\r\n\r\nbody text', '# comment\n\nfix: x',
    'Merge branch "a" into b', 'Revert "feat: x"', 'fixup! feat: x'])
    assert.equal(checkCommitMessage(ok), null, ok);
  for (const bad of ['Add login', 'feat: ' + 'a'.repeat(70), ''])
    assert.equal(typeof checkCommitMessage(bad), 'string', bad);
});
test('shouldEnforce', () => {
  const d = mergeConfig(null);
  assert.equal(shouldEnforce({ CLAUDECODE: '1' }, d), true);
  assert.equal(shouldEnforce({ CLAUDE_CODE_REMOTE: 'true' }, d), true);
  assert.equal(shouldEnforce({ AI_RULES_ENFORCE_COMMIT_MSG: '1' }, d), true);
  assert.equal(shouldEnforce({}, d), false);
  assert.equal(shouldEnforce({}, mergeConfig({ commitMsg: { scope: 'all' } })), true);
  assert.equal(shouldEnforce({ CLAUDECODE: '1' }, mergeConfig({ guards: { commitMsg: false } })), false);
});
test('CLI exits 1 only when enforced and invalid', () => {
  const d = makeRepo({ 'MSG': 'Add login\n' });
  const run = (extra) => spawnSync('node', [SCRIPT, path.join(d, 'MSG')],
    { cwd: d, encoding: 'utf8', env: { ...process.env, CLAUDECODE: '', CLAUDE_CODE_REMOTE: '', ...extra } });
  const enforced = run({ CLAUDECODE: '1' });
  assert.equal(enforced.status, 1); assert.match(enforced.stderr, /^ai-rules: /);
  assert.equal(run({}).status, 0);
  assert.equal(spawnSync('node', [SCRIPT, path.join(d, 'missing')], { cwd: d }).status, 0);
});
test('installCommitMsgHook', () => {
  const d = gitRepo(); const hook = path.join(d, '.git/hooks/commit-msg');
  assert.equal(installCommitMsgHook(d), 'installed');
  assert.match(fs.readFileSync(hook, 'utf8'), /# ai-rules commit-msg/);
  assert.equal(installCommitMsgHook(d), 'present');
  const foreign = gitRepo(); const fh = path.join(foreign, '.git/hooks/commit-msg');
  fs.mkdirSync(path.dirname(fh), { recursive: true }); fs.writeFileSync(fh, '#!/bin/sh\nexit 0\n');
  assert.equal(installCommitMsgHook(foreign), 'skipped-foreign');
  assert.equal(fs.readFileSync(fh, 'utf8'), '#!/bin/sh\nexit 0\n');
  const husky = gitRepo(); git(husky, 'config', 'core.hooksPath', '.husky');
  assert.equal(installCommitMsgHook(husky), 'skipped-hookspath');
  assert.equal(installCommitMsgHook(makeRepo({})), 'no-git');
});
test('session start prints the cloud notice only in cloud sessions', () => {
  const d = gitRepo(); const input = { session_id: 's1', cwd: d, hook_event_name: 'SessionStart' };
  const cloud = runHook('hook-session-start.cjs', input, { CLAUDE_PROJECT_DIR: d, CLAUDE_CODE_REMOTE: 'true' });
  assert.match(cloud.stdout, /^ai-rules: this is a cloud session\./);
  const local = runHook('hook-session-start.cjs', input, { CLAUDE_PROJECT_DIR: d, CLAUDE_CODE_REMOTE: '' });
  assert.equal(local.stdout, '');
  assert.equal(runHook('hook-session-start.cjs', 'garbage', { CLAUDE_PROJECT_DIR: makeRepo({}) }).status, 0);
});
```

- [ ] **Step 2: Chạy, xác nhận fail** — Run: `node --test tests/commit-msg.test.cjs`
- [ ] **Step 3: Viết ba file.**
- [ ] **Step 4: Chạy, xác nhận pass** — Expected: 5 pass.
- [ ] **Step 5: Commit** — `feat(hooks): add commit message check and session start hook`

---

### Task 10: Đồng bộ (`sync.cjs`) và file starter

**Files:**
- Create: `plugins/ai-rules/scripts/sync.cjs`; `plugins/ai-rules/payload/starter/CLAUDE.md`, `ai-rules.json`, `settings.json`, `known-issues.md`
- Test: `tests/sync.test.cjs`

**Interfaces — Produces:**

```js
planManagedFiles(payloadDir: string): Map<string, string>   // đường dẫn đích ('/') → nội dung LF; gồm 'AGENTS.md'
generateAgentsMd(payloadDir: string): string
computeSourceVersion(payloadDir: string): string            // 12 ký tự hex
readManifest(targetDir: string): { sourceVersion: string, files: string[], managedDeny: string[] } | null
mergeSettings(existing: object, fragment: object, prevManagedDeny: string[]): object
syncRepo({ payloadDir, targetDir, init = false }): { sourceVersion, written: string[], removed: string[], skipped: { path, reason }[] }
// CLI: node sync.cjs [--target <dir>=cwd] [--init] [--check]
//   payloadDir = path.join(__dirname, '..', 'payload')
//   mặc định: in JSON kết quả của syncRepo
//   --check: in {"current": string|null, "latest": string, "upToDate": boolean}, không ghi gì
```

Quy tắc:

- **Ánh xạ** theo bảng ở phần File Structure. Mọi nội dung chuẩn hoá `\r\n` → `\n`. Thư mục con của `managed/` hoặc file starter chưa tồn tại ở nguồn thì coi như không có, không báo lỗi.
- `written` và `removed` chỉ tính file được quản lý có nội dung thay đổi; không tính `settings.json` và `manifest.json`.
- **`computeSourceVersion`** = 12 ký tự đầu của SHA-256 trên chuỗi ghép, theo thứ tự đường dẫn tăng dần, của `đường_dẫn + "\0" + nội_dung + "\0"` cho mọi mục trong `planManagedFiles`, cộng thêm mục giả `#settings-fragment` với nội dung (đã chuẩn hoá) của `settings-fragment.json`.
- **`generateAgentsMd`**:

  ```
  <!-- Managed by ai-rules. Do not edit; overwritten on sync. -->
  # Agent instructions

  Project description: read `CLAUDE.md`.

  ## Core rules

  {các dòng của ai-rules-core.md nằm sau dòng "# Core rules" và trước dòng "## Claude Code only", bỏ dòng trống đầu/cuối}

  ## Task guides

  Read the matching file before doing the task.

  | When | Read |
  |---|---|
  | {description trong frontmatter} | `.claude/skills/{tên thư mục}/SKILL.md` |
  ```

  Một dòng bảng cho mỗi thư mục trong `payload/managed/skills/`, theo thứ tự tên.
- **`syncRepo`**:
  1. `init`: chép từng file starter theo bảng ánh xạ; file đích đã có → không ghi, thêm vào `skipped` với `reason: 'exists'`.
  2. Ghi mọi file trong `planManagedFiles` (tạo thư mục nếu thiếu). Riêng `AGENTS.md`: nếu đã tồn tại mà không chứa `Managed by ai-rules` → không ghi, `skipped` với `reason: 'foreign AGENTS.md'`, và không đưa vào manifest. `written` chỉ gồm file có nội dung thay đổi.
  3. Xoá file có trong manifest cũ mà không còn trong kế hoạch mới; xoá thư mục rỗng để lại; ghi vào `removed`.
  4. `.claude/settings.json`: không có → tạo từ `mergeSettings({}, fragment, [])`; sai JSON → không đụng, `skipped` với `reason: 'invalid settings.json'`; còn lại → `mergeSettings(existing, fragment, manifestCũ?.managedDeny ?? [])`.
  5. Ghi `.claude/ai-rules/manifest.json`: `{ sourceVersion, files (đã sắp xếp), managedDeny: fragment.permissions.deny }`.
- **`mergeSettings`**: giữ mọi khoá khác. Với mỗi sự kiện trong `hooks`: bỏ các nhóm hiện có mà có handler với `args` hoặc `command` chứa `.claude/ai-rules/scripts/`, rồi nối các nhóm của fragment vào cuối. `permissions.deny` = (deny hiện có, trừ các mục thuộc `prevManagedDeny`) hợp với deny của fragment, không trùng lặp.

Nội dung starter:

- `CLAUDE.md`:

  ```markdown
  # Project

  ## What this is
  _Not set yet. Filled in by the `ai-rules-repo-setup` skill during brainstorming._

  ## Stack

  ## Commands
  - Install:
  - Build:
  - Lint:
  - Test:
  - E2E:

  ## Structure

  ## Conventions
  ```

- `ai-rules.json`: `{ "source": "phong190897/ai-rules", "mainBranch": "main" }`
- `known-issues.md`: tiêu đề `# Known issues`, một đoạn nói file chỉ được đọc khi một lệnh kiểm tra fail và chỉ được thêm mục khi người dùng đồng ý, rồi khuôn một mục: `### <signature>` / `- Type: environment | flaky` / `- Fix:` / `- Recorded: YYYY-MM-DD`.
- `settings.json`:

  ```json
  {
    "extraKnownMarketplaces": {
      "ai-rules-marketplace": { "source": { "source": "github", "repo": "phong190897/ai-rules" }, "autoUpdate": true }
    },
    "enabledPlugins": { "ai-rules@ai-rules-marketplace": true, "superpowers@claude-plugins-official": true }
  }
  ```

  Trước khi ghi: chạy `claude plugin list` trên máy này. Nếu superpowers hiện thuộc marketplace khác `claude-plugins-official`, dùng đúng mã `superpowers@<marketplace>` đó và thêm mục `extraKnownMarketplaces` tương ứng.

- [ ] **Step 1: Viết test fail**

```js
// tests/sync.test.cjs
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
```

- [ ] **Step 2: Chạy, xác nhận fail** — Run: `node --test tests/sync.test.cjs`
- [ ] **Step 3: Viết `sync.cjs` và bốn file starter** (file `ai-rules-sync.yml` thuộc Task 14; test CLI cần `payload/managed/rules/ai-rules-core.md` tồn tại — nếu chưa có, tạo file tạm chỉ gồm dòng đánh dấu và `# Core rules`, Task 12 sẽ thay).
- [ ] **Step 4: Chạy, xác nhận pass** — Expected: 8 pass.
- [ ] **Step 5: Commit** — `feat(sync): add managed-copy sync and starter files`

---

### Task 11: Phần chạy của plugin (`sync-check`, hook, hai skill)

**Files:**
- Create: `plugins/ai-rules/scripts/sync-check.cjs`, `plugins/ai-rules/hooks/hooks.json`, `plugins/ai-rules/skills/init-repo/SKILL.md`, `plugins/ai-rules/skills/sync-repo/SKILL.md`
- Test: `tests/plugin.test.cjs`

**Interfaces:**
- Consumes: `computeSourceVersion`, `readManifest`, `syncRepo` (Task 10).
- Produces: hook `SessionStart` của plugin; skill `ai-rules:init-repo`, `ai-rules:sync-repo`.

Hành vi `sync-check.cjs` (đọc stdin như các hook khác; mọi lỗi → thoát 0, không in):

- Thư mục dự án = `CLAUDE_PROJECT_DIR` hoặc `input.cwd`. Payload = `path.join(process.env.CLAUDE_PLUGIN_ROOT || path.join(__dirname, '..'), 'payload')`.
- Không in gì khi: `CLAUDE_CODE_REMOTE === 'true'`; hoặc không có `.claude/ai-rules.json`; hoặc `readManifest(...).sourceVersion` bằng bản mới nhất.
- Ngược lại in đúng một dòng: `ai-rules: an update is available ({cũ hoặc "none"} -> {mới}). Ask the user whether to sync now; if they agree, use the ai-rules:sync-repo skill.`

`hooks.json`:

```json
{ "hooks": { "SessionStart": [ { "hooks": [
  { "type": "command", "command": "node", "args": ["${CLAUDE_PLUGIN_ROOT}/scripts/sync-check.cjs"], "timeout": 10 }
] } ] } }
```

Skill (frontmatter cố định; thân bài viết theo các điểm bắt buộc):

- `init-repo` — `description: Use when the user wants to set up a new or existing repository to use ai-rules (shared rules, hooks and skills).` Các bước bắt buộc: xác nhận thư mục hiện tại là gốc repo; chạy `node "${CLAUDE_PLUGIN_ROOT}/scripts/sync.cjs" --init --target .`; báo lại `written` và `skipped`; nhắc bật "Allow GitHub Actions to create and approve pull requests" trong cài đặt repo; đưa hai lệnh cài plugin cho máy khác; đề xuất commit `chore: set up ai-rules` (trên nhánh riêng, trừ khi repo chưa có commit nào) và chỉ commit khi người dùng đồng ý.
- `sync-repo` — `description: Use when ai-rules reports that an update is available, or the user asks to sync ai-rules in this repository.` Các bước bắt buộc: chỉ chạy khi người dùng đã đồng ý; nếu cây làm việc có thay đổi chưa commit thì hỏi trước; tạo nhánh `chore/sync-ai-rules`; chạy `node "${CLAUDE_PLUGIN_ROOT}/scripts/sync.cjs" --target .`; báo lại `written`, `removed`, `skipped`; đề xuất commit `chore: sync ai-rules` và PR theo `ai-rules-creating-prs`.

- [ ] **Step 1: Viết test fail**

```js
// tests/plugin.test.cjs
const test = require('node:test'); const assert = require('node:assert');
const fs = require('node:fs'); const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { makeRepo } = require('./helpers.cjs');
const sync = require('../plugins/ai-rules/scripts/sync.cjs');
const PAYLOAD = path.resolve('plugins/ai-rules/payload');
const check = (dir, env = {}) => spawnSync('node', ['plugins/ai-rules/scripts/sync-check.cjs'], {
  input: JSON.stringify({ session_id: 's', cwd: dir, hook_event_name: 'SessionStart' }), encoding: 'utf8',
  env: { ...process.env, CLAUDE_PROJECT_DIR: dir, CLAUDE_CODE_REMOTE: '', ...env } });

test('sync-check stays silent outside ai-rules repos and when up to date', () => {
  assert.equal(check(makeRepo({})).stdout, '');
  const t = makeRepo({}); sync.syncRepo({ payloadDir: PAYLOAD, targetDir: t, init: true });
  assert.equal(check(t).stdout, '');
});
test('sync-check announces an update in one line, but not in cloud sessions', () => {
  const t = makeRepo({}); sync.syncRepo({ payloadDir: PAYLOAD, targetDir: t, init: true });
  const mf = path.join(t, '.claude/ai-rules/manifest.json');
  fs.writeFileSync(mf, JSON.stringify({ ...JSON.parse(fs.readFileSync(mf, 'utf8')), sourceVersion: '000000000000' }));
  const out = check(t).stdout.trim();
  assert.match(out, /^ai-rules: an update is available \(000000000000 -> [0-9a-f]{12}\)\./);
  assert.equal(out.split('\n').length, 1);
  assert.equal(check(t, { CLAUDE_CODE_REMOTE: 'true' }).stdout, '');
  const fresh = makeRepo({ '.claude/ai-rules.json': '{}' });
  assert.match(check(fresh).stdout, /\(none -> /);
});
test('sync-check fails open', () => {
  const r = spawnSync('node', ['plugins/ai-rules/scripts/sync-check.cjs'], { input: 'garbage', encoding: 'utf8' });
  assert.equal(r.status, 0);
});
test('plugin hooks.json and skills', () => {
  const h = JSON.parse(fs.readFileSync('plugins/ai-rules/hooks/hooks.json', 'utf8'));
  assert.equal(h.hooks.SessionStart[0].hooks[0].args[0], '${CLAUDE_PLUGIN_ROOT}/scripts/sync-check.cjs');
  for (const [name, flag] of [['init-repo', '--init --target .'], ['sync-repo', '--target .']]) {
    const s = fs.readFileSync(`plugins/ai-rules/skills/${name}/SKILL.md`, 'utf8');
    assert.match(s, new RegExp(`^---\\nname: ${name}\\ndescription: Use when `));
    assert.ok(s.includes('node "${CLAUDE_PLUGIN_ROOT}/scripts/sync.cjs" ' + flag), name);
  }
});
```

- [ ] **Step 2: Chạy, xác nhận fail** — Run: `node --test tests/plugin.test.cjs`
- [ ] **Step 3: Viết bốn file.**
- [ ] **Step 4: Chạy, xác nhận pass** — Expected: 4 pass.
- [ ] **Step 5: Commit** — `feat(plugin): add update check hook and init/sync skills`

---

### Task 11b: Quét repo chưa thiết lập và gợi ý một lần (spec §12)

**Files:**
- Create: `plugins/ai-rules/scripts/scan.cjs`
- Modify: `plugins/ai-rules/scripts/sync-check.cjs`, `plugins/ai-rules/scripts/sync.cjs`, `plugins/ai-rules/skills/init-repo/SKILL.md`
- Test: `tests/scan.test.cjs`

**Interfaces:**
- Consumes: `syncRepo`, `readManifest` (Task 10); `sync-check.cjs` (Task 11); `makeRepo` (Task 8).
- Produces:

```js
// scan.cjs  (CLI: node scan.cjs [--target <dir>=cwd] → in JSON Report)
scanRepo(dir: string): Report
formatReport(report: Report): string[]                  // tối đa 6 dòng tiếng Anh
wasOffered(dataDir: string, repoDir: string): boolean
markOffered(dataDir: string, repoDir: string): void     // file <dataDir>/offered.json: mảng đường dẫn đã chuẩn hoá

// Report
{ isGitRoot: boolean,
  stack: string[],
  packageManager: 'npm'|'pnpm'|'yarn'|'bun'|null,
  commands: { e2e: string[], test: string[], build: string[], lint: string[] },
  e2eFramework: 'playwright'|'cypress'|null,
  existing: { claudeMdLines: number|null, agentsMd: boolean, settings: boolean, gitHooks: 'husky'|'hooksPath'|null },
  trackedEnvFiles: string[],
  suggestedSkills: string[] }
```

Quy tắc `scanRepo` (chỉ đọc file ở gốc `dir` và gọi git; mọi lỗi → giá trị rỗng tương ứng):

- `isGitRoot`: có `.git` (file hoặc thư mục) trong `dir`.
- `stack`, theo thứ tự: `package.json` → `node`; `pyproject.toml` hoặc `requirements.txt` → `python`; `go.mod` → `go`; `Cargo.toml` → `rust`; `pom.xml`, `build.gradle` hoặc `build.gradle.kts` → `java`; file `*.csproj` hoặc `*.sln` ở gốc → `dotnet`; `composer.json` → `php`; `Gemfile` → `ruby`.
- `packageManager`: `pnpm-lock.yaml` → `pnpm`; `yarn.lock` → `yarn`; `bun.lockb` hoặc `bun.lock` → `bun`; còn lại `npm` nếu có `package.json`, không thì `null`.
- `e2eFramework`: `dependencies`/`devDependencies` có `@playwright/test` hoặc `playwright` → `playwright`; có `cypress` → `cypress`.
- `commands` (chỉ từ `scripts` của `package.json`; `package.json` sai JSON → coi như không có script và dependency):
  - `test`: có script `test` và nội dung không chứa `no test specified` → `["<pm> test"]` (riêng bun: `bun run test`).
  - `build`, `lint`: có script cùng tên → `["<pm> run <tên>"]`.
  - `e2e`: mỗi script có tên chứa `e2e` → `"<pm> run <tên>"`; nếu không có script nào mà có `e2eFramework` → `["npx playwright test"]` hoặc `["npx cypress run"]`.
- `existing`: `claudeMdLines` = số dòng của `CLAUDE.md` (không có → `null`); `agentsMd`, `settings` (`.claude/settings.json`) theo sự tồn tại; `gitHooks`: có thư mục `.husky` → `husky`, không thì `git config core.hooksPath` có giá trị → `hooksPath`, không thì `null`.
- `trackedEnvFiles`: kết quả `git ls-files` mà tên file là `.env` hoặc `.env.<x>`, trừ đuôi `.example`, `.sample`, `.template`.
- `suggestedSkills`: dependency có một trong `react`, `vue`, `svelte`, `next`, `nuxt`, `@angular/core`, `solid-js`, `astro` → `frontend-design`; dependency có một trong `express`, `fastify`, `@nestjs/core`, `koa`, `hono`, hoặc `stack` chứa công nghệ khác `node` → `ai-rules-backend-basics`.

`formatReport` (bỏ dòng không có dữ liệu; `stack` rỗng → chỉ một dòng `Stack: unknown`):

```
Stack: node (pnpm), e2e: playwright
Commands: test "pnpm test"; build "pnpm run build"; lint "pnpm run lint"; e2e "pnpm run test:e2e"
Existing CLAUDE.md (62 lines): will be kept as is
Existing git hooks (husky): the commit message check will not be installed
Tracked env files: .env — suggest removing them from git
Suggested skills: frontend-design, ai-rules-backend-basics
```

Chuẩn hoá đường dẫn cho `offered.json`: `path.resolve`, đổi `\` thành `/`, đổi thành chữ thường.

Thay đổi ở `sync-check.cjs`: khi **không** có `.claude/ai-rules.json`, không ở cloud, `scanRepo(dir).isGitRoot` đúng, và `wasOffered` sai → in khối dưới đây rồi `markOffered`. Thư mục dữ liệu = `process.env.CLAUDE_PLUGIN_DATA || path.join(os.tmpdir(), 'ai-rules')`.

```
ai-rules: this repository is not set up with ai-rules. Quick scan:
- {từng dòng của formatReport}
Ask the user once, in their language, whether to set it up. If they agree, use the ai-rules:init-repo skill. If they decline, do not ask again.
```

Thay đổi ở `sync.cjs`: khi `init` và `.claude/ai-rules.json` **vừa được tạo trong lần chạy này**, ghi thêm `verify.commands` gồm các loại có lệnh trong `scanRepo(targetDir).commands`. Kết quả `syncRepo` có thêm trường `scan: Report` khi `init`.

Thay đổi ở `init-repo/SKILL.md`, thêm các bước bắt buộc: trình bày kết quả quét (trường `scan`) cho người dùng; hỏi **riêng từng việc** và chỉ làm khi được đồng ý — gỡ file trong `trackedEnvFiles` khỏi git (`git rm --cached` và thêm vào `.gitignore`), cài skill trong `suggestedSkills`, sắp xếp lại `CLAUDE.md` sẵn có theo khuôn; kết thúc bằng lời đề nghị chạy `ai-rules-repo-setup`.

- [ ] **Step 1: Viết test fail**

```js
// tests/scan.test.cjs
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
```

- [ ] **Step 2: Chạy, xác nhận fail** — Run: `node --test tests/scan.test.cjs` — Expected: FAIL (Cannot find module `scan.cjs`).
- [ ] **Step 3: Viết `scan.cjs`; sửa `sync-check.cjs`, `sync.cjs` và `init-repo/SKILL.md`** theo các quy tắc trên.
- [ ] **Step 4: Chạy, xác nhận pass** — Run: `node --test tests/scan.test.cjs` — Expected: 7 pass. Rồi `npm test` — tất cả pass (các test của Task 10 và 11 không đổi kết quả).
- [ ] **Step 5: Commit** — `feat(plugin): scan unconfigured repositories and offer setup once`

---

### Task 12: Rule cốt lõi và test nội dung

**Files:**
- Create: `plugins/ai-rules/payload/managed/rules/ai-rules-core.md` (thay file tạm của Task 10)
- Test: `tests/content.test.cjs`

**Interfaces:**
- Consumes: `generateAgentsMd`, `planManagedFiles` (Task 10).
- Produces: quy ước `# Core rules` … `## Claude Code only` mà `generateAgentsMd` dựa vào; hàm test dùng lại ở Task 13.

Nội dung `ai-rules-core.md` (nguyên văn):

```markdown
<!-- Managed by ai-rules. Do not edit; overwritten on sync. -->
# Core rules

- Scope: change only what was asked. No drive-by refactors. Ask before adding a dependency.
- Git: never commit on the main branch, force-push, or pass `--no-verify`. Never merge your own PR.
- Destructive actions: ask before deleting or overwriting files or data you did not create in this session.
- Secrets: never read `.env*` files that hold real values; never write secrets into code or commits.
- Honesty: never say "done", "fixed" or "passing" without running the check and reading its output.
- Final report, every task: what changed; what you verified (command and result); what you did not verify.
- Checks: never skip, disable or delete a test or static check to get a pass. Report the problem instead.
- Stop rule: if two fixes for the same error both fail, stop and report to the user with evidence.
- Failures: when e2e, test, build or lint fails, use `ai-rules-handling-failures` before re-running.
- E2E: run the repo's environment preflight (if `.claude/ai-rules.json` declares one) before the first e2e run. Re-run only the failing tests; run the full suite once, at the end.
- Tokens: search before reading; read only the part you need; never re-read a file already in context; run the narrowest test that proves the change; trim long command output; keep replies short. Details: `ai-rules-saving-tokens`.
- PRs, commits, comments: follow `ai-rules-creating-prs` and `ai-rules-writing-comments`.
- Managed files: never hand-edit files marked "Managed by ai-rules", `.claude/ai-rules.json` or `.claude/settings.json` without the user's approval.
- Reply in the user's language.

## Claude Code only

- Brainstorming: when brainstorming or designing in this repo, run `ai-rules-repo-setup` before the design is finalized.
- Superpowers: on a local machine, if no `superpowers:*` skill is available, tell the user to install it and continue.
- Cloud sessions: plugins (superpowers, catalog plugins) do not load. Do not try to install them. Work with these rules and the `ai-rules-*` skills; tell the user once if a task needs a plugin-only skill.
```

- [ ] **Step 1: Viết test fail**

```js
// tests/content.test.cjs
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
```

- [ ] **Step 2: Chạy, xác nhận fail** — Run: `node --test tests/content.test.cjs`
- [ ] **Step 3: Ghi `ai-rules-core.md` đúng nguyên văn ở trên.**
- [ ] **Step 4: Chạy, xác nhận pass** — Expected: 3 pass. Rồi `npm test`.
- [ ] **Step 5: Commit** — `feat(rules): add core rules`

---

### Task 13: Bảy skill nội dung và danh mục

**Files:**
- Create: `plugins/ai-rules/payload/managed/skills/<tên>/SKILL.md` cho 7 skill dưới đây; `plugins/ai-rules/payload/managed/ai-rules/catalog.md`
- Modify: `tests/content.test.cjs` (thêm test)

**Interfaces:**
- Consumes: quy ước đánh dấu và frontmatter (Global Constraints, Task 12).
- Produces: tên skill mà rule cốt lõi và `AGENTS.md` trỏ tới.

Viết từng skill theo `superpowers:writing-skills`. Frontmatter gồm đúng `name` (bằng tên thư mục) và `description` (nguyên văn dưới đây); ngay sau frontmatter là dòng đánh dấu. Thân bài phải chứa đủ các điểm bắt buộc, lấy từ mục tương ứng của spec.

| Skill | `description` | Điểm bắt buộc (mục spec) |
|---|---|---|
| `ai-rules-repo-setup` | `Use when brainstorming, designing, or starting work in a repository: write the project description, pick approved skills, and configure ai-rules for the repo.` | §7.2: bốn việc; mỗi việc đề xuất rồi chờ đồng ý; khuôn mô tả 5 mục trong `CLAUDE.md`, ≤ 40 dòng, ghi sau khi thiết kế được duyệt; chỉ chọn skill trong `.claude/ai-rules/catalog.md` và nói rõ mục nào không có ở cloud; mặc định không tạo hook/skill riêng; khai báo `verify.commands` và `e2ePreflight` trong `.claude/ai-rules.json`; chạy được khi không có superpowers |
| `ai-rules-creating-prs` | `Use when creating a branch or opening a pull request.` | §7.3: nhánh `type/short-description`; tiêu đề `type(scope): summary` ≤ 72 ký tự và danh sách 9 type; bốn mục `## Summary`, `## Why`, `## Changes`, `## Testing`; `## Testing` nêu cả phần chưa kiểm tra; một PR một mục đích; không tự merge, không push lên nhánh chính |
| `ai-rules-writing-comments` | `Use when writing a commit message, a code comment, or a comment on a pull request.` | §7.4: ba phần — commit message, comment trong code, comment trên PR |
| `ai-rules-handling-failures` | `Use when an e2e, test, build or lint command fails, before re-running it.` | §7.5: đọc `.claude/known-issues.md` trước; ba loại `environment`, `flaky`, `real` và cách xử lý từng loại; chỉ chạy lại phần fail; đề xuất ghi mục mới vào sổ (khuôn 4 trường) khi người dùng đồng ý; tối đa khoảng 30 mục |
| `ai-rules-saving-tokens` | `Use when a task involves reading many files, long command output, or many tool calls.` | §7.6 |
| `ai-rules-backend-basics` | `Use when designing or changing server-side code: APIs, data access, background jobs.` | Kiểm tra đầu vào ở biên; lỗi trả về nhất quán; thao tác ghi lặp lại an toàn; truy vấn có tham số và giao dịch; migration tương thích ngược; timeout và retry cho lời gọi ra ngoài; log không chứa dữ liệu nhạy cảm; test ở mức hành vi. ≤ 100 dòng |
| `ai-rules-security-basics` | `Use when code handles user input, authentication, secrets, files, or external requests.` | Không tin đầu vào; chống injection (SQL, lệnh shell, đường dẫn, HTML); xác thực và phân quyền ở server; secret qua biến môi trường; băm mật khẩu bằng thuật toán chuyên dụng; hạn chế quyền tối thiểu; kiểm tra dependency; không log secret; gợi ý chạy `/security-review` trước khi mở PR. ≤ 100 dòng |

`catalog.md`: dòng đánh dấu, tiêu đề `# Approved skills`, một câu "Only suggest entries from this table, and ask the user before installing.", rồi bảng với các cột `Area | Skill | Source | Suggest when | Available in cloud sessions` và ba dòng theo §7.7 của spec (`frontend-design` — official marketplace — No; `/security-review` + `ai-rules-security-basics` — built in + this repo — Yes; `ai-rules-backend-basics` — this repo — Yes).

- [ ] **Step 1: Thêm test fail vào `tests/content.test.cjs`**

```js
const SKILLS = {
  'ai-rules-repo-setup': ['CLAUDE.md', 'catalog.md', '.claude/ai-rules.json', 'e2ePreflight'],
  'ai-rules-creating-prs': ['## Summary', '## Why', '## Changes', '## Testing', '72', 'refactor'],
  'ai-rules-writing-comments': ['commit', 'pull request'],
  'ai-rules-handling-failures': ['known-issues.md', 'environment', 'flaky'],
  'ai-rules-saving-tokens': ['search', 'output'],
  'ai-rules-backend-basics': ['migration', 'timeout'],
  'ai-rules-security-basics': ['injection', '/security-review'],
};
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
    'Available in cloud sessions']) assert.ok(c.includes(n), n);
});
test('AGENTS.md lists every content skill', () => {
  const a = sync.generateAgentsMd(PAYLOAD);
  for (const name of Object.keys(SKILLS)) assert.ok(a.includes(`.claude/skills/${name}/SKILL.md`), name);
});
```

- [ ] **Step 2: Chạy, xác nhận fail** — Run: `node --test tests/content.test.cjs`
- [ ] **Step 3: Viết 7 skill và `catalog.md`.**
- [ ] **Step 4: Chạy, xác nhận pass** — Expected: 6 pass.
- [ ] **Step 5: Commit** — `feat(skills): add content skills and approved-skill catalog`

---

### Task 14: Workflow đồng bộ và README

**Files:**
- Create: `plugins/ai-rules/payload/starter/ai-rules-sync.yml`, `README.md`
- Test: `tests/docs.test.cjs`

**Interfaces:**
- Consumes: CLI `sync.cjs --target .` (Task 10); bảng ánh xạ starter.

`ai-rules-sync.yml` (nguyên văn):

```yaml
name: ai-rules sync
on:
  schedule:
    - cron: "17 3 * * *"
  workflow_dispatch:
permissions:
  contents: write
  pull-requests: write
jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/checkout@v4
        with:
          repository: phong190897/ai-rules
          path: .ai-rules-src
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - name: Sync managed files
        run: |
          node .ai-rules-src/plugins/ai-rules/scripts/sync.cjs --target .
          rm -rf .ai-rules-src
      - name: Open pull request
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          if [ -z "$(git status --porcelain)" ]; then
            echo "Already up to date."
            exit 0
          fi
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git switch -C chore/sync-ai-rules
          git add -A
          git commit -m "chore: sync ai-rules"
          git push --force origin chore/sync-ai-rules
          if [ -z "$(gh pr list --head chore/sync-ai-rules --state open --json number --jq '.[].number')" ]; then
            gh pr create --title "chore: sync ai-rules" --body "$(printf '## Summary\nSync managed ai-rules files from phong190897/ai-rules.\n\n## Why\nKeep rules, hooks and skills identical across repositories.\n\n## Changes\nGenerated by sync.cjs; no hand edits.\n\n## Testing\nNot run: generated files only.')"
          fi
```

`README.md` (tiếng Việt) gồm các phần, theo thứ tự:

1. Một đoạn: repo này là gì và giải quyết ba vấn đề nào (spec §1).
2. **Cài trên mỗi máy** — hai lệnh, mỗi lệnh một khối `bash`: `claude plugin marketplace add phong190897/ai-rules` và `claude plugin install ai-rules@ai-rules-marketplace`; rồi cách bật tự cập nhật (`/plugin` → Marketplaces → Enable auto-update).
3. **Bắt đầu một repo mới** — lần đầu mở phiên trong một repo git chưa thiết lập, plugin quét nhanh và AI hỏi một lần có thiết lập không (spec §12: quét những gì, và mỗi repo chỉ được hỏi một lần); hoặc tự gọi skill `ai-rules:init-repo`; danh sách file được tạo (bảng ánh xạ); bật "Allow GitHub Actions to create and approve pull requests".
4. **Rule mới đến repo con thế nào** — hai đường ở spec §5.3.
5. **Hỗ trợ theo môi trường** — nguyên bảng ở spec §6, kèm lời khuyên mở mỗi repo một phiên cloud riêng.
6. **Hook làm gì** — bảng ba mức (chặn / hỏi / nhắc) theo spec §8, và bảng giới hạn chạy lại ở §8.1.
7. **Cấu hình từng repo** — ví dụ `.claude/ai-rules.json` ở spec §8.3 và ý nghĩa từng trường, gồm `commitMsg.scope` (`"ai"` mặc định, `"all"` để áp dụng cho mọi commit).
8. **Phát triển** — `npm test`; sau khi sửa `payload/` phải chạy `node plugins/ai-rules/scripts/sync.cjs --target .` để cập nhật bản sao của chính repo này.

- [ ] **Step 1: Viết test fail**

```js
// tests/docs.test.cjs
const test = require('node:test'); const assert = require('node:assert');
const fs = require('node:fs');
test('sync workflow', () => {
  const y = fs.readFileSync('plugins/ai-rules/payload/starter/ai-rules-sync.yml', 'utf8');
  for (const n of ['workflow_dispatch', 'schedule', 'repository: phong190897/ai-rules', 'pull-requests: write',
    'sync.cjs --target .', 'chore: sync ai-rules', '## Testing'])
    assert.ok(y.includes(n), n);
  assert.equal(y.includes('\t'), false);
});
test('README covers install, environments and configuration', () => {
  const r = fs.readFileSync('README.md', 'utf8');
  for (const n of ['claude plugin marketplace add phong190897/ai-rules',
    'claude plugin install ai-rules@ai-rules-marketplace', 'ai-rules:init-repo', 'Project thread',
    'AGENTS.md', 'maxFailedRunsWithoutChange', 'commitMsg', 'npm test'])
    assert.ok(r.includes(n), n);
});
```

- [ ] **Step 2: Chạy, xác nhận fail** — Run: `node --test tests/docs.test.cjs`
- [ ] **Step 3: Ghi workflow nguyên văn và viết README.**
- [ ] **Step 4: Chạy, xác nhận pass** — Expected: 2 pass. Rồi `npm test` — tất cả pass.
- [ ] **Step 5: Commit** — `docs: add sync workflow and README`

---

### Task 15: Tự áp dụng lên repo gốc và kiểm chứng với Claude Code thật

**Files:**
- Create (do `sync.cjs` sinh): `AGENTS.md`, `CLAUDE.md`, `.claude/**`, `.github/workflows/ai-rules-sync.yml`
- Create: `tests/dogfood.test.cjs`, `docs/verification.md`
- Modify: `CLAUDE.md`, `.claude/ai-rules.json`; các file khác tuỳ kết quả kiểm chứng

**Interfaces:**
- Consumes: toàn bộ các task trước.

- [ ] **Step 1: Viết test fail**

```js
// tests/dogfood.test.cjs
const test = require('node:test'); const assert = require('node:assert');
const sync = require('../plugins/ai-rules/scripts/sync.cjs');
test('this repo runs the current version of its own payload', () => {
  const m = sync.readManifest('.');
  assert.ok(m, 'run: node plugins/ai-rules/scripts/sync.cjs --init --target .');
  assert.equal(m.sourceVersion, sync.computeSourceVersion('plugins/ai-rules/payload'));
});
```

- [ ] **Step 2: Chạy, xác nhận fail** — Run: `node --test tests/dogfood.test.cjs` — Expected: FAIL với thông điệp `run: node …`.

- [ ] **Step 3: Áp dụng lên chính repo này**

Run: `node plugins/ai-rules/scripts/sync.cjs --init --target .`

Rồi điền `CLAUDE.md` theo khuôn (≤ 40 dòng): repo là plugin `ai-rules`; Stack: Node.js ≥ 20, không dependency; Commands: Test `npm test`, các mục khác ghi `n/a`; Structure: `plugins/ai-rules/payload` là nguồn, `.claude/` là bản sao sinh ra; Conventions: sửa payload xong phải chạy lại sync. Và đặt `.claude/ai-rules.json` thành `{ "source": "phong190897/ai-rules", "mainBranch": "main", "verify": { "commands": { "test": ["npm test", "node --test"] } } }`.

- [ ] **Step 4: Chạy toàn bộ test** — Run: `npm test` — Expected: tất cả pass.

- [ ] **Step 5: Commit** — `chore: apply ai-rules to this repository`

- [ ] **Step 6: Kiểm chứng ở máy (cần người dùng; chỉ push khi người dùng yêu cầu)**

Ghi kết quả từng mục vào `docs/verification.md` (đạt / không đạt / ghi chú). Đặt `AI_RULES_DEBUG=1` để xem dữ liệu hook thật trong `<thư mục tạm>/ai-rules/debug.log`.

| # | Kiểm tra | Mong đợi |
|---|---|---|
| 1 | Sau khi push: `claude plugin marketplace add phong190897/ai-rules` rồi `claude plugin install ai-rules@ai-rules-marketplace` | Cài được; skill `ai-rules:init-repo` xuất hiện |
| 2 | Bật tự cập nhật; xem giá trị `autoUpdate` mà Claude Code ghi | Khớp với `true` trong starter `settings.json` |
| 3 | Trong một repo thử: gọi `ai-rules:init-repo`, mở phiên mới | Rule cốt lõi có trong ngữ cảnh; 7 skill `ai-rules-*` có trong danh sách |
| 4 | Yêu cầu AI chạy một lệnh e2e luôn fail | Lần thứ ba bị chặn với thông điệp `ai-rules:` |
| 5 | Xem `debug.log` của mục 4 | Xác định lệnh fail đến qua `PostToolUseFailure` hay `PostToolUse`, và trường nào mang mã thoát |
| 6 | Yêu cầu AI sửa `.claude/ai-rules.json`; yêu cầu `npm install <gói>` | Hiện hộp hỏi người dùng |
| 7 | Yêu cầu AI commit với message sai định dạng | Bị từ chối; xác nhận biến `CLAUDECODE` có trong môi trường của hook git |
| 8 | Yêu cầu AI mở PR thiếu mục `## Testing` | Bị chặn, lý do liệt kê mục thiếu |
| 9 | Sửa một dòng trong `ai-rules-core.md` ở repo gốc, push; mở phiên mới ở repo thử | Có dòng `an update is available` |
| 10 | Chạy tay workflow `ai-rules sync` ở repo thử | Mở PR `chore: sync ai-rules` |
| 11 | Mở phiên mới trong một repo git khác chưa thiết lập; rồi mở phiên lần hai | Lần đầu AI nêu kết quả quét và hỏi có thiết lập không; lần hai không hỏi lại |

- [ ] **Step 7: Kiểm chứng ở cloud (cần người dùng)**

Mở một phiên cloud một repo trên repo thử: lặp lại mục 3, 4, 6, 8; xác nhận có dòng `this is a cloud session`. Ghi rõ mức "hỏi người dùng" ở cloud có hiện hộp hỏi hay không.

- [ ] **Step 8: Sửa theo kết quả**

Mỗi mục không đạt là một vòng TDD riêng (test fail → sửa → pass → commit). Hai chỗ đã biết trước cách sửa:

- Mục 5 cho thấy dạng dữ liệu khác với `commandFailed` hiện tại → thêm ca vào `tests/lib.test.cjs` bằng dữ liệu thật rồi sửa `commandFailed`.
- Mức "hỏi" không hiện ở cloud → trong `hook-pre-tool.cjs`, khi `CLAUDE_CODE_REMOTE === 'true'` đổi `ask` thành `deny` và nối thêm vào lý do ` Report this to the user instead.`; thêm test tương ứng vào `tests/hooks.test.cjs`.

Sau mỗi lần sửa payload: chạy lại `node plugins/ai-rules/scripts/sync.cjs --target .` rồi `npm test`.

- [ ] **Step 9: Commit kết quả kiểm chứng** — `docs: record verification results`
