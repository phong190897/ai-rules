# Architecture Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi repo dùng ai-rules có một mục Architecture trong `CLAUDE.md` do người dùng quyết định từ vài phương án AI đưa ra; AI làm theo nó; và danh mục kiến trúc được cập nhật ở một nơi.

**Architecture:** Toàn bộ là nội dung trong `plugins/ai-rules/payload/`: một skill mới `ai-rules-architecture`, một danh mục `architectures.md`, vài chỗ sửa ở `ai-rules-repo-setup`, rule cốt lõi và mẫu `CLAUDE.md`. Không có hook mới: việc kiểm tra ranh giới do công cụ của từng stack làm, chạy cùng lint. Repo gốc có thêm một skill riêng để cập nhật danh mục.

**Tech Stack:** Markdown; test bằng `node:test` (kiểm tra nội dung như các skill khác).

**Spec:** `docs/superpowers/specs/2026-11-15-ai-rules-plugin-design.md`, mục 13.

## Global Constraints

- Không thêm dependency. Skill, rule và danh mục viết bằng tiếng Anh. Rule cốt lõi ≤ 40 dòng; skill ≤ 150 dòng; `architectures.md` ≤ 150 dòng.
- File dưới `payload/managed/` có dòng `Managed by ai-rules. Do not edit; overwritten on sync.`; `SKILL.md` đặt nó ngay sau frontmatter.
- **Không có kiến trúc mặc định.** AI đưa ra hai hoặc ba phương án, nói mình nghiêng về phương án nào, và người dùng quyết định.
- Sau khi sửa `payload/`: chạy `node plugins/ai-rules/scripts/sync.cjs --bump` rồi `node plugins/ai-rules/scripts/sync.cjs --target .`, và commit kết quả.
- `CLAUDE.md` của repo con: giới hạn mới là **60 dòng**; mục `## Architecture` thay cho `## Structure`.
- Làm trên nhánh `feat/architecture-guidance`. Commit theo chuẩn của repo. Không push khi người dùng chưa yêu cầu.

## Review Focus

1. **Repo đã thiết lập từ trước, `CLAUDE.md` còn mục `## Structure`:** AI đề xuất chuyển nó thành `## Architecture`, không tạo hai mục song song. → test ở Task 1.
2. **Người dùng từ chối quyết định kiến trúc:** không được hỏi lại ở mọi phiên. → skill ghi `Style: not decided (user choice)`; test ở Task 1.
3. **Không kiểu nào trong danh mục phù hợp, hoặc stack không có công cụ kiểm tra:** AI nói rõ, không bịa. → test ở Task 1.
4. **Repo có sẵn code lẫn lộn nhiều kiểu:** kiến trúc được chọn là mục tiêu; AI không tự sửa code cũ. → test ở Task 1.
5. **Script được quản lý `require` ra ngoài thư mục của nó** (sẽ hỏng khi chép sang repo khác): luật phụ thuộc của chính repo này. → test ở Task 3.

---

### Task 1: Skill `ai-rules-architecture` và danh mục kiến trúc

**Files:**
- Create: `plugins/ai-rules/payload/managed/skills/ai-rules-architecture/SKILL.md`, `plugins/ai-rules/payload/managed/ai-rules/architectures.md`
- Modify: `plugins/ai-rules/payload/managed/ai-rules/catalog.md`, `tests/content.test.cjs`

**Interfaces:**
- Produces: tên skill `ai-rules-architecture`, đường dẫn `.claude/ai-rules/architectures.md` và khuôn mục Architecture mà Task 2 và Task 4 dùng.

**`architectures.md`** — dòng đánh dấu, tiêu đề `# Architecture catalog`, dòng `Last reviewed: 2026-11-16`, một câu nói rằng đây là điểm khởi đầu chứ không phải giới hạn, rồi 8 mục. Mỗi mục có đúng khuôn:

```markdown
### <Name>
- What it is: <one sentence>
- Fits when: <conditions>
- Does not fit when: <conditions>
- Typical modules and rule: <how code is divided, and the one dependency rule that defines it>
```

Tên 8 mục (nguyên văn): `Modular monolith`, `N-Layer`, `Clean / Hexagonal`, `Vertical slice`, `Microservices`, `Microfrontend`, `Event-driven`, `Serverless`.

