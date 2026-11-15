---
name: init-repo
description: Use when the user wants to set up a new or existing repository to use ai-rules (shared rules, hooks and skills).
---

# Set up a repository with ai-rules

Copies the shared rules, hooks and skills into the current repository. Everything it writes is committed to the repo, so it also works in cloud sessions.

## Steps

1. Confirm the current directory is the root of the repository. If it is not, ask which repository to set up.
2. Run:

   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/sync.cjs" --init --target .
   ```

3. Report the `written` and `skipped` lists from its JSON output. Files that already existed are never overwritten. Show the user the `scan` field (stack, check commands, existing files) in plain language.
4. Ask about each of these separately and do it only if the user agrees:
   - files in `scan.trackedEnvFiles`: remove them from git with `git rm --cached` and add them to `.gitignore`;
   - skills in `scan.suggestedSkills`: install them, following `.claude/ai-rules/catalog.md`;
   - an existing `CLAUDE.md`: offer to reorganize it into the standard sections (What this is, Stack, Commands, Structure, Conventions); never rewrite it unasked.
5. Tell the user to enable "Allow GitHub Actions to create and approve pull requests" in the repository settings, so the daily sync workflow can open pull requests.
6. Give the user the two commands to install the plugin on another machine:

   ```bash
   claude plugin marketplace add phong190897/ai-rules
   claude plugin install ai-rules@ai-rules-marketplace
   ```

7. Offer a commit `chore: set up ai-rules`, on its own branch unless the repository has no commits yet. Commit only if the user agrees.
8. Offer to run the `ai-rules-repo-setup` skill now, to write the project description. That is the only step that needs the AI to read source code.
