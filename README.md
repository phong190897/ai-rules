# ai-rules

Một plugin Claude Code giữ **một bộ rules, hooks và skills dùng chung** cho mọi repo viết bằng AI. Sửa một lần ở repo này, các repo con nhận bản mới, và hoạt động cả ở máy lẫn phiên cloud.

Nó giải quyết ba vấn đề:

1. **AI chạy quá lâu**: e2e fail vì lỗi môi trường hoặc lỗi chập chờn, AI chạy lại nhiều lần, tốn token và thời gian.
2. **Thiếu nhất quán**: mỗi repo mới phải soạn lại `CLAUDE.md`, nên AI hành xử khác nhau ở từng repo.
3. **PR và comment không theo một chuẩn.**

## Cài trên mỗi máy (một lần)

```bash
claude plugin marketplace add phong190897/ai-rules
```

```bash
claude plugin install ai-rules@ai-rules-marketplace
```

Marketplace bên thứ ba mặc định **không** tự cập nhật. Bật bằng `/plugin` → tab Marketplaces → Enable auto-update.

## Bắt đầu một repo mới

Lần đầu bạn mở phiên trong một repo git chưa thiết lập, plugin quét nhanh (công nghệ, lệnh test/e2e, `CLAUDE.md` và git hook sẵn có, file `.env` bị git theo dõi) và AI hỏi **một lần** có thiết lập không. Mỗi repo chỉ được hỏi một lần; muốn thiết lập về sau thì tự gọi skill `ai-rules:init-repo`.

Thiết lập tạo các file sau, và bạn commit chúng vào repo:

| File | Vai trò |
|---|---|
| `CLAUDE.md` | Mô tả dự án (do bạn và AI điền); không chứa rule chung |
| `AGENTS.md` | Rule cho các AI khác (Codex, Cursor, Copilot…); được sinh tự động |
| `.claude/rules/ai-rules-core.md` | Rule cốt lõi, tự nạp mỗi phiên |
| `.claude/skills/ai-rules-*/` | Các skill |
| `.claude/ai-rules/` | Script hook, danh mục skill, manifest |
| `.claude/settings.json` | Khai báo hook và quyền; giữ nguyên phần riêng của repo |
| `.claude/ai-rules.json` | Cấu hình riêng của repo |
| `.claude/known-issues.md` | Sổ lỗi đã biết, chỉ đọc khi có fail |
| `.github/workflows/ai-rules-sync.yml` | Tự kéo bản mới và mở PR |

Các file được quản lý (có dòng "Managed by ai-rules") bị ghi đè mỗi lần đồng bộ; đừng sửa tay. Bật thêm "Allow GitHub Actions to create and approve pull requests" trong cài đặt repo.

## Kiến trúc của từng repo

Mỗi repo có một mục `## Architecture` trong `CLAUDE.md`, và AI làm theo nó ở mọi phiên. Mục này được điền qua skill `ai-rules-architecture`, lúc brainstorm hoặc sau khi thiết lập:

- **Repo mới:** AI hỏi về quy mô, cách triển khai, các mảng nghiệp vụ, rồi đưa ra hai hoặc ba kiến trúc phù hợp kèm cái giá của từng cái. AI nói mình nghiêng về cái nào; **bạn là người quyết định**, không có mặc định.
- **Repo có kiến trúc rõ:** AI ghi lại đúng hiện trạng.
- **Repo chưa có kiến trúc nhất định:** AI mô tả hiện trạng rồi đưa ra vài kiến trúc có thể hướng tới. Cái bạn chọn được ghi là mục tiêu; code mới theo nó, code cũ không bị tự sửa.

Mục Architecture gồm bốn phần: kiểu kiến trúc và lý do, bản đồ module, luật phụ thuộc, và code mới đặt ở đâu.

Danh mục các kiểu kiến trúc nằm ở `.claude/ai-rules/architectures.md` (modular monolith, N-Layer, Clean / Hexagonal, vertical slice, microservices, microfrontend, event-driven, serverless). AI được đề xuất kiểu nằm ngoài danh mục và phải nói rõ điều đó.

Để luật phụ thuộc có kiểm tra thật, AI đề xuất bật công cụ của chính stack, chạy cùng lint:

| Stack | Công cụ |
|---|---|
| JavaScript / TypeScript | `dependency-cruiser` hoặc `eslint-plugin-boundaries` |
| Python | `import-linter` |
| Java / Kotlin | ArchUnit |
| .NET | NetArchTest |
| Go | `depguard` (qua `golangci-lint`) |

Stack khác chưa có công cụ trong danh mục, nên ở đó chỉ có rule.

## Rule mới đến repo con như thế nào

- **Tự động:** workflow GitHub Actions trong repo con chạy mỗi ngày, mở PR `chore: sync ai-rules` khi repo gốc có thay đổi. Dùng được cho repo chỉ chạy trên cloud.
- **Ở máy:** plugin tự cập nhật; lần mở phiên tiếp theo AI báo "có bản mới" và hỏi bạn có đồng bộ không (`ai-rules:sync-repo`).

