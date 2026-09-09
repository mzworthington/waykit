# Lesson: <short title>

| Field | Value |
|-------|-------|
| **Date** | YYYY-MM-DD |
| **Project** | `<project-name>` |
| **Trigger** | Correction, repeated friction, missing rule, good pattern, or agent/tool miss |
| **Lesson** | What to do differently next time |
| **Promote to** | Target file or skill (e.g. `CODING_PHILOSOPHY.md` §8, `SOPs/…`, `skills/agent-xfn/SKILL.md`) **and/or** an EDD suite/JSONL (e.g. `evals/edd/architecture_routing.jsonl`) |
| **EDD case** | `none` \| path + case `id` after `from-trace` / hand-authored row (required when trigger is agent routing, prompts, tool schemas, or MCP args) |
| **Status** | `pending` \| `promoted` \| `rejected` |

## Context

One or two sentences on what happened and why this lesson matters.

## Evidence (optional)

- Link to handover, PR, file, user correction, or chat turn that motivated the lesson.

## EDD capture (when agent/tool related)

When the friction was wrong tool, bad args, prompt/schema drift, or MCP misuse:

1. Draft a case from session context (no user paste required) - tags include `prod-derived`.
2. `wk eval dataset from-trace --trace <file> --out evals/edd/<suite>.jsonl` **or** append JSONL by hand.
3. `wk eval run --suite evals/edd/<suite>.yaml --model scripted` (red then green with the fix).
4. Record **EDD case** id/path above. See [SOPs/hypothesis-driven-debug.md](../SOPs/hypothesis-driven-debug.md) §11.

## Promotion notes (optional)

- Why this belongs in the shared kit vs the app repo only.
- Suggested wording if promoting to a specific file.
- If promoting only an eval case (no prose rule change), kit-review can mark the lesson `promoted` once the JSONL is merged.
