# Thiết kế: `ai-rules` — rules, hooks, skills dùng chung cho mọi repo viết bằng AI

Ngày: 2026-11-15 · Trạng thái: đã duyệt

## 1. Mục đích và lý do

Một nguồn duy nhất chứa rules, hooks và skills để hướng dẫn và ngăn chặn AI khi nó sửa code trong các repo. Sửa một lần ở repo gốc, các repo con nhận bản mới, và hoạt động cả ở máy lẫn phiên cloud.

Ba vấn đề gốc cần giải quyết:

1. **AI chạy quá lâu.** Khi e2e fail vì lỗi môi trường hoặc lỗi chập chờn, AI chạy lại nhiều lần, tốn token và thời gian.
2. **Thiếu nhất quán.** Mỗi repo mới phải soạn lại `CLAUDE.md`, nên AI hành xử khác nhau ở từng repo.
3. **PR và comments không theo một chuẩn.**

## 2. Mục tiêu, ngoài phạm vi, điều phải tránh

**Mục tiêu**

- Rules chung về việc AI nên và không nên làm gì trong một repo, gồm rule tiết kiệm token.
- Hooks chặn thật sự những hành vi quan trọng nhất (không chỉ nhắc).
- Mọi repo con dùng superpowers (ở máy).
- Khi brainstorm trong repo con, AI: viết mô tả dự án cho repo đó, đề xuất cài skill phù hợp (UI, backend, security) từ danh mục đã duyệt, và cân nhắc tạo hook/skill riêng cho repo.
- Chuẩn thống nhất cho PR, commit message, comment trong code và comment trên PR.
- Repo con nhận rule mới khi repo gốc thay đổi, kể cả repo chỉ dùng qua cloud.
- Rules, hooks và skills của `ai-rules` có hiệu lực ở **phiên cloud một repo** (claude.ai/code).
- Rule (không phải hook) dùng được cho AI khác qua `AGENTS.md`.
- Giới hạn theo từng môi trường được **ghi rõ** trong README và trong hướng dẫn mà AI đọc (mục 6).

**Ngoài phạm vi (bản đầu)**

- Hook cho công cụ khác ngoài Claude Code. Với AI khác chỉ có rule và hook `commit-msg` của git.
- Hook và skill ở phiên cloud nhiều repo và project thread: Claude Code không chạy chúng ở đó.
- Superpowers và các plugin trong danh mục ở phiên cloud: cloud không nạp plugin do repo khai báo.
- AI tự cài skill ngoài danh mục, hoặc cài mà không hỏi.

**Điều phải tránh (làm được vẫn coi là thất bại)**

- Rules phình to làm tốn token mỗi phiên. Phần luôn nạp phải ≤ 40 dòng.
- Hook chặn nhầm thường xuyên. Mỗi lần chặn nhầm là tốn thêm token, ngược mục đích. Thà ít hook mà chắc.
- Bản sao rule trong repo con bị sửa tay rồi lệch dần. Bản sao chỉ được tạo và ghi đè bởi công cụ đồng bộ.

## 3. Ràng buộc (đã kiểm tra trong tài liệu Claude Code ngày 2026-11-15)

**Plugin**

- Plugin không ship được `CLAUDE.md`.
- Tự cập nhật mặc định **tắt** với marketplace bên thứ ba. Bật bằng `autoUpdate` trên mục `extraKnownMarketplaces` trong settings, hoặc bằng nút trong `/plugin`. Kiểu giá trị của `autoUpdate` chưa xác minh.
- Không đặt `version` trong `plugin.json` thì phiên bản tính theo commit SHA: mỗi commit lên nhánh chính là một bản cập nhật.
- Chưa có ví dụ trong tài liệu cho plugin nằm ngay gốc marketplace, nên plugin đặt trong thư mục con.

**Hook**

- `PreToolUse` chặn bằng exit code 2 hoặc `permissionDecision: "deny"`. Stdin có `session_id`, `cwd`, `tool_name`, `tool_input.command`. Exit code 1 không chặn.
- Hook `SessionStart` thêm được ngữ cảnh bằng cách in ra stdout.
- Trên Windows, hook dạng exec cần file `.exe` thật; `node` + đường dẫn script chạy được trên mọi hệ điều hành. Dạng exec nhận `${CLAUDE_PROJECT_DIR}` trong `args`.

**Phiên cloud**

- Phiên cloud **không nạp plugin** do repo khai báo (`enabledPlugins`, `extraKnownMarketplaces`), cũng không nạp plugin cài trên máy.
- Phiên cloud **một repo** có nạp từ repo: `CLAUDE.md`, `.claude/rules/`, `.claude/skills/`, hook và permission trong `.claude/settings.json`.
- Phiên nhiều repo không nạp hook của repo nào. Project thread chỉ nạp `CLAUDE.md` và `.claude/rules/`.
- `CLAUDE_CODE_REMOTE` bằng `"true"` trong phiên cloud. Ảnh mặc định có Node.js 22.
- Phiên cloud nhiều khả năng không clone được repo khác ngoài repo đang gắn.

Hệ quả: muốn có hiệu lực ở cloud, mọi thứ phải **nằm sẵn trong repo con và đã commit**.

## 4. Các cách xây đã cân nhắc

| Cách | Mô tả | Được | Mất |
|---|---|---|---|
| 1. Chỉ plugin | Repo con chỉ trỏ về plugin; rules, hooks, skills chạy từ plugin. | Repo con gọn nhất, không có bản sao. | **Không chạy ở cloud.** Loại sau khi biết người dùng có dùng cloud. |
| **2. Plugin làm nguồn + bản sao được quản lý trong repo (đã chọn)** | Plugin giữ nội dung gốc. Mỗi repo con chứa một bản sao đã commit, và tự kéo bản mới về. Mọi thứ chạy từ bản sao. | Chạy giống nhau ở máy và cloud. Rule đọc và review được ngay trong repo. Không cần danh sách repo con ở trung tâm. | Mỗi lần rule đổi, mỗi repo có một PR đồng bộ nhỏ. |
| 3. Template + Action ở repo gốc đẩy PR sang repo con | Repo gốc giữ danh sách repo con và mở PR sang từng repo. | Một nơi điều khiển. | Phải nuôi danh sách repo con và một token có quyền ghi vào mọi repo. |
| Git submodule (loại) | | | Claude Code không tự nạp rules/hooks từ submodule; dễ quên cập nhật. |
| Cấu hình mức máy `~/.claude` (loại) | | | Không đi theo repo, không có ở cloud. |

Người dùng giao lựa chọn cho tôi. Ban đầu tôi chọn Cách 1; sau khi người dùng xác nhận có dùng cloud, chuyển sang **Cách 2**.

