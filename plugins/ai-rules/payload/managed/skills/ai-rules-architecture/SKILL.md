---
name: ai-rules-architecture
description: Use when choosing or recording a project's architecture, or before adding code that crosses module boundaries.
---
<!-- Managed by ai-rules. Do not edit; overwritten on sync. -->
# Architecture

A project with clear boundaries is cheaper to change: you know where to read and where to write, and a fix in one place does not break another. The goal here is a short Architecture section in `CLAUDE.md` that the user has chosen and that every later session follows.

There is no preset answer. You bring the options and your opinion; the user decides.

## Start

1. When choosing or recording an architecture, read `.claude/ai-rules/architectures.md`, the catalog of styles and boundary tools. When you are only placing code in a repo that already has the section, skip to "While coding".
2. If `CLAUDE.md` still has an old `## Structure` section, propose turning it into `## Architecture`. Never keep both.
3. Work out which of the three cases below applies.

## New repository

Ask about these four topics, one at a time, and skip any the conversation already answered:

- size: how big the product will get and how many people work on it;
- deployment: where it runs and how often it is released;
- business areas: the main parts of the domain;
- special needs: heavy or spiky load, independent teams, several user interfaces, strict latency.

Then present two or three architectures that fit. For each one say:

- why it fits this project, in terms of the answers you got;
- what it costs here;
- what would make it the wrong choice.

Say which one you would pick and why. Then the user decides. Write nothing until they have.

## Existing repository with a clear architecture

Recognize it from the directory layout and from which way the imports point. Record it as it is. Do not propose a different architecture unless the user asks.

## Existing repository without a clear architecture

When the code mixes several styles or follows none:

1. Describe what is there, with paths as evidence.
2. Present two or three architectures the code could move toward. For each one give how well it fits, what the migration would cost, and what could stay as it is.
3. The user decides.
4. Record the choice as a target: `- Style: <style> (target; <what does not follow it yet>)`.

New code follows the target. Do not refactor existing code to match unless the user asks for it.

## Outside the catalog

When nothing in the catalog fits, you may propose another style. Say plainly that it is not in the catalog, and suggest adding it to the catalog in the ai-rules source repository.

## The section to write

```markdown
## Architecture
- Style: <style>. Chosen because <reason>.
- Modules: `<path>/` <what it owns>; ...
- Dependency rules: <what may import what>.
- New code: <where a new feature goes>.
```

In every case, show the section and say which of the three cases you judged it to be; write it only after the user agrees.

Keep it short; `CLAUDE.md` as a whole stays at 60 lines or fewer. Monorepo: still one section, with one entry per package under Modules.

If the user does not want to decide now, write `- Style: not decided (user choice)`, leave the other lines as they are (keep the content of an old Structure section under Modules), and do not raise it again unless the user brings it up.

## Boundary check

Once the section is agreed, propose a tool that checks the dependency rules, from the Boundary tools table of the catalog:

- Ask before installing it; it is a new dependency.
- Read the tool's documentation before writing its configuration; do not write it from memory.
- Make it run together with lint. A lint plugin or a command-line tool goes into the existing lint script. When the tool is a test library, put its rules in a separate test target. Either way, if the command is not part of the lint script, list it under `verify.commands.lint` in `.claude/ai-rules.json` and run it whenever you run lint; the usual retry limit then applies to it.
- A tool checks imports. If it cannot express one of the dependency rules (for example "no shared database"), say which rule stays unchecked.
- Monorepo: each package uses the tool of its own stack.
- If the stack has no tool in the table, say so. The rule in `CLAUDE.md` is then the only guard.

## While coding

- Put new code in the module that owns it.
- Before crossing a module boundary or breaking a dependency rule, stop and ask the user. If the rule is wrong for the project, propose changing the section; do not work around it.
