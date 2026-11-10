---
name: profile-docs
description: >-
  Structures product documentation with the Diátaxis framework and a
  four-dimension tone calibration: tutorials, how-to guides, reference, and
  explanation. Use when auditing, moving, or rewriting docs, or when asked for
  Diátaxis, tone, a tutorial, a how-to, reference, or conceptual explanation.
  Product vocabulary and tone targets stay in the app repo.
kind: profile
phase: stack
triggers:
  - diataxis
  - tone
  - voice
  - tutorial
  - how-to
  - how to guide
  - reference docs
  - explanation
  - documentation structure
  - docs rewrite
  - docs information architecture
depends-on:
  - agent-docs
  - agent-copy
  - profile-prose-lint
tools:
  - read
  - write
disable-model-invocation: false
---

# Documentation profile (Diátaxis)

Use this when creating or restructuring user-facing docs. [agent-docs](../agent-docs/SKILL.md) owns accuracy against the behavior catalog. [agent-copy](../agent-copy/SKILL.md) owns marketing and landing voice. This profile owns quadrant discipline.

Product names, CLI flags, spelling exceptions, and paths that must not move live in the app repo (`.cursor/skills/`), not here.

## Quadrants

| Quadrant | Reader need | Write | Leave out |
| --- | --- | --- | --- |
| Tutorial | Learn by doing | One path to a working outcome | Flag tables, schema dumps, design debate |
| How-to | Finish a task | Prerequisites, steps, expected output, a check | History and alternate designs |
| Reference | Look something up | Neutral text, types, defaults, grouped by function or name | Procedures and opinion |
| Explanation | Understand why | Trade-offs and mechanics | Step-by-step commands |

## Folder layout

```
docs/tutorials/
docs/how-to/
docs/reference/
docs/explanation/
```

Keep decision records, PRDs, plans, and generated reports outside these folders. Record their quadrant in an index. Move a published page only when the existing URL still resolves (same route, alias, or redirect) and the route tests agree.

## Rewrite rules

1. Open with what the subject does and when to use it. No preamble.
2. Match the file's quadrant. Move mismatched material. Do not leave a summary of it in the wrong file.
3. Procedures use active voice and imperative commands.
4. Preserve flags, config keys, schema fields, defaults, and sample syntax verbatim. Read them from the implementation, not from an older doc.
5. Use the project's spelling locale. The Waykit default is British English.
6. Calibrate tone in the project skill. Dimensions and sentence shape: [references/tone.md](references/tone.md). Lint banned words with [profile-prose-lint](../profile-prose-lint/SKILL.md).
7. Do not invent behavior. If the catalog or source disagrees with a draft, stop and flag the drift.

## Audit before a large move

Write a table: current path, what the page mixes, target quadrant, target path, URL action (keep, alias, redirect). Then move one quadrant at a time.
