# Verification against real Claude Code

Run on 2026-11-15 from `main` at `f5de9fc`: Windows 11, Node 26, Claude Code in the desktop app, plugin installed from GitHub with `claude plugin install ai-rules@ai-rules-marketplace` (user scope). Each check used a fresh headless session (`claude -p`) in a throwaway git repository.

| # | Check | Result |
|---|---|---|
| 1 | Install the plugin from GitHub | Pass. The version is the commit SHA (`f5de9fc8eaea`), so every commit on `main` is an update. |
| 2 | Plugin `SessionStart` hook in an unconfigured git repo | Pass. It ran with `CLAUDE_PLUGIN_DATA` set, scanned the repo, and the model received the text and asked whether to set the repo up. Asked once: a second session in the same repo stayed silent. |
| 3 | `${CLAUDE_PLUGIN_ROOT}` inside skill text | Pass. It is replaced with the real plugin path, so `init-repo` and `sync-repo` run their commands. |
| 4 | `ai-rules:init-repo` | Pass. 35 files written; `.claude/ai-rules.json` got the e2e and test commands from the scan. |
| 5 | Core rule and skills load in a new session | Pass. The model followed `.claude/rules/ai-rules-core.md` and read `.claude/known-issues.md` before re-running a failure. |
| 6 | E2E retry limit | Pass. Two failing runs were allowed; the third was refused with the `ai-rules:` message. |
| 7 | How a failed command reaches the hooks | Only `PostToolUseFailure` fires, with the text in an `error` field that starts with `Exit code N`. `PostToolUse` does not fire for the same command, so nothing is counted twice. Both the Bash and PowerShell tools work. |
| 8 | Dependency prompt (`npm install lodash`) in a non-interactive session | Pass, as a refusal: with nobody to ask, the "ask" decision is shown to the model as a block with the reason, and nothing is installed. |
| 9 | Commit message check | Pass. `Add stuff` was rejected with exit 1 and the reason; `chore: valid message` went through. `CLAUDECODE` is set for commands run by the AI, so the default scope `ai` works. |

## Not checked yet

- A cloud session (claude.ai/code) on a repo that has been set up: rules, skills and hooks from the repo, the cloud notice, and what the "ask" decision does there.
- The daily sync workflow, and the "an update is available" message after the plugin updates (needs a later commit on `main`).
- `CLAUDE_PROJECT_DIR` inside a git worktree.
- The value type of `autoUpdate`, and the marketplace id of superpowers used in `payload/starter/settings.json`.

## Side finding

In the same headless runs, the SessionStart hook of the superpowers plugin failed with "requires bash but Git Bash was not found". It is not part of this repository; it only shows that on this machine the `claude -p` environment has no Git Bash on the path.