Cuối file: `## Boundary tools` với bảng `Stack | Tool`: JavaScript / TypeScript → `dependency-cruiser` hoặc `eslint-plugin-boundaries`; Python → `import-linter`; Java / Kotlin → ArchUnit; .NET → NetArchTest; Go → `depguard` (qua `golangci-lint`); và một dòng: stack khác chưa có công cụ, chỉ dùng rule.

**`SKILL.md`** — frontmatter (nguyên văn): `name: ai-rules-architecture`, `description: Use when choosing or recording a project's architecture, or before adding code that crosses module boundaries.` Thân bài có đủ các phần:

1. **Start.** Đọc `.claude/ai-rules/architectures.md`. Nếu `CLAUDE.md` có mục `## Structure` cũ thì đề xuất chuyển nó thành `## Architecture`, không giữ cả hai.
2. **New repository.** Hỏi từng câu một (`one at a time`) về bốn chủ đề: quy mô và số người làm; cách triển khai; các mảng nghiệp vụ chính; yêu cầu đặc biệt. Rồi đưa ra `two or three` kiến trúc phù hợp; với mỗi cái nêu: vì sao hợp với dự án này, cái giá ở dự án này, điều gì khiến nó thành lựa chọn sai. Nói mình nghiêng về cái nào và vì sao. Không có mặc định; `the user decides`.
3. **Existing repository with a clear architecture.** Nhận ra từ cấu trúc thư mục và hướng import; ghi đúng hiện trạng; không đề xuất đổi khi chưa được hỏi.
4. **Existing repository without one.** Mô tả hiện trạng kèm đường dẫn làm bằng chứng; đưa ra `two or three` kiến trúc repo có thể hướng tới, mỗi cái kèm mức phù hợp, công chuyển đổi và phần được giữ nguyên; người dùng quyết định. Ghi là mục tiêu: `- Style: <style> (target; <what does not follow it yet>)`. Code mới theo mục tiêu; không sửa code cũ cho khớp khi chưa được yêu cầu.
5. **Outside the catalog.** Khi không kiểu nào phù hợp, được đề xuất kiểu khác; nói rõ nó `not in the catalog` và gợi ý thêm vào danh mục ở repo nguồn.
6. **Khuôn mục Architecture** (nguyên văn):

   ```markdown
   ## Architecture
   - Style: <style>. Chosen because <reason>.
   - Modules: `<path>/` <what it owns>; ...
   - Dependency rules: <what may import what>.
   - New code: <where a new feature goes>.
   ```

   Monorepo: vẫn một mục; mỗi package một dòng trong Modules.
7. **User declines.** Ghi `- Style: not decided (user choice)` và không hỏi lại.
8. **Boundary check.** Sau khi mục Architecture được duyệt, đề xuất công cụ trong bảng `Boundary tools` của danh mục; hỏi trước khi cài; đọc tài liệu của công cụ trước khi viết cấu hình; cho chạy cùng lint (script lint sẵn có, hoặc `verify.commands.lint` trong `.claude/ai-rules.json`). Stack không có công cụ: nói rõ, chỉ dùng rule. Monorepo: mỗi package dùng công cụ của stack mình.

**`catalog.md`**: thêm dòng `| Architecture | \`ai-rules-architecture\` | this repo | choosing or recording the architecture, or adding a boundary check | Yes |`.

- [ ] **Step 1: Thêm test fail vào `tests/content.test.cjs`**

Thêm vào object `SKILLS`:

```js
  'ai-rules-architecture': ['architectures.md', 'one at a time', 'two or three', 'the user decides', '## Architecture',
    'Dependency rules:', 'New code:', '## Structure', 'not decided (user choice)', '(target;', 'not in the catalog',
    'verify.commands.lint', 'Monorepo'],
```

Thêm `'ai-rules-architecture'` vào danh sách chuỗi mà test `catalog lists…` kiểm tra. Và thêm test:

```js
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
```

- [ ] **Step 2: Chạy, xác nhận fail** — Run: `node --test tests/content.test.cjs` — Expected: FAIL ở test `each content skill…`, test catalog và test mới (ENOENT).
- [ ] **Step 3: Viết `architectures.md`, `SKILL.md` và sửa `catalog.md`.**
- [ ] **Step 4: Chạy, xác nhận pass** — Run: `node --test tests/content.test.cjs` — Expected: mọi test trong file pass.
- [ ] **Step 5: Commit** — `git add docs plugins tests && git commit -m "feat(skills): add architecture skill and catalog"` (commit này gồm cả mục 13 của spec và file kế hoạch).

