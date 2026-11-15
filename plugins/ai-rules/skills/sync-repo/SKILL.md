---
name: sync-repo
description: Use when ai-rules reports that an update is available, or the user asks to sync ai-rules in this repository.
---

# Sync ai-rules into this repository

Brings the managed copies of rules, hooks and skills up to date. Files the repository owns (`CLAUDE.md`, `.claude/ai-rules.json`, its own skills and hooks) are never touched.

## Steps

1. Run this only after the user has agreed to sync.
2. If the working tree has uncommitted changes, ask the user before continuing, so the sync commit stays separate.
3. Create the branch `chore/sync-ai-rules`.
4. Run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/sync.cjs" --target .
   ```

5. Report the `written`, `removed` and `skipped` lists from its JSON output.
6. Offer a commit `chore: sync ai-rules` and a pull request that follows the `ai-rules-creating-prs` skill. Do both only if the user agrees.
