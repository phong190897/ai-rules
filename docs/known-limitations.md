# Known limitations

Found in review and deliberately left as they are. Each one is a limit of what a hook can know, or needs something that is not verified yet.

## Hooks

- **Compound check commands.** `npm run lint && npm test` is recorded under one kind (`test`), whichever part fails, because a hook cannot tell which command exited non-zero. Declare the checks as separate commands if the retry limit matters for both.
- **Bypass through Bash or the state file.** The config guard only watches the edit tools. An AI can still write `.claude/ai-rules.json` with a shell command, or delete the state file in the temp folder to reset the retry counters. The hooks are a guard rail against mistakes, not a security boundary against a determined agent.
- **Secrets in subdirectories.** The permission rules deny reading `./.env` and its variants at the repository root only. A rule such as `Read(**/.env)` would cover subdirectories, but its syntax has not been checked against Claude Code yet.
- **Unlisted git operations.** `git checkout -- .`, `git restore`, `git branch -D` and `git stash drop` are not blocked.

## To verify against real Claude Code

- Whether a failed Bash command reaches the hooks through `PostToolUseFailure` or as a field of `PostToolUse`, and whether both fire for one failure (which would double-count).
- Whether `CLAUDE_PROJECT_DIR` follows the AI into a git worktree.
- Whether `${CLAUDE_PLUGIN_ROOT}` is replaced inside skill text, and whether `CLAUDE_PLUGIN_DATA` is set for plugin hooks.
- The value type of `autoUpdate`, and the marketplace id of superpowers used in `payload/starter/settings.json`.
- How the "ask" decision behaves in cloud or non-interactive sessions.
