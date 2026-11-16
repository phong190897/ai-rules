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

## Architecture
- Style: one plugin that owns a payload and copies it into other repos. Chosen because the same files must run from a repo checkout, locally and in cloud sessions.
- Modules: `plugins/ai-rules/payload/` source of truth (`managed/` copied as is, `starter/` created once, `settings-fragment.json` merged); `plugins/ai-rules/scripts/` the plugin's own sync, scan and update check; `plugins/ai-rules/skills/` and `hooks/` the plugin's runtime; `tests/` one file per area; `docs/superpowers/` design and plans; `.claude/`, `AGENTS.md` and `.github/workflows/ai-rules-sync.yml` generated copies.
- Dependency rules: files under `payload/managed/ai-rules/scripts/` require only Node built-ins and each other, never anything outside that folder, because they are copied alone. `plugins/ai-rules/scripts/` may require them, not the other way round. No npm dependencies.
- New code: a guard goes in `payload/managed/ai-rules/scripts/guards/` with its test in `tests/`; anything that only the plugin runs goes in `plugins/ai-rules/scripts/`.

## Conventions
- After changing anything under `plugins/ai-rules/payload/`, run `node plugins/ai-rules/scripts/sync.cjs --target .` and commit the result; a test fails if the copy is stale.
- Hook scripts must fail open: any internal error exits 0 and prints nothing.
- Files under `payload/managed/` start with the "Managed by ai-rules" marker.
