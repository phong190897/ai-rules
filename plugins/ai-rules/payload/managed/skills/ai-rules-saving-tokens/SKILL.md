---
name: ai-rules-saving-tokens
description: Use when a task involves reading many files, long command output, or many tool calls.
---
<!-- Managed by ai-rules. Do not edit; overwritten on sync. -->
# Saving tokens

Everything you read stays in context for the rest of the session. Spend it on what the task needs.

## Reading

Go in this order and stop as soon as you have what you need:

1. Search for the name, string or symbol (grep, glob).
2. Read only the matching part of the file (a line range).
3. Read the whole file only when you must change most of it.

Never re-read a file that is already in context, unless it changed. Do not read generated files, lockfiles, build output or vendored code.

## Commands

- Run the narrowest test that proves the change: one file or one test name, not the whole suite.
- Cap long output: redirect it to a file and read the tail, or filter it. A failing test needs the error and a few lines around it, not the full log.
- Do not repeat a command whose result you already have.

## Working

- Use a subagent for a wide search whose result is a short answer, so the raw files stay out of your context. Do not use one for a task you can finish in a few calls.
- Load a skill only when its description matches the task.
- Keep replies short. Do not restate the question, the plan or what the user can already see.
- Do not paste large file contents or diffs into your replies; point to the file and line.
- When a turn runs long without converging, stop and give the user a short status.