**Phương án nhẹ hơn cho cloud (không chọn):** chỉ sao chép rule cốt lõi vào repo, còn hooks và skills vẫn chạy từ plugin ở máy. Ít file trong repo hơn, nhưng ở cloud sẽ không có giới hạn chạy lại, không có kiểm tra PR, không có skill; mà phiên cloud chạy tự động lâu là nơi dễ lặp nhất.

## 5. Kiến trúc

### 5.1 Repo gốc

Địa chỉ: `https://github.com/phong190897/ai-rules` — **công khai**, hiện đang trống, nhánh chính sẽ là `main`. Vì công khai nên không cần token để cài plugin, tự cập nhật hay chạy workflow đồng bộ; đổi lại, không được đưa thông tin riêng tư hay secret vào repo này.

```
AIRulesHooks/                          (repo gốc = marketplace)
├── .claude-plugin/marketplace.json    khai báo plugin ai-rules, source "./plugins/ai-rules"
├── plugins/ai-rules/
│   ├── .claude-plugin/plugin.json     chỉ có name (không version → cập nhật theo commit)
│   ├── hooks/hooks.json               một hook: SessionStart → kiểm tra đồng bộ
│   ├── scripts/
│   │   ├── sync-check.js              so phiên bản, chỉ thông báo
│   │   └── sync.js                    ghi bản sao vào repo con; chạy độc lập được
│   ├── skills/
│   │   ├── init-repo/                 tạo khung cho repo mới
│   │   └── sync-repo/                 đồng bộ bản sao trong repo con
│   └── payload/                       nội dung được chép vào repo con
│       ├── managed/                   ghi đè mỗi lần đồng bộ
│       │   ├── AGENTS.md
│       │   ├── rules/ai-rules-core.md
│       │   ├── skills/ai-rules-*/SKILL.md
│       │   └── ai-rules/
│       │       ├── scripts/*.js       các hook
│       │       ├── git-hooks/commit-msg
│       │       ├── settings-fragment.json   hook và permission để trộn vào settings.json
│       │       └── catalog.md         danh mục skill đã duyệt
│       └── starter/                   tạo một lần, không bao giờ ghi đè
│           ├── CLAUDE.md
│           ├── ai-rules.json
│           ├── settings.json
│           ├── known-issues.md        sổ lỗi đã biết (trống)
│           └── ai-rules-sync.yml      workflow GitHub Actions
├── tests/                             test cho các script
├── docs/
└── README.md
```

Tên: marketplace `ai-rules-marketplace`, plugin `ai-rules` (đổi được).

### 5.2 Repo con (sau `init-repo`, tất cả đều commit)

```
repo con/
├── CLAUDE.md                          mô tả dự án (mục 7.2); không chứa rule chung
├── AGENTS.md                          [quản lý] rule cho AI khác
├── .github/workflows/ai-rules-sync.yml   tự kéo bản mới và mở PR
└── .claude/
    ├── settings.json                  hook trỏ vào .claude/ai-rules/scripts; khai báo plugin cho máy khác
    ├── ai-rules.json                  cấu hình riêng của repo
    ├── known-issues.md                sổ lỗi đã biết; chỉ đọc khi có fail
    ├── rules/ai-rules-core.md         [quản lý] rule cốt lõi, tự nạp mỗi phiên
    ├── skills/ai-rules-*/             [quản lý] các skill
    └── ai-rules/                      [quản lý] scripts, git-hooks, catalog.md, manifest.json
```

- File **[quản lý]** có dòng đầu ghi rõ "do ai-rules quản lý, không sửa tay, sẽ bị ghi đè". Thứ riêng của repo đặt ở chỗ khác: `CLAUDE.md`, `ai-rules.json`, skill và hook riêng.
- `manifest.json` ghi phiên bản nguồn và danh sách file được quản lý, để lần đồng bộ sau xoá được file đã bị gỡ ở nguồn.
- Mọi thứ **chạy từ bản sao trong repo**, cả ở máy lẫn cloud. Plugin không chạy hook chặn hay skill nội dung nào, nên không có gì bị nạp hai lần.
- Workflow không thuộc nhóm [quản lý] vì token mặc định của Actions không được phép sửa file workflow.

### 5.3 Đồng bộ: hai đường, cùng một script

**Đường tự động (GitHub Actions, dùng được cho repo chỉ chạy cloud)**

1. Workflow trong repo con chạy định kỳ (mặc định mỗi ngày) và chạy tay được.
2. Nó lấy repo gốc về, chạy `sync.js` lên repo con.
3. Nếu có thay đổi, nó mở PR `chore: sync ai-rules`. Bạn merge, hoặc bật tự merge.

Cần: repo con cho phép Actions tạo PR. Repo gốc công khai nên workflow không cần token riêng để đọc nó.

**Đường ở máy (nhanh hơn, không chờ lịch)**

1. Plugin trên máy tự cập nhật.
2. Lần tới mở phiên ở máy trong repo con, `sync-check.js` thấy bản sao cũ hơn và thêm **một dòng** vào ngữ cảnh: có bản mới, hỏi người dùng có đồng bộ không.
3. Bạn đồng ý thì AI chạy `ai-rules:sync-repo` rồi đề xuất một commit/PR riêng `chore: sync ai-rules`.

Cả hai đường: ghi đè file [quản lý], trộn phần hook và permission vào `settings.json` mà không đụng phần riêng của repo. Hook ở máy **không tự ghi file**, để thay đổi đồng bộ không lẫn vào nhánh tính năng đang làm.

`sync-check.js` chỉ báo bản mới trong repo có `.claude/ai-rules.json`. Ở repo chưa thiết lập, plugin quét nhanh và gợi ý thiết lập đúng một lần (mục 12), ngoài ra không làm gì.

### 5.4 Cài đặt

- **Mỗi máy, một lần:** thêm marketplace và cài plugin ở mức người dùng, bật tự cập nhật (lệnh ghi trong README).
- **Repo mới:** gọi `ai-rules:init-repo` trong thư mục repo.
- **Cloud:** không cần cài gì; dùng bản sao đã commit.
- Thiếu plugin trên một máy thì repo vẫn chạy bình thường bằng bản sao.

## 6. Hỗ trợ theo môi trường (phải ghi rõ cho người và cho AI)

| Môi trường | Rule cốt lõi | Skill `ai-rules-*` | Hook chặn | Plugin (superpowers, `frontend-design`…) |
|---|---|---|---|---|
| Claude Code ở máy | Có | Có | Có | Có |
| Cloud, một repo | Có | Có | Có | **Không** |
| Cloud, nhiều repo | Chưa rõ trong tài liệu | Chưa rõ trong tài liệu | **Không** | **Không** |
| Project thread | Có | **Không** | **Không** | Chỉ plugin bật trong cài đặt của project |
| AI khác (qua `AGENTS.md`) | Có | Đọc như tài liệu | **Không** (trừ `commit-msg` của git) | Không |

