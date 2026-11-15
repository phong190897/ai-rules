# Project

## What this is
`ai-rules` is a Claude Code plugin and marketplace. It keeps one shared set of rules, hooks and skills for AI-written repositories, and syncs a managed copy of them into each repository so they also work in cloud sessions.

## Stack
Node.js 20 or newer, CommonJS (`.cjs`), no dependencies. Tests use `node:test`.

## Commands
- Install: none (no dependencies)
- Build: none
- Lint: none
- Test: `npm test`
- E2E: none

## Structure
- `plugins/ai-rules/payload/` is the source of truth: `managed/` is copied into other repos, `starter/` is created once, `settings-fragment.json` is merged into their `settings.json`.
- `plugins/ai-rules/scripts/` holds the plugin's own scripts: `sync.cjs`, `scan.cjs`, `sync-check.cjs`.
- `plugins/ai-rules/skills/` and `hooks/` are the plugin's runtime parts.
- `.claude/`, `AGENTS.md` and `.github/workflows/ai-rules-sync.yml` here are generated copies of the payload (this repo uses its own rules).
- `tests/` has one test file per area; `docs/superpowers/` has the design and the plan.

## Conventions
- After changing anything under `plugins/ai-rules/payload/`, run `node plugins/ai-rules/scripts/sync.cjs --target .` and commit the result; a test fails if the copy is stale.
- Hook scripts must fail open: any internal error exits 0 and prints nothing.
- Files under `payload/managed/` start with the "Managed by ai-rules" marker.
