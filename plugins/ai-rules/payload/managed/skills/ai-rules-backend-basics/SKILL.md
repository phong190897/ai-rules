---
name: ai-rules-backend-basics
description: Use when designing or changing server-side code: APIs, data access, background jobs.
---
<!-- Managed by ai-rules. Do not edit; overwritten on sync. -->
# Backend basics

Short checklist. Follow the conventions the repo already uses before these defaults.

## Boundaries

- Validate every input at the edge: type, range, length, allowed values. Reject early with a clear error.
- Return errors in one consistent shape, with a stable code and a message safe to show. Never leak stack traces or internal ids.
- Keep handlers thin. Put business rules in functions you can test without a server.

## Data

- Use parameterized queries only; never build SQL by joining strings.
- Wrap writes that must succeed or fail together in a transaction.
- Make writes safe to repeat (idempotent) when a client or a queue may retry them: an idempotency key or a unique constraint.
- Write a migration for every schema change, and keep it backward compatible: add first, switch the code, then remove in a later release.
- Add an index for every column you filter or join on in a hot path. Check list endpoints for N+1 queries and unbounded results; paginate.

## Calls to other systems

- Set a timeout on every outgoing call. Retry only safe calls, with a limit and backoff.
- Handle the failure case on purpose: fall back, queue, or return a clear error.

## Operations

- Read configuration from the environment; do not hard-code hosts, keys or limits.
- Log what happened and the ids needed to trace it. Never log secrets, tokens, passwords or full personal data.
- Background jobs must be safe to run twice and must record their own failures.

## Tests

- Test behavior at the boundary: valid input, invalid input, and the failure of a dependency.
- Do not mock the database for logic that depends on a query; use a real test database when the repo has one.

For input handling, authentication and secrets, also use `ai-rules-security-basics`.