Bảng này được ghi ở ba nơi:

1. **README của repo gốc**: nguyên bảng, kèm lời khuyên mở mỗi repo một phiên riêng trên cloud.
2. **Rule cốt lõi** (AI đọc mỗi phiên): một dòng — ở phiên cloud không có plugin; không cố cài; tiếp tục bằng rule và skill trong repo; nếu việc đang làm cần skill chỉ có trong plugin thì nói với người dùng một lần.
3. **Thông báo đầu phiên**: `session-start.js` trong repo con thấy `CLAUDE_CODE_REMOTE=true` thì thêm một dòng nhắc đây là phiên cloud và plugin không khả dụng.

Ngoài ra `catalog.md` có cột "Có ở cloud", và `ai-rules-repo-setup` phải nói rõ điều đó khi đề xuất một plugin. `ai-rules-repo-setup` chạy được độc lập, không cần superpowers, để dùng được ở cloud.

## 7. Rules và skills

Toàn bộ rules và skills viết bằng **tiếng Anh** (ngắn hơn về token, dùng được với cộng tác viên). AI vẫn trả lời bằng ngôn ngữ của người dùng.

### 7.1 `ai-rules-core.md` (nạp mỗi phiên, ≤ 40 dòng)

Chỉ chứa điều phải luôn đúng, mỗi điều một dòng, trỏ sang skill khi cần chi tiết:

- **Phạm vi:** chỉ sửa những gì được yêu cầu; không refactor ngoài lề; không thêm dependency khi chưa hỏi.
- **An toàn:** không commit thẳng lên nhánh chính; không force push; không bỏ qua hook git (`--no-verify`); không ghi secret vào code; hỏi trước khi xoá hoặc ghi đè.
- **Trung thực:** không báo "xong" khi chưa chạy kiểm tra; nói rõ phần chưa kiểm tra.
- **Báo cáo cuối việc:** luôn theo một mẫu — đã đổi gì, đã kiểm tra gì (lệnh và kết quả), chưa kiểm tra gì.
- **Không làm yếu kiểm tra:** không tắt, bỏ qua hay xoá test và kiểm tra tĩnh để cho qua; nếu thấy cần thì báo người dùng.
- **Secret:** không đọc file `.env*`, không ghi khoá bí mật vào code.
- **Dừng đúng lúc:** cùng một lỗi mà hai lần sửa không qua thì dừng, báo người dùng kèm bằng chứng. Lệnh kiểm tra fail thì dùng `ai-rules-handling-failures` trước khi chạy lại.
- **Trước khi chạy e2e:** chạy lệnh kiểm tra môi trường của repo nếu có khai báo.
- **Token:** tìm trước khi đọc; chỉ đọc phần cần; không đọc lại file đã có trong ngữ cảnh; chạy test hẹp nhất đủ chứng minh; cắt bớt output dài; trả lời ngắn. Chi tiết: `ai-rules-saving-tokens`.
- **PR và comments:** dùng `ai-rules-creating-prs` và `ai-rules-writing-comments`.
- **Brainstorm:** khi brainstorm trong repo, chạy `ai-rules-repo-setup` trước khi chốt thiết kế.
- **Superpowers:** ở máy, nếu không thấy skill `superpowers:*` thì báo người dùng lệnh cài.
- **Cloud:** dòng ở mục 6.
- **File được quản lý:** không sửa tay file do ai-rules quản lý.

### 7.2 `ai-rules-repo-setup` (chạy trong lúc brainstorm)

Skill brainstorming thuộc superpowers nên không sửa được; rule cốt lõi yêu cầu AI chạy skill này trong mỗi lần brainstorm. Skill làm bốn việc, mỗi việc đều **đề xuất rồi chờ người dùng đồng ý** mới ghi:

1. **Mô tả dự án** ghi vào `CLAUDE.md` của repo, theo khuôn cố định, ≤ 40 dòng:
   - Dự án làm gì, cho ai
   - Công nghệ
   - Lệnh: cài đặt, build, lint, test, e2e
   - Cấu trúc thư mục chính
   - Quy ước riêng của repo

   Ghi sau khi bản thiết kế được duyệt. Lần brainstorm sau nếu dự án đổi hướng thì đề xuất sửa.
2. **Chọn skill** từ `catalog.md` dựa trên mô tả dự án và yêu cầu của người dùng. Không cài gì ngoài danh mục.
3. **Cân nhắc hook/skill riêng cho repo.** Mặc định là không tạo. Chỉ đề xuất khi:
   - có một việc nhiều bước lặp lại → skill trong `.claude/skills/` của repo;
   - có một điều tuyệt đối không được vi phạm → hook trong `.claude/settings.json` của repo.
4. **Cấu hình hook** trong `.claude/ai-rules.json`: các lệnh kiểm tra của repo (e2e, test, build, lint), tên nhánh chính. Nếu repo có e2e, đề xuất thêm một **lệnh kiểm tra môi trường** chạy nhanh (server đã chạy, biến môi trường đủ, trình duyệt test đã cài) và khai báo nó.

### 7.3 `ai-rules-creating-prs`

- Nhánh: `type/mo-ta-ngan`. Một PR một mục đích.
- Tiêu đề: `type(scope): tóm tắt`, ≤ 72 ký tự; `type` thuộc `feat|fix|refactor|docs|test|chore|perf|build|ci`.
- Nội dung có đủ các mục: `## Summary`, `## Why`, `## Changes`, `## Testing` (đã chạy gì, kết quả, và phần **chưa** kiểm tra).
- AI không tự merge, không push lên nhánh chính.

### 7.4 `ai-rules-writing-comments`

- **Commit message:** cùng định dạng tiêu đề như PR; thân giải thích lý do.
- **Comment trong code:** giải thích *tại sao*, không mô tả *cái gì*; không kể lại thay đổi ("đổi X thành Y"); không để lại code bị comment; theo ngôn ngữ và phong cách sẵn có của file.
- **Comment trên PR:** chỉ đăng khi người dùng yêu cầu; mỗi luồng một câu trả lời, nói rõ đã sửa gì hoặc vì sao không sửa.

### 7.5 `ai-rules-handling-failures`

Áp dụng khi e2e, test, build hoặc lint fail. Trước khi chạy lại, phân loại lỗi và ghi rõ bằng chứng:

- **Môi trường** (server chưa chạy, cổng bận, thiếu biến môi trường, mạng): sửa môi trường nếu rõ cách; nếu không, dừng và báo.
- **Chập chờn** (timeout, thứ tự chạy, không liên quan phần vừa sửa): chạy lại đúng test đó một lần; vẫn fail thì báo, không lặp.
- **Lỗi thật** (liên quan phần vừa sửa): sửa code rồi chạy lại đúng phần bị fail.