---

### Task 2: Nối vào rule cốt lõi, `repo-setup`, mẫu `CLAUDE.md`, `init-repo`, README

**Files:**
- Modify: `plugins/ai-rules/payload/managed/rules/ai-rules-core.md`, `plugins/ai-rules/payload/managed/skills/ai-rules-repo-setup/SKILL.md`, `plugins/ai-rules/payload/starter/CLAUDE.md`, `plugins/ai-rules/skills/init-repo/SKILL.md`, `README.md`
- Modify (test): `tests/content.test.cjs`, `tests/docs.test.cjs`

**Interfaces:**
- Consumes: skill `ai-rules-architecture` và khuôn mục Architecture (Task 1).

Rule cốt lõi — thêm hai dòng (nguyên văn) ngay sau dòng `- PRs, commits, comments: …`, tức là trong phần dùng chung để `AGENTS.md` cũng có:

```markdown
- Architecture: follow the Architecture section of `CLAUDE.md`. Put new code in the module that owns it; ask the user before crossing a module boundary or breaking a dependency rule. Details: `ai-rules-architecture`.
- No architecture yet: if `CLAUDE.md` has no filled Architecture section and the task is more than a small fix, propose filling it first with `ai-rules-architecture`.
```

`ai-rules-repo-setup`:
- Việc 1: danh sách mục đổi thành What this is, Stack, Commands, **Architecture**, Conventions; giới hạn `60 lines or fewer`; thêm câu: trước khi viết mô tả, dùng `ai-rules-architecture` để người dùng chọn (repo mới, hoặc repo chưa có kiến trúc nhất định) hoặc để ghi lại (repo có kiến trúc rõ) kiến trúc.
- Thêm việc 5 "Boundary check": sau khi mục Architecture được duyệt, đề xuất công cụ kiểm tra theo `ai-rules-architecture` và gắn lệnh của nó vào lint (`verify.commands.lint`). Câu mở đầu của skill đổi "four jobs" thành "five jobs".

Starter `CLAUDE.md`: thay khối `## Structure` bằng

```markdown
## Architecture
- Style:
- Modules:
- Dependency rules:
- New code:
```

`init-repo`: trong bước hỏi về `CLAUDE.md` sẵn có, danh sách mục chuẩn đổi thành `(What this is, Stack, Commands, Architecture, Conventions)`.

README: thêm phần `## Kiến trúc của từng repo` ngay trước `## Rule mới đến repo con như thế nào`, gồm: AI đưa ra hai hoặc ba phương án và bạn quyết định (skill `ai-rules-architecture`); ba trường hợp repo; bốn phần của mục Architecture; danh mục ở `.claude/ai-rules/architectures.md`; bảng công cụ kiểm tra theo stack, chạy cùng lint.

- [ ] **Step 1: Thêm test fail**

Trong `tests/content.test.cjs`: ở `SKILLS['ai-rules-repo-setup']` thêm `'ai-rules-architecture'`, `'60 lines'`, `'five jobs'`; ở test `core rules fit the budget…` thêm `'ai-rules-architecture'` vào danh sách skill phải được nhắc tới; và thêm:

```js
test('core rules, starter and init-repo carry the architecture section', () => {
  const core = fs.readFileSync(`${MANAGED}/rules/ai-rules-core.md`, 'utf8');
  assert.match(core, /^- Architecture: follow the Architecture section of `CLAUDE\.md`\./m);
  assert.match(core, /^- No architecture yet: /m);
  assert.ok(core.indexOf('- Architecture:') < core.indexOf('## Claude Code only'));
  const starter = fs.readFileSync(`${PAYLOAD}/starter/CLAUDE.md`, 'utf8');
  for (const n of ['## Architecture', '- Style:', '- Modules:', '- Dependency rules:', '- New code:'])
    assert.ok(starter.includes(n), n);
  assert.equal(starter.includes('## Structure'), false);
  const setup = fs.readFileSync(`${MANAGED}/skills/ai-rules-repo-setup/SKILL.md`, 'utf8');
  assert.equal(setup.includes('40 lines'), false);
  assert.ok(fs.readFileSync('plugins/ai-rules/skills/init-repo/SKILL.md', 'utf8').includes('Commands, Architecture, Conventions'));
  const agents = sync.generateAgentsMd(PAYLOAD);
  assert.match(agents, /- Architecture: follow the Architecture section/);
});
```

