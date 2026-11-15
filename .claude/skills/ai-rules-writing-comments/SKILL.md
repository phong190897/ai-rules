---
name: ai-rules-writing-comments
description: Use when writing a commit message, a code comment, or a comment on a pull request.
---
<!-- Managed by ai-rules. Do not edit; overwritten on sync. -->
# Writing comments

## Commit messages

- Subject line in the same format as a pull request title: `type(scope): summary`, 72 characters or fewer. See `ai-rules-creating-prs` for the types.
- The body, if any, explains why the change was made, not what the diff already shows.
- A git hook rejects a subject that does not match when the commit comes from an AI session. Merge, revert and fixup commits are exempt.

## Comments in code

- Explain why, not what. The code already says what it does.
- Do not narrate the change ("changed X to Y", "added for ticket 42"). That belongs in the commit message.
- Do not leave commented-out code behind; delete it.
- Follow the language and style the file already uses.
- Add a comment only when a reader would otherwise get it wrong: a hidden constraint, a workaround, a surprising order of operations.

## Comments on a pull request

- Post one only when the user asks you to.
- Answer each thread once. Say what you changed, or why you did not change it.
- Keep it short and factual. Do not argue, and do not thank the reviewer at length.