Luôn chạy lại phần bị fail, không chạy cả bộ. Cả bộ e2e chỉ chạy một lần ở cuối.

**Sổ lỗi đã biết (`.claude/known-issues.md`).** Khi có fail, đọc file này trước khi chẩn đoán. Sau khi xác định một lỗi là do môi trường hoặc chập chờn, đề xuất với người dùng thêm một mục: dấu hiệu nhận biết, loại lỗi, cách xử lý, ngày ghi. File không được tự nạp vào ngữ cảnh, chỉ đọc khi có fail, và giữ ngắn (tối đa khoảng 30 mục).

### 7.6 `ai-rules-saving-tokens`

Bản chi tiết của các dòng token trong rule cốt lõi: thứ tự tìm → đọc một phần → đọc cả file; lọc output lệnh; khi nào dùng subagent; không nạp skill không cần; không lặp lại nội dung đã nói.

### 7.7 Danh mục skill đã duyệt (`catalog.md`)

Bảng: lĩnh vực → skill/plugin → nguồn → khi nào đề xuất → có ở cloud không. Khởi đầu:

| Lĩnh vực | Skill | Nguồn | Có ở cloud |
|---|---|---|---|
| UI / frontend | `frontend-design` | marketplace chính thức | Không |
| Security | `/security-review` + `ai-rules-security-basics` | có sẵn + bản sao | Có |
| Backend | `ai-rules-backend-basics` | bản sao | Có |

`backend-basics` và `security-basics` là skill ngắn (≤ 100 dòng) về thực hành tốt, đi kèm vì chưa có nguồn bên ngoài đã kiểm chứng. Thêm mục vào danh mục = sửa một file ở repo gốc.

### 7.8 `AGENTS.md` (cho AI khác)

File được sinh ra khi đồng bộ, gồm:

- rule cốt lõi (cùng nội dung với `ai-rules-core.md`, bỏ các dòng chỉ dành cho Claude Code);
- chỉ dẫn đọc `CLAUDE.md` để lấy mô tả dự án;
- bảng "làm việc gì thì đọc file skill nào" trỏ vào `.claude/skills/ai-rules-*/SKILL.md`.

Claude Code không đọc `AGENTS.md` nên không bị nạp hai lần. Nếu repo đã có `AGENTS.md` không do ai-rules tạo, công cụ đồng bộ không ghi đè mà hỏi người dùng.

### 7.9 `init-repo` và `sync-repo` (skill của plugin, chỉ ở máy)

- `init-repo`: chép `payload/starter/` (không ghi đè file sẵn có mà không hỏi), rồi chạy đồng bộ lần đầu.
- `sync-repo`: như mục 5.3.

## 8. Hooks

Hook của Claude Code viết bằng Node.js không phụ thuộc thư viện ngoài, khai báo trong `.claude/settings.json` của repo con ở dạng exec (`node` + `${CLAUDE_PROJECT_DIR}/.claude/ai-rules/scripts/...`). Script lỗi thì **không chặn** (thoát mã khác 2) để tránh chặn nhầm.

| Script | Sự kiện | Việc làm |
|---|---|---|
| `session-start.js` | `SessionStart` | Bật hook `commit-msg` của git cho bản clone này. Ở cloud, thêm dòng thông báo ở mục 6. |
| `turn-reset.js` | `UserPromptSubmit` | Đặt lại các bộ đếm của phiên. |
| `verify-guard.js` | `PreToolUse` (Bash, PowerShell) | Nếu lệnh là lệnh kiểm tra đã khai báo (e2e, test, build, lint) và số lần **fail** đã chạm giới hạn thì chặn. Với e2e: nếu repo có khai báo lệnh kiểm tra môi trường mà phiên này chưa chạy nó thì chặn và yêu cầu chạy trước. |
| `command-result.js` | sau khi lệnh Bash/PowerShell chạy xong | Ghi nhận lệnh fail và lệnh kiểm tra môi trường đã pass. Tăng bộ đếm cho lệnh kiểm tra; với lệnh khác, nếu cùng một lệnh fail đủ số lần mà không sửa gì thì thêm một dòng **nhắc** (không chặn). |
| `edit-tracker.js` | `PostToolUse` (Edit, Write, NotebookEdit) | Đặt lại các bộ đếm "fail liên tiếp khi chưa sửa gì". Nếu nội dung mới thêm dấu hiệu tắt kiểm tra (`.skip`, `.only`, `@ts-ignore`, `eslint-disable`, `# type: ignore`…) thì thêm một dòng **nhắc**. |
| `turn-budget.js` | `PostToolUse` (mọi công cụ) | Đếm số lần gọi công cụ trong lượt. Chạm ngưỡng thì thêm một dòng **nhắc**: nếu việc không tiến triển thì dừng và báo tình hình. |
| `pr-check.js` | `PreToolUse` (Bash, PowerShell) | Nếu lệnh là `gh pr create`: kiểm tra tiêu đề và các mục bắt buộc; thiếu thì chặn kèm lý do. |
| `danger-guard.js` | `PreToolUse` (Bash, PowerShell) | **Chặn:** force push, push thẳng lên nhánh chính, `git commit` khi đang ở nhánh chính, `--no-verify`, `git reset --hard`, `git clean -f`, `git add` file `.env`. **Hỏi người dùng:** lệnh cài dependency mới (`npm install <gói>`, `pnpm add`, `yarn add`, `pip install <gói>`, `cargo add`, `go get`…). Cài lại từ lockfile thì cho qua. |
| `config-guard.js` | `PreToolUse` (Edit, Write, NotebookEdit) | **Hỏi người dùng** khi AI sửa `.claude/ai-rules.json`, `.claude/settings*.json`, workflow đồng bộ, hoặc file [quản lý]. |
| `secret-guard.js` | `PreToolUse` (Edit, Write, NotebookEdit) | **Chặn** khi nội dung ghi vào có chuỗi dạng khoá bí mật với độ tin cậy cao (khối private key, khoá AWS, token GitHub, khoá Stripe live…). |

Ba mức hành động: **chặn** (AI không làm được), **hỏi người dùng** (bạn bấm đồng ý hay từ chối), **nhắc** (thêm một dòng vào ngữ cảnh, không cản).

Rule cốt lõi không cần hook: nó nằm ở `.claude/rules/` và được tự nạp.

### 8.1 Giới hạn chạy lại

**Chỉ đếm lần chạy fail.** Lần chạy pass không bao giờ bị tính, nên một lượt thực thi kế hoạch dài không bị chặn. Subagent dùng chung bộ đếm với phiên chính. Mỗi loại lệnh (e2e, test, build, lint) có bộ đếm riêng.

Bộ đếm tính **theo mỗi tin nhắn của người dùng**: mỗi lần bạn gửi tin, AI có ngân sách mới. AI không tự đặt lại được.

