---
name: update-architectures
description: Use when the user asks to review or update the architecture catalog of ai-rules.
---

# Update the architecture catalog

This skill belongs to the ai-rules source repository only. It keeps `plugins/ai-rules/payload/managed/ai-rules/architectures.md` current. Every repository that uses ai-rules receives the result through sync.

## Steps

1. Read `plugins/ai-rules/payload/managed/ai-rules/architectures.md` and note its `Last reviewed:` date.
2. Research on the web: architecture styles that are in real use, changes in how the listed styles are understood, and boundary tools per stack (new tools, renamed or abandoned ones). If this session has no web search tool, say so and stop. Do not update the catalog from memory.
3. Apply the bar for a change:
   - a style or tool is added only when at least two independent, reputable sources document it and it is used in production systems;
   - never add something only because it is new;
   - remove or reword an entry only when sources show it is misleading or obsolete.
4. Show the user every proposed change (add, edit, remove), one line each, with its sources as links. The user chooses which ones to accept. Change nothing before that.
5. Edit the catalog:
   - every style keeps the same four lines (`What it is`, `Fits when`, `Does not fit when`, `Typical modules and rule`);
   - set `Last reviewed:` to today's date, even when nothing else changed;
   - keep the file at 150 lines or fewer;
   - when a style name is added, removed or renamed, update the list of names in `tests/content.test.cjs` and the list in `README.md`;
   - when a boundary tool is added, removed or renamed, keep the three columns of the table (Stack, Tool, How it runs) and update the same table in `README.md`. Tests do not pin tool names.
6. Run:

   ```bash
   node plugins/ai-rules/scripts/sync.cjs --bump
   node plugins/ai-rules/scripts/sync.cjs --target .
   npm test
   ```

7. Offer a commit on its own branch and a pull request that follows `ai-rules-creating-prs`, listing the sources under `## Why`. Do both only if the user agrees.
