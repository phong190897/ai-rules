---
name: ai-rules-security-basics
description: Use when code handles user input, authentication, secrets, files, or external requests.
---
<!-- Managed by ai-rules. Do not edit; overwritten on sync. -->
# Security basics

Short checklist. Follow the repo's existing security conventions first.

## Input

- Treat all input as hostile: request bodies, query strings, headers, file names, uploaded files, and data from other services.
- Prevent injection. Use parameterized queries for SQL; pass arguments as a list, never through a shell string, for commands; escape or encode output for HTML; resolve file paths and check they stay inside the intended directory.
- Limit size and rate: body size, upload size, page size, request frequency.
- Validate redirects and URLs the server will fetch, so a request cannot be pointed at internal addresses (SSRF).

## Authentication and access

- Check identity and permission on the server for every request. Hiding a button is not access control.
- Check that the user may touch this specific record, not only that they are logged in.
- Hash passwords with a dedicated algorithm (argon2, bcrypt or scrypt). Never store or log them in plain text.
- Use the framework's session or token handling. Do not invent your own.

## Secrets

- Keep secrets in environment variables or a secret manager, never in code, tests, logs or commits.
- Do not read real `.env` files; use `.env.example` for the list of names.
- If a secret was exposed, say so to the user so it can be rotated; removing it from the code is not enough.

## Dependencies and defaults

- Add a dependency only when needed and only after asking; prefer well-maintained ones. Run the repo's audit command if it has one.
- Use the least privilege: narrow database roles, narrow tokens, narrow file permissions.
- Fail closed: when a check cannot run, deny.
- Do not turn off TLS verification or CORS protections to make something work.

## Before opening a pull request

Run `/security-review` on the branch when the change touches any of the areas above.