| Mức | Áp dụng cho | Mặc định | Hành động |
|---|---|---|---|
| Fail liên tiếp mà không sửa file nào | e2e, test, build, lint | 2 (lần thứ ba bị chặn) | Chặn |
| Tổng số lần fail trong một lượt, kể cả có sửa xen giữa | chỉ e2e | 4 | Chặn |
| Cùng một lệnh bất kỳ fail liên tiếp mà không sửa gì | mọi lệnh khác | 3 | Nhắc một dòng |

Mức tổng theo lượt chỉ áp dụng cho e2e vì test thường fail có chủ đích khi làm theo TDD (viết test fail trước), còn e2e là thứ đắt nhất.

Khi chặn, thông điệp yêu cầu AI: dừng, phân loại lỗi theo `ai-rules-handling-failures`, báo người dùng kèm bằng chứng.

Trạng thái lưu trong thư mục tạm của hệ điều hành, theo `session_id`.

### 8.2 Hook `commit-msg` của git

- Git tự đưa nguyên văn message cho hook, nên không phải đọc lệnh `git commit` và không có chuyện đọc sai.
- Kiểm tra dòng tiêu đề theo định dạng ở mục 7.3. Bỏ qua commit merge, revert và fixup.
- `session-start.js` bật nó bằng cách trỏ `core.hooksPath` vào `.claude/ai-rules/git-hooks`, **chỉ khi** repo chưa dùng cơ chế git hook nào khác (ví dụ husky). Nếu đã có, không ghi đè mà báo một dòng.
- Mặc định chỉ áp dụng cho commit do AI tạo, không ép lên commit người gõ tay. Nếu lúc xây không phân biệt được hai loại thì áp dụng cho mọi commit và ghi rõ trong README.
- Vì là hook của git nên nó áp dụng cả khi AI khác tạo commit.

### 8.3 `.claude/ai-rules.json` (trong repo con, không bị ghi đè)

```json
{
  "source": "phong190897/ai-rules",
  "mainBranch": "main",
  "guards": {
    "verify": true,
    "repeatNudge": true,
    "turnBudget": true,
    "testWeakening": true,
    "prCheck": true,
    "danger": true,
    "dependencies": true,
    "config": true,
    "secrets": true,
    "commitMsg": true
  },
  "verify": {
    "commands": {
      "e2e": ["npm run e2e"],
      "test": ["npm test"],
      "build": ["npm run build"],
      "lint": ["npm run lint"]
    },
    "e2ePreflight": "node scripts/check-env.js",
    "maxFailedRunsWithoutChange": 2,
    "maxE2eFailedRunsPerTurn": 4
  },
  "repeatNudgeAfter": 3,
  "turnNudgeAfterToolCalls": 100
}
```

Thiếu trường thì dùng mặc định. `guards` cho phép tắt riêng từng hook ở repo có quy ước khác; vì file này được `config-guard.js` bảo vệ nên AI không tự tắt được. Mẫu e2e mặc định khi chưa khai báo: `playwright test`, `cypress run`, và script npm/pnpm/yarn có tên chứa `e2e`. Các loại khác không có mẫu mặc định: chưa khai báo thì không chặn. Không khai báo `e2ePreflight` thì không yêu cầu kiểm tra môi trường.

### 8.4 Bảo vệ cấu hình và secret

- **Vì sao cần `config-guard.js`:** nếu không, AI có thể tự nâng giới hạn hoặc tắt hook để vượt rào. Hook dùng mức "hỏi người dùng" thay vì chặn, vì `ai-rules-repo-setup` cần ghi các file này một cách chính đáng sau khi bạn đồng ý. Đồng bộ bằng `sync.js` không đi qua công cụ sửa file nên không bị hỏi.
- **Secret:** ngoài `secret-guard.js`, phần permission được trộn vào `settings.json` có luật cấm đọc các file `.env` chứa giá trị thật (không cấm `.env.example`).
- Mẫu nhận diện secret chỉ gồm các dạng có độ tin cậy cao, để tránh chặn nhầm chuỗi ngẫu nhiên trong test.

## 9. Kiểm thử

- Mỗi script có test bằng trình chạy test sẵn có của Node: đưa JSON giả vào stdin, kiểm tra mã thoát và output. Phải có cả ca "không được chặn" để bắt chặn nhầm, tối thiểu:
  - lệnh kiểm tra pass nhiều lần liên tiếp không bị chặn;
  - chu trình TDD (test fail → sửa → pass) lặp nhiều lần không bị chặn;
  - lệnh không khai báo fail nhiều lần chỉ bị nhắc, không bị chặn;
  - `npm install` không kèm tên gói không bị hỏi;
  - đọc và sửa `.env.example` không bị chặn;
  - chuỗi ngẫu nhiên trong file test không bị coi là secret.
- Ca phải chặn hoặc hỏi: sửa `.claude/ai-rules.json` bằng công cụ sửa file thì bị hỏi; ghi khối private key thì bị chặn; chạy e2e khi chưa chạy lệnh kiểm tra môi trường đã khai báo thì bị chặn.
- `sync.js`: test trên thư mục tạm — tạo mới, ghi đè, xoá file đã gỡ ở nguồn, giữ nguyên hook và cấu hình riêng của repo trong `settings.json`, không đụng `CLAUDE.md`, `ai-rules.json`, và `AGENTS.md` không do ai-rules tạo.
- `commit-msg`: test với message đúng, sai, merge, revert.
- Skills được viết và kiểm tra theo `superpowers:writing-skills`.
- Thử đầu-cuối bằng tay ở máy: tạo repo con bằng `init-repo`, mở phiên mới, xác nhận rule cốt lõi được nạp, e2e bị chặn sau hai lần fail liên tiếp không sửa gì, PR và commit sai định dạng bị chặn.
- Thử ở cloud: mở một phiên cloud trên repo con đã commit, xác nhận cùng các điểm trên và có dòng thông báo cloud.
- Thử cập nhật: đổi một dòng rule ở repo gốc; xác nhận phiên ở máy được thông báo, và workflow mở PR đúng.

## 10. Quyết định do tôi (Claude) đưa ra, cần bạn xem lại

