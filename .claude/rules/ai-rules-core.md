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
- Architecture: follow the Architecture section of `CLAUDE.md`. Put new code in the module that owns it; ask the user before crossing a module boundary or breaking a dependency rule. Details: `ai-rules-architecture`.
- No architecture yet: if the Architecture section of `CLAUDE.md` is missing or its `Style:` line is empty, and the task is more than a small fix, propose once to fill it with `ai-rules-architecture`. If the user declines, write `- Style: not decided (user choice)`; never propose when that line is present.
- Managed files: never hand-edit files marked "Managed by ai-rules", `.claude/ai-rules.json` or `.claude/settings.json` without the user's approval.
- Reply in the user's language.

## Claude Code only

- Brainstorming: when brainstorming or designing in this repo, run `ai-rules-repo-setup` before the design is finalized.
- Superpowers: on a local machine, if no `superpowers:*` skill is available, tell the user to install it and continue.
- Cloud sessions: plugins (superpowers, catalog plugins) do not load. Do not try to install them. Work with these rules and the `ai-rules-*` skills; tell the user once if a task needs a plugin-only skill.
