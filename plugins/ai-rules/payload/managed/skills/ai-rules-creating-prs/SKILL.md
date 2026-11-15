---
name: ai-rules-creating-prs
description: Use when creating a branch or opening a pull request.
---
<!-- Managed by ai-rules. Do not edit; overwritten on sync. -->
# Creating pull requests

A hook checks the title and the body of `gh pr create` and blocks anything that does not match this format.

## Branch

- Name: `type/short-description`, for example `feat/login-form`.
- One pull request, one purpose. Split unrelated changes.

## Title

`type(scope): summary`, at most 72 characters. The scope is optional.

`type` is one of: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `build`, `ci`. Add `!` before the colon for a breaking change.

## Body

Use these four headings, each on its own line:

```
## Summary
One or two sentences: what this changes.

## Why
The reason, or the problem it solves.

## Changes
The notable changes, as a short list.

## Testing
What you ran and the result, and what you did not test.
```

`## Testing` must name the commands you ran and what they printed. Always say what is not covered; an empty "not tested" is more useful than a missing one.

## Rules

- Do not merge the pull request yourself.
- Do not push to the main branch.
- Do not use `--fill`, `--web` or a template to skip the checks above.
- Post comments on a pull request only when the user asks. See `ai-rules-writing-comments`.