1. Hỗ trợ cloud bằng **bản sao đầy đủ được quản lý trong repo** (rules, hooks, skills), không phải chỉ rule cốt lõi.
2. Tự cập nhật qua workflow GitHub Actions **trong từng repo con** (kéo về), chạy mỗi ngày, mở PR chứ không tự merge.
3. Đồng bộ ở máy không tự ghi file: hook chỉ thông báo, AI hỏi bạn, rồi tạo commit/PR riêng.
4. Giới hạn chạy lại theo bảng ở mục 8.1: chặn cứng cho lệnh kiểm tra đã khai báo, chỉ nhắc cho lệnh khác.
5. Kiểm tra commit message bằng hook của git, mặc định chỉ cho commit do AI tạo, và không ghi đè cơ chế git hook sẵn có.
6. AI khác được hỗ trợ qua `AGENTS.md` sinh tự động; hook chỉ dành cho Claude Code.
7. Giới hạn theo môi trường ghi ở README, rule cốt lõi và thông báo đầu phiên cloud.
8. Rules và skills viết bằng tiếng Anh; hook viết bằng Node.js, nên máy cần có Node.
9. Chuẩn PR/commit theo kiểu Conventional Commits với bốn mục bắt buộc trong PR.
10. `backend-basics` và `security-basics` đi kèm; UI dùng `frontend-design` (chỉ ở máy).
11. AI luôn hỏi trước khi cài skill, ghi mô tả dự án, hoặc tạo hook/skill riêng cho repo.
12. Tên: `ai-rules`, `ai-rules-marketplace`, tiền tố skill `ai-rules-`.
13. AI sửa cấu hình ai-rules, settings hoặc file [quản lý] thì phải được bạn xác nhận.
14. Repo có e2e thì khai báo một lệnh kiểm tra môi trường; hook bắt chạy nó một lần mỗi phiên trước khi chạy e2e.
15. Sổ lỗi đã biết nằm ở `.claude/known-issues.md`, chỉ ghi khi bạn đồng ý, chỉ đọc khi có fail.
16. Dấu hiệu tắt kiểm tra (`.skip`, `@ts-ignore`…) và lượt quá dài (100 lần gọi công cụ) chỉ bị nhắc, không bị chặn.
17. Cài dependency mới thì hỏi bạn; ghi secret dạng rõ ràng thì chặn; đọc `.env` thật thì cấm.
18. Không làm: hook ép AI chạy kiểm tra trước khi kết thúc lượt (dễ gây vòng lặp), hook tự format/lint dùng chung (để từng repo tự đề xuất), skill riêng về viết test.

## 11. Còn để lại cho người xây

- Thử thực tế: giá trị đúng của `autoUpdate`; marketplace và plugin cùng repo với source là thư mục con.
- Xác định tên marketplace hiện hành của superpowers và `frontend-design` để ghi vào starter và danh mục.
- Nội dung cụ thể của từng skill, của rule cốt lõi và của `AGENTS.md` (trong giới hạn dòng đã nêu).
- Cách `sync.js` nhận diện và trộn các mục hook và permission do ai-rules quản lý trong `settings.json`.
- Hành vi của mức "hỏi người dùng" khi không có ai để hỏi (phiên cloud tự động, chạy không tương tác): thử thực tế; nếu không hỏi được thì chặn kèm thông điệp yêu cầu báo người dùng.
- Danh sách chính xác các mẫu secret, mẫu lệnh cài dependency, dấu hiệu tắt kiểm tra, và các luật cấm đọc `.env`.
- Có gộp các hook `PostToolUse` vào một script điều phối để giảm số tiến trình khởi chạy hay không.
- Cách tính "phiên bản nguồn" để so sánh (ví dụ băm nội dung `payload/managed`).
- Cách `command-result.js` biết lệnh fail (sự kiện hook nào, đọc mã thoát ở đâu); không xác định được thì coi như không fail.
- Cách `commit-msg` nhận biết commit do AI tạo (ví dụ biến môi trường do Claude Code đặt).
- Cách `pr-check.js` đọc tiêu đề và nội dung từ lệnh `gh pr create` (cờ `--title`/`--body`/`--body-file`); trường hợp không đọc được thì cho qua.
- Chi tiết workflow: quyền cần cấp, cách tránh mở PR trùng.
- Khởi tạo git cho thư mục này và nối với repo gốc trên GitHub (hiện trống); chỉ commit và push khi người dùng yêu cầu.

## 12. Bổ sung: quét repo chưa thiết lập và gợi ý (đã duyệt)

### Mục đích

Người dùng không phải nhớ gọi `init-repo` ở từng repo. Lần đầu mở phiên ở máy trong một repo chưa dùng ai-rules, plugin tự quét nhanh và AI hỏi một lần có thiết lập không. Quên thiết lập một repo là repo đó lệch với các repo khác, đúng vấn đề gốc số 2.

### Các cách đã cân nhắc

| Cách | Được | Mất |
|---|---|---|
| **Quét bằng script rồi gợi ý một lần (đã chọn)** | Không tốn token để quét; không tự sửa gì; không hỏi lại. | Chỉ phát hiện được những thứ rõ ràng. |
| Tự động thiết lập và sửa repo | Không cần người dùng làm gì. | Plugin cài cho cả máy nên sẽ tự sửa mọi repo được mở, kể cả repo của người khác; ngược nguyên tắc "hỏi trước khi ghi". |
| Quét sâu source code bằng AI ở mỗi repo | Phát hiện được nhiều hơn. | Tốn token ở mọi repo; phần lớn rule nói về cách AI làm việc nên không có gì nhiều để áp lên code sẵn có. |

Người dùng hỏi ý kiến tôi và đồng ý với cách đầu.

### Hành vi

**Khi nào gợi ý.** Hook đầu phiên của plugin gợi ý khi đủ cả bốn điều kiện:

- phiên chạy ở máy (không phải cloud);
- thư mục dự án là gốc của một repo git;
- chưa có `.claude/ai-rules.json`;
- plugin chưa từng gợi ý cho repo này.

Plugin ghi lại "đã gợi ý" ngay lúc in gợi ý, trong thư mục dữ liệu của plugin, theo đường dẫn repo. Vì vậy mỗi repo chỉ được hỏi **một lần**, dù người dùng đồng ý, từ chối hay bỏ qua. Muốn thiết lập về sau thì gọi `ai-rules:init-repo`.

**Quét những gì.** Một script đọc một số file cố định ở gốc repo và gọi git một lần. Không duyệt cây thư mục, không đọc source code.

| Hạng mục | Cách phát hiện |
|---|---|
| Công nghệ | File đánh dấu ở gốc: `package.json` (kèm trình quản lý gói theo lockfile), `pyproject.toml`/`requirements.txt`, `go.mod`, `Cargo.toml`, `pom.xml`/`build.gradle`, `*.csproj`, `composer.json`, `Gemfile` |
| Lệnh kiểm tra (chỉ Node.js) | `scripts` trong `package.json`: `test`, `build`, `lint`, và script có tên chứa `e2e` |
| Công cụ e2e | Dependency `@playwright/test` hoặc `cypress` |
| Thứ đã có sẵn | `CLAUDE.md` (số dòng), `AGENTS.md`, `.claude/settings.json`, git hook riêng (`.husky/` hoặc `core.hooksPath`) |
| Rủi ro | File `.env` thật đang được git theo dõi |
| Skill nên gợi ý | Có dependency frontend (React, Vue, Svelte, Next, Angular) → `frontend-design`; có dependency hoặc công nghệ backend → `ai-rules-backend-basics` |