Trong `tests/docs.test.cjs`: thêm `'ai-rules-architecture'`, `'architectures.md'`, `'dependency-cruiser'` vào danh sách README.

- [ ] **Step 2: Chạy, xác nhận fail** — Run: `node --test tests/content.test.cjs tests/docs.test.cjs` — Expected: FAIL ở test mới, test `each content skill…`, test `core rules fit…` và test README.
- [ ] **Step 3: Sửa năm file** theo mô tả trên.
- [ ] **Step 4: Chạy, xác nhận pass** — Run: `node --test tests/content.test.cjs tests/docs.test.cjs` — Expected: tất cả pass (rule cốt lõi vẫn ≤ 40 dòng).
- [ ] **Step 5: Commit** — `feat(rules): make every repo record and follow an architecture`

---

### Task 3: Áp dụng lên chính repo này

**Files:**
- Modify: `CLAUDE.md` (gốc repo), `tests/helpers.cjs`, `plugins/ai-rules/payload/VERSION` và các bản sao sinh ra (`.claude/**`, `AGENTS.md`)
- Create: `tests/boundaries.test.cjs`

**Interfaces:**
- Consumes: khuôn mục Architecture (Task 1).
- Produces: `findEscapingRequires(rootDir: string): string[]` trong `tests/helpers.cjs` — trả về danh sách `"<file tương đối>: <đường dẫn require>"` cho mọi `require('./…')` hoặc `require('../…')` trong các file `.cjs` dưới `rootDir` mà đích nằm ngoài `rootDir`.

Mục Architecture của repo này (thay mục `## Structure` trong `CLAUDE.md` gốc; giữ file ≤ 60 dòng). Đây là ghi lại kiến trúc đang có, trường hợp "kiến trúc rõ":

```markdown
## Architecture
- Style: one plugin that owns a payload and copies it into other repos. Chosen because the same files must run from a repo checkout, locally and in cloud sessions.
- Modules: `plugins/ai-rules/payload/` source of truth (`managed/` copied as is, `starter/` created once, `settings-fragment.json` merged); `plugins/ai-rules/scripts/` the plugin's own sync, scan and update check; `plugins/ai-rules/skills/` and `hooks/` the plugin's runtime; `tests/` one file per area; `.claude/`, `AGENTS.md` generated copies.
- Dependency rules: files under `payload/managed/ai-rules/scripts/` require only Node built-ins and each other, never anything outside that folder, because they are copied alone. `plugins/ai-rules/scripts/` may require them, not the other way round. No npm dependencies.
- New code: a guard goes in `payload/managed/ai-rules/scripts/guards/` with its test in `tests/`; anything that only the plugin runs goes in `plugins/ai-rules/scripts/`.
```

- [ ] **Step 1: Viết test fail**

```js
// tests/boundaries.test.cjs
const test = require('node:test'); const assert = require('node:assert');
const path = require('node:path');
const { makeRepo, findEscapingRequires } = require('./helpers.cjs');

test('findEscapingRequires reports a require that leaves the folder', () => {
  const d = makeRepo({
    'lib/a.cjs': "const b = require('./b.cjs'); const fs = require('node:fs');",
    'lib/b.cjs': "module.exports = require('../../outside.cjs');",
    'hook.cjs': "require('./lib/a.cjs');" });
  assert.deepEqual(findEscapingRequires(d), ['lib/b.cjs: ../../outside.cjs']);
});
test('managed scripts never require anything outside their own folder', () => {
  const dir = path.resolve('plugins/ai-rules/payload/managed/ai-rules/scripts');
  assert.deepEqual(findEscapingRequires(dir), []);
});
```

- [ ] **Step 2: Chạy, xác nhận fail** — Run: `node --test tests/boundaries.test.cjs` — Expected: FAIL (`findEscapingRequires is not a function`).
- [ ] **Step 3: Viết `findEscapingRequires` trong `tests/helpers.cjs`** và export nó. Tìm bằng regex `require\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)`; đường dẫn trả về dùng `/`.
- [ ] **Step 4: Chạy, xác nhận pass** — Run: `node --test tests/boundaries.test.cjs` — Expected: 2 pass.
- [ ] **Step 5: Sửa `CLAUDE.md` gốc** theo khối ở trên.
- [ ] **Step 6: Commit** — `test: guard the dependency rule of managed scripts` (chưa bump; Task 4 bump và đồng bộ một lần cho cả nhánh).

