---
name: ai-rules-repo-setup
description: Use when brainstorming, designing, or starting work in a repository: write the project description, pick approved skills, and configure ai-rules for the repo.
---
<!-- Managed by ai-rules. Do not edit; overwritten on sync. -->
# Repo setup

Run this during brainstorming, before the design is finalized. It works without superpowers. Do each of the four jobs below as a proposal: show it, wait for the user to agree, then write.

## 1. Project description in `CLAUDE.md`

Write the description into `CLAUDE.md` after the design is approved, so it reflects what was decided. Use these sections, in this order, and keep the whole file at 40 lines or fewer:

- **What this is**: what the project does and who it is for.
- **Stack**: languages, frameworks, main libraries.
- **Commands**: install, build, lint, test, e2e.
- **Structure**: the main directories and what lives in them.
- **Conventions**: rules specific to this repo.

If `CLAUDE.md` already has content, propose edits to it; do not replace it. In a later brainstorm, if the project changes direction (a new backend, a new framework), propose an update instead of letting the description go stale.

## 2. Skills from the approved catalog

Read `.claude/ai-rules/catalog.md`. Match its areas (UI, backend, security) against the project description and what the user asked for. Suggest only entries from the catalog, say which ones are not available in cloud sessions, and ask before installing anything. Never install anything outside the catalog.

## 3. Repo-specific hooks and skills

The default is to create none. Propose one only when:

- a multi-step task keeps repeating: propose a skill in the repo's `.claude/skills/`;
- one rule must never be broken: propose a hook in the repo's `.claude/settings.json`.

Never put these in files marked "Managed by ai-rules"; they are overwritten on sync.

## 4. Configure ai-rules

In `.claude/ai-rules.json` set:

- `verify.commands`: the repo's `e2e`, `test`, `build` and `lint` commands, as lists of command strings;
- `mainBranch`, if it is not `main`;
- `verify.e2ePreflight`: if the repo has e2e tests, propose a fast command that checks the environment (server reachable, required environment variables set, test browser installed) and set it. Without it the preflight rule has nothing to run.

Ask the user before changing `.claude/ai-rules.json`; the edit will trigger an approval prompt.