**Người dùng thấy gì.** Hook thêm vào ngữ cảnh một khối ngắn (tối đa khoảng 8 dòng) gồm kết quả quét và chỉ dẫn cho AI: hỏi người dùng một lần; đồng ý thì dùng `ai-rules:init-repo`. AI trình bày lại bằng ngôn ngữ của người dùng, ví dụ:

```
Repo này chưa dùng ai-rules. Quét nhanh cho thấy:
- Node.js + Playwright; test: npm test, e2e: npm run e2e
- Đã có CLAUDE.md (62 dòng): sẽ giữ nguyên
- Đang dùng husky: sẽ không cài kiểm tra commit message
- File .env đang được git theo dõi: nên gỡ
Thiết lập ai-rules cho repo này không?
```

**Khi người dùng đồng ý.** `init-repo` làm thêm so với mục 7.9:

- Điền `verify.commands` trong `.claude/ai-rules.json` từ kết quả quét, chỉ khi file này vừa được tạo mới.
- Nêu riêng từng việc cần người dùng quyết và chỉ làm khi được đồng ý: gỡ file `.env` khỏi git, cài skill trong danh mục, sắp xếp lại `CLAUDE.md` sẵn có theo khuôn.
- Kết thúc bằng lời đề nghị chạy `ai-rules-repo-setup` ngay để viết mô tả dự án. Đây là phần duy nhất cần AI đọc source code, và chỉ chạy khi người dùng đồng ý.

### Ngoài phạm vi

- Tự sửa repo khi chưa được đồng ý.
- Rà soát code sẵn có theo từng rule.
- Phát hiện lệnh kiểm tra cho công nghệ khác Node.js (để `ai-rules-repo-setup` điền).
- Gợi ý trong thư mục không phải repo git, và ở phiên cloud (plugin không được nạp ở đó).

### Quyết định do tôi (Claude) đưa ra

1. Mỗi repo chỉ được hỏi một lần, kể cả khi người dùng bỏ qua câu hỏi.
2. Chỉ quét các file cố định ở gốc repo; không đếm test bị tắt, vì việc đó cần duyệt cả cây thư mục.
3. Chỉ tự phát hiện lệnh kiểm tra cho Node.js ở bản đầu.
4. `CLAUDE.md` sẵn có được giữ nguyên; việc sắp xếp lại chỉ là đề xuất.

### Còn để lại cho người xây

- Danh sách chính xác các dependency được coi là frontend và backend.
- Định dạng file ghi "đã gợi ý" và cách chuẩn hoá đường dẫn repo (Windows không phân biệt hoa thường).
- Câu chữ tiếng Anh của khối ngữ cảnh mà hook in ra.

## 13. Bổ sung: thiết kế kiến trúc cho từng repo (đã duyệt)

### Mục đích

Mỗi repo có một kiến trúc được quyết định và ghi lại trước khi viết code, và AI làm theo nó ở mọi phiên sau. Lý do của người dùng: code không có kế hoạch khiến việc bảo trì tốn token hơn, và sửa lỗi A dễ gây ra lỗi B.

Hai kết quả đó đến từ **ranh giới rõ** (AI biết đọc và sửa ở đâu, thay đổi không lan sang chỗ khác), không đến từ tên của kiến trúc. Vì vậy phần này ghi ba thứ: kiểu kiến trúc, bản đồ module, và luật phụ thuộc.

### Các cách đã cân nhắc (cho việc giữ đúng ranh giới)

| Cách | Được | Mất |
|---|---|---|
| Chỉ có rule | Rẻ nhất. | Không có gì ngăn khi AI quên. |
| **Rule + công cụ kiểm tra ranh giới của chính stack (đã chọn)** | Có kiểm tra thật; dùng công cụ sẵn có; vi phạm làm lint fail theo cơ chế đã có. | Mỗi repo cần cài và cấu hình một công cụ; stack không có công cụ phù hợp thì chỉ còn rule. |
| Hook của ai-rules tự phân tích import | Chặn ngay lúc ghi file. | Phải tự viết bộ phân tích cho từng ngôn ngữ; dễ chặn nhầm; tốn công bảo trì. |

Người dùng chọn cách thứ hai.

### Hành vi

**Khi nào AI làm việc này**

- **Lúc brainstorm:** `ai-rules-repo-setup` gọi thêm skill mới `ai-rules-architecture` trước khi ghi mô tả dự án.
- **Sau `init-repo`:** bước cuối của `init-repo` đã đề nghị chạy `ai-rules-repo-setup`, nên phần kiến trúc đi kèm.
- **Khi đọc repo để làm việc:** rule cốt lõi thêm một dòng — nếu `CLAUDE.md` chưa có mục Architecture và việc sắp làm không nhỏ, đề xuất điền mục đó trước.

**Repo mới.** AI hỏi ngắn gọn, từng câu một, về: quy mô và số người làm, cách triển khai, các mảng nghiệp vụ chính, yêu cầu đặc biệt (tải lớn, nhiều nhóm độc lập, nhiều giao diện). Sau đó AI đưa ra **hai hoặc ba** kiến trúc phù hợp, lấy từ danh mục kiến trúc (xem dưới). Với mỗi kiến trúc, AI nêu: vì sao nó hợp với dự án này, cái giá phải trả ở dự án này, và điều gì sẽ khiến nó thành lựa chọn sai. AI nói rõ mình nghiêng về phương án nào và vì sao, nhưng **không có phương án mặc định cài sẵn** và **người dùng là người quyết định**.

**Repo có sẵn code, kiến trúc rõ ràng.** AI nhận ra kiến trúc đang dùng (từ cấu trúc thư mục và hướng import) rồi ghi lại đúng như hiện trạng. AI không tự đề xuất đổi kiến trúc; chỉ nêu khi người dùng hỏi.

**Repo có sẵn code, chưa có kiến trúc nhất định.** Khi code lẫn lộn nhiều kiểu hoặc không theo kiểu nào, AI mô tả hiện trạng kèm bằng chứng (đường dẫn cụ thể), rồi đưa ra hai hoặc ba kiến trúc mà repo có thể hướng tới. Với mỗi kiến trúc, AI nêu mức phù hợp, công chuyển đổi, và phần nào của code được giữ nguyên. Người dùng quyết định. Kiến trúc được chọn ghi là **mục tiêu**: `Style: <kiểu> (target; <phần chưa theo>)`. Code mới làm theo mục tiêu; AI không tự sửa code cũ cho khớp.