---

### Task 4: Skill cập nhật danh mục ở repo gốc, bump và đồng bộ

**Files:**
- Create: `.claude/skills/update-architectures/SKILL.md` (skill riêng của repo này: không được quản lý, không có tiền tố `ai-rules-`, không có dòng đánh dấu), `tests/maintenance.test.cjs`
- Modify: `README.md` (phần Phát triển), `plugins/ai-rules/payload/VERSION` và các bản sao sinh ra

**Interfaces:**
- Consumes: khuôn mỗi mục của `architectures.md` và dòng `Last reviewed:` (Task 1).

Frontmatter (nguyên văn): `name: update-architectures`, `description: Use when the user asks to review or update the architecture catalog of ai-rules.` Các bước bắt buộc trong thân bài:

1. Đọc `plugins/ai-rules/payload/managed/ai-rules/architectures.md`.
2. Tìm hiểu trên web các kiểu kiến trúc và công cụ kiểm tra ranh giới. Nếu phiên không có công cụ tìm web thì nói rõ và dừng; không cập nhật từ trí nhớ.
3. Tiêu chí nhận: có tài liệu từ ít nhất hai nguồn độc lập và được dùng thật trong sản phẩm. Không thêm một kiểu chỉ vì nó mới.
4. Trình bày cho người dùng từng thay đổi đề xuất (thêm, sửa, bỏ) kèm đường dẫn nguồn (`sources`); người dùng chọn thay đổi nào được nhận.
5. Sửa danh mục theo đúng khuôn mỗi mục; cập nhật `Last reviewed:` thành ngày hôm nay; giữ file ≤ 150 dòng. Nếu thêm tên kiểu mới thì cập nhật danh sách tên trong `tests/content.test.cjs`.
6. Chạy `node plugins/ai-rules/scripts/sync.cjs --bump`, `node plugins/ai-rules/scripts/sync.cjs --target .`, rồi `npm test`.
7. Commit trên nhánh riêng và mở pull request theo `ai-rules-creating-prs`, chỉ khi người dùng đồng ý.

README, phần Phát triển: thêm một đoạn nói danh mục kiến trúc nằm ở đâu và cập nhật bằng skill `update-architectures`.

- [ ] **Step 1: Viết test fail**

```js
// tests/maintenance.test.cjs
const test = require('node:test'); const assert = require('node:assert');
const fs = require('node:fs');
test('this repo has its own skill to update the architecture catalog', () => {
  const s = fs.readFileSync('.claude/skills/update-architectures/SKILL.md', 'utf8');
  assert.match(s, /^---\nname: update-architectures\ndescription: Use when .+\n---\n/);
  assert.equal(s.includes('Managed by ai-rules'), false);
  for (const n of ['plugins/ai-rules/payload/managed/ai-rules/architectures.md', 'Last reviewed:', 'sources',
    'two independent', 'sync.cjs --bump', 'sync.cjs --target .', 'npm test', 'pull request', 'tests/content.test.cjs'])
    assert.ok(s.includes(n), n);
  assert.ok(fs.readFileSync('README.md', 'utf8').includes('update-architectures'));
});
```

- [ ] **Step 2: Chạy, xác nhận fail** — Run: `node --test tests/maintenance.test.cjs` — Expected: FAIL (ENOENT).
- [ ] **Step 3: Viết skill và sửa README.**
- [ ] **Step 4: Bump và đồng bộ**

```bash
node plugins/ai-rules/scripts/sync.cjs --bump
node plugins/ai-rules/scripts/sync.cjs --target .
```

Xác nhận `.claude/skills/update-architectures/` vẫn còn sau khi đồng bộ (nó không nằm trong manifest nên không được đụng tới).

- [ ] **Step 5: Chạy toàn bộ test** — Run: `npm test` — Expected: tất cả pass, gồm test dogfood (bản sao khớp payload) và test VERSION.
- [ ] **Step 6: Commit** — `feat: add a repo skill to keep the architecture catalog current, and sync`
