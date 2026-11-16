<!-- Managed by ai-rules. Do not edit; overwritten on sync. -->
# Agent instructions

Project description: read `CLAUDE.md`.

## Core rules

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
- Architecture: follow the Architecture section of `CLAUDE.md`. Put new code in the module that owns it; ask the user before crossing a module boundary or breaking a dependency rule. Details: `ai-rules-architecture`.
- No architecture yet: if `CLAUDE.md` has no filled Architecture section and the task is more than a small fix, propose filling it first with `ai-rules-architecture`.
- Managed files: never hand-edit files marked "Managed by ai-rules", `.claude/ai-rules.json` or `.claude/settings.json` without the user's approval.
- Reply in the user's language.

## Task guides

Read the matching file before doing the task.

| When | Read |
|---|---|
| Use when choosing or recording a project's architecture, or before adding code that crosses module boundaries. | `.claude/skills/ai-rules-architecture/SKILL.md` |
| Use when designing or changing server-side code: APIs, data access, background jobs. | `.claude/skills/ai-rules-backend-basics/SKILL.md` |
| Use when creating a branch or opening a pull request. | `.claude/skills/ai-rules-creating-prs/SKILL.md` |
| Use when an e2e, test, build or lint command fails, before re-running it. | `.claude/skills/ai-rules-handling-failures/SKILL.md` |
| Use when brainstorming, designing, or starting work in a repository: write the project description, pick approved skills, and configure ai-rules for the repo. | `.claude/skills/ai-rules-repo-setup/SKILL.md` |
| Use when a task involves reading many files, long command output, or many tool calls. | `.claude/skills/ai-rules-saving-tokens/SKILL.md` |
| Use when code handles user input, authentication, secrets, files, or external requests. | `.claude/skills/ai-rules-security-basics/SKILL.md` |
| Use when writing a commit message, a code comment, or a comment on a pull request. | `.claude/skills/ai-rules-writing-comments/SKILL.md` |