**Ngoài danh mục.** Khi không kiểu nào trong danh mục phù hợp, AI được đề xuất một kiểu khác, phải nói rõ nó nằm ngoài danh mục, và gợi ý thêm nó vào danh mục ở repo gốc.

### Danh mục kiến trúc và cách cập nhật

- **Một file riêng:** `.claude/ai-rules/architectures.md` (được quản lý). Thêm hoặc sửa một kiểu kiến trúc là sửa một file ở repo gốc, và mọi repo con nhận qua đồng bộ.
- **Mỗi kiểu một mục** với cùng khuôn: hợp khi nào, không hợp khi nào, module và luật phụ thuộc điển hình. Cuối file là bảng công cụ kiểm tra ranh giới theo stack.
- **Danh sách khởi đầu:** modular monolith, N-Layer, Clean / Hexagonal, vertical slice, microservices, microfrontend, event-driven, serverless.
- **Dòng `Last reviewed: <ngày>`** ở đầu file, để thấy ngay danh mục đã cũ hay chưa.
- **Cập nhật định kỳ:** repo gốc có một skill riêng `update-architectures`. Khi chạy, AI tìm hiểu trên web các kiểu kiến trúc và công cụ kiểm tra mới, so với danh mục, rồi đề xuất từng thay đổi kèm nguồn. Người dùng chọn thay đổi nào được nhận; AI sửa file, cập nhật ngày, và mở PR. Một kiểu chỉ được thêm khi đã có tài liệu và được dùng thật, không chỉ vì nó mới.
- Skill này chạy khi người dùng gọi. Lên lịch chạy tự động là việc có thể thêm sau.

**Nội dung ghi vào `CLAUDE.md`.** Mục `## Architecture` thay cho mục `## Structure` hiện nay, gồm bốn phần ngắn:

```markdown
## Architecture
- Style: modular monolith, layered inside each module. Chosen because one developer, one deployment.
- Modules: `src/orders/` order lifecycle; `src/billing/` payments and invoices; `src/shared/` cross-cutting code.
- Dependency rules: `domain` imports nothing from `infrastructure` or `api`; modules talk through their `index.ts` only.
- New code: a new feature goes in the module that owns its data; add a module only for a new business area.
```

Giới hạn độ dài của `CLAUDE.md` tăng từ 40 lên 60 dòng để chứa mục này.

**AI làm theo thế nào.** Rule cốt lõi thêm một dòng: làm theo mục Architecture; đặt code mới đúng module; thay đổi vượt ranh giới hoặc trái luật phụ thuộc thì hỏi người dùng trước.

**Kiểm tra ranh giới.** Sau khi mục Architecture được duyệt, AI đề xuất bật công cụ kiểm tra của stack và chỉ làm khi người dùng đồng ý (việc cài là thêm dependency nên hook sẵn có sẽ hỏi):

| Stack | Công cụ đề xuất |
|---|---|
| JavaScript / TypeScript | `dependency-cruiser`, hoặc `eslint-plugin-boundaries` nếu repo đã dùng ESLint |
| Python | `import-linter` |
| Java / Kotlin | ArchUnit |
| .NET | NetArchTest |
| Go | `depguard` qua `golangci-lint` |
| Khác | không có công cụ: chỉ dùng rule, và AI nói rõ điều đó |

Lệnh kiểm tra được chạy cùng lint: hoặc gắn vào script lint sẵn có, hoặc khai báo thêm trong `verify.commands.lint`. Nhờ vậy vi phạm làm lint fail và giới hạn chạy lại sẵn có áp dụng luôn.

### Thay đổi cụ thể

- **Skill mới `ai-rules-architecture`** (được quản lý, ≤ 150 dòng): các câu hỏi cần hỏi; cách trình bày hai hoặc ba phương án để người dùng quyết định; cách xử lý ba trường hợp repo (mới, có kiến trúc rõ, chưa có kiến trúc nhất định); khuôn mục Architecture. Skill đọc danh mục từ file riêng, không chứa bảng kiểu kiến trúc.
- **File mới `architectures.md`** (được quản lý, ≤ 150 dòng): danh mục kiến trúc và bảng công cụ kiểm tra.
- **Skill riêng của repo gốc `update-architectures`** (không được quản lý, chỉ có ở repo này): cập nhật danh mục.
- **`ai-rules-repo-setup`:** khuôn `CLAUDE.md` đổi `Structure` thành `Architecture`, giới hạn 60 dòng; thêm việc gọi `ai-rules-architecture` và việc đề xuất công cụ kiểm tra ranh giới.
- **Rule cốt lõi:** thêm hai dòng (làm theo Architecture; đề xuất điền khi còn trống). Vẫn trong giới hạn 40 dòng.
- **Starter `CLAUDE.md`, `init-repo`, README, danh mục skill:** cập nhật theo.
- **`AGENTS.md`:** tự có thêm dòng trỏ tới skill mới, vì nó được sinh từ danh sách skill.

### Ngoài phạm vi

- Hook của ai-rules tự phân tích import.
- Tự sửa code sẵn có cho khớp một kiến trúc mới.
- Bộ quét lúc `init` tự đoán kiến trúc: việc đó cần đọc source code, nên do AI làm khi người dùng đồng ý chạy `ai-rules-repo-setup`.
- Sơ đồ kiến trúc dạng hình vẽ.

### Quyết định do tôi (Claude) đưa ra

1. AI đưa ra hai hoặc ba phương án và nói mình nghiêng về phương án nào; không có mặc định cài sẵn (theo yêu cầu của người dùng).
2. Repo có kiến trúc rõ thì chỉ ghi lại; repo chưa có kiến trúc nhất định thì AI đề xuất vài phương án, và phương án được chọn ghi là mục tiêu (theo yêu cầu của người dùng). AI không tự sửa code cũ.
7. Danh mục kiến trúc nằm trong file riêng và được cập nhật bằng một skill chạy ở repo gốc khi người dùng gọi; chưa lên lịch tự động.
8. AI được đề xuất kiểu nằm ngoài danh mục khi không kiểu nào phù hợp, và phải nói rõ điều đó.
9. Thêm "vertical slice" vào danh sách khởi đầu.
3. Mục Architecture thay cho mục Structure, và `CLAUDE.md` được phép dài 60 dòng.
4. Phần kiến trúc nằm trong một skill riêng, không nhồi vào `ai-rules-repo-setup`, để chỉ nạp khi cần.
5. Công cụ kiểm tra chạy cùng lint, không phải một loại lệnh mới.
6. Bảng công cụ theo stack là gợi ý ban đầu; thêm stack = sửa một file ở repo gốc.

### Còn để lại cho người xây

- Câu chữ của skill và của bảng các kiểu kiến trúc.
- Cấu hình mẫu cho từng công cụ kiểm tra (skill chỉ nêu tên công cụ và ý chính; AI viết cấu hình theo luật phụ thuộc của từng repo).