## Hỗ trợ theo môi trường

| Môi trường | Rule cốt lõi | Skill `ai-rules-*` | Hook chặn | Plugin (superpowers, `frontend-design`…) |
|---|---|---|---|---|
| Claude Code ở máy | Có | Có | Có | Có |
| Cloud, một repo | Có | Có | Có | **Không** |
| Cloud, nhiều repo | Chưa rõ trong tài liệu | Chưa rõ trong tài liệu | **Không** | **Không** |
| Project thread | Có | **Không** | **Không** | Chỉ plugin bật trong cài đặt của project |
| AI khác (qua `AGENTS.md`) | Có | Đọc như tài liệu | **Không** (trừ `commit-msg` của git) | Không |

Phiên cloud không nạp plugin do repo khai báo, nên superpowers và `frontend-design` chỉ có ở máy. Rules, hooks và skill của `ai-rules` nằm trong repo nên vẫn chạy ở cloud một repo. Ở cloud nhiều repo, hãy mở **mỗi repo một phiên riêng** để cấu hình của repo đó có hiệu lực.

## Hook làm gì

Ba mức: **chặn** (AI không làm được), **hỏi** (bạn bấm đồng ý hay từ chối), **nhắc** (thêm một dòng vào ngữ cảnh).

| Việc | Mức |
|---|---|
| Force push, push hoặc commit thẳng nhánh chính, `--no-verify`, `git reset --hard`, `git clean -f`, `git add .env` | Chặn |
| Chạy e2e/test/build/lint sau khi đã fail liên tiếp mà chưa sửa gì (xem bảng dưới) | Chặn |
| Chạy e2e khi chưa chạy lệnh kiểm tra môi trường đã khai báo | Chặn |
| `gh pr create` sai tiêu đề hoặc thiếu mục `## Summary/Why/Changes/Testing` | Chặn |
| Ghi khoá bí mật dạng rõ ràng vào code | Chặn |
| Commit message sai định dạng (khi do AI tạo) | Chặn, bằng hook `commit-msg` của git |
| Cài dependency mới | Hỏi |
| Sửa `.claude/ai-rules.json`, `settings.json`, workflow đồng bộ, file được quản lý | Hỏi |
| Thêm `.skip`, `.only`, `@ts-ignore`, `eslint-disable`… | Nhắc |
| Cùng một lệnh khác fail liên tiếp 3 lần | Nhắc |
| Một lượt vượt 100 lần gọi công cụ | Nhắc |

**Giới hạn chạy lại** chỉ đếm lần **fail**, tính theo mỗi tin nhắn của bạn (gửi tin mới thì có ngân sách mới):

| Mức | Áp dụng | Mặc định |
|---|---|---|
| Fail liên tiếp mà không sửa file nào | e2e, test, build, lint | 2 lần; lần thứ ba bị chặn |
| Tổng số lần fail trong một lượt | chỉ e2e | 4 |

## Cấu hình từng repo

`.claude/ai-rules.json` (mọi trường đều tùy chọn):

```json
{
  "source": "phong190897/ai-rules",
  "mainBranch": "main",
  "guards": { "verify": true, "repeatNudge": true, "turnBudget": true, "testWeakening": true,
              "prCheck": true, "danger": true, "dependencies": true, "config": true,
              "secrets": true, "commitMsg": true },
  "verify": {
    "commands": { "e2e": ["npm run e2e"], "test": ["npm test"], "build": [], "lint": [] },
    "e2ePreflight": "node scripts/check-env.js",
    "maxFailedRunsWithoutChange": 2,
    "maxE2eFailedRunsPerTurn": 4
  },
  "repeatNudgeAfter": 3,
  "turnNudgeAfterToolCalls": 100,
  "commitMsg": { "scope": "ai" }
}
```

- `guards`: tắt riêng từng hook ở repo có quy ước khác.
- `verify.commands`: lệnh nào được coi là e2e, test, build, lint. Chưa khai báo e2e thì dùng `playwright test`, `cypress run` và script npm có tên chứa `e2e`.
- `verify.e2ePreflight`: lệnh kiểm tra môi trường nhanh; phải chạy thành công một lần mỗi phiên trước khi chạy e2e.
- `commitMsg.scope`: `"ai"` (mặc định) chỉ kiểm tra commit do phiên Claude Code tạo (nhận ra qua biến môi trường của Claude Code); commit do AI khác hoặc do bạn gõ tay thì không bị kiểm tra. Đặt `"all"` để kiểm tra mọi commit, kể cả của AI khác.

## Phát triển

Cần Node.js 20 trở lên, không có dependency nào.

```bash
npm test
```

Nguồn của mọi thứ nằm ở `plugins/ai-rules/payload/`. Repo này cũng dùng chính bộ rule của nó: sau khi sửa `payload/`, chạy lại

```bash
node plugins/ai-rules/scripts/sync.cjs --target .
```

để cập nhật bản sao trong `.claude/`, `AGENTS.md`, rồi commit.
