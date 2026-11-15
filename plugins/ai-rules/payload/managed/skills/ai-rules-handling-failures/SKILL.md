---
name: ai-rules-handling-failures
description: Use when an e2e, test, build or lint command fails, before re-running it.
---
<!-- Managed by ai-rules. Do not edit; overwritten on sync. -->
# Handling failures

A hook stops you after repeated failures with no file changes in between. Do this before you re-run anything.

## 1. Read the known issues

Read `.claude/known-issues.md`. If the error matches an entry, follow that entry's fix and skip the rest.

## 2. Classify the failure, with evidence

Quote the line of output that supports your choice.

- **environment**: server not running, port busy, missing environment variable, no network, missing browser or dependency. Fix the environment if the fix is clear and local. If it is not, stop and tell the user what is missing.
- **flaky**: a timeout, an ordering problem, or a failure in code you did not touch. Re-run only that test, once. If it still fails, stop and report; do not loop.
- **real**: the failure is in code related to your change. Fix the code, then re-run only the failing test.

## 3. Re-run narrowly

- Re-run only what failed, never the whole suite.
- Run the full e2e suite once, at the end of the work.
- If two different fixes for the same error both fail, stop and report to the user with the evidence.

## 4. Record what you learn

After you classify a failure as environment or flaky, propose adding an entry to `.claude/known-issues.md`, and add it only if the user agrees:

```
### <the error text or symptom that identifies it>
- Type: environment | flaky
- Fix: <what to do, or "report to the user">
- Recorded: YYYY-MM-DD
```

Keep the file to about 30 entries. Drop entries that no longer apply.
