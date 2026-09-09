---
title: Agent Kit Review
kind: task
frequency: weekly
triggers:
  - kit review
  - promote lessons
  - improve agents
  - kit maintenance
---
# Agent Kit Review

Run this checklist weekly (or after a major feature) to turn local session lessons into durable kit improvements.

## 1. Scan local lessons

- [ ] Open `~/.agents/lessons/<project>/` for each active project
- [ ] List entries with `Status: pending` (format: [templates/lesson.md](../templates/lesson.md))
- [ ] Merge duplicates (same lesson, multiple dates → one promoted rule)

## 2. Triage each pending lesson

For each entry, decide:

| Decision | Action |
|----------|--------|
| **Promote** | Update the target file in the kit repo; mark lesson `promoted` |
| **Project-only** | Move rule to the app repo `.cursor/skills/`; mark `promoted` |
| **Reject** | No change needed; mark `rejected` with a one-line reason |

### Promotion targets

| Lesson type | Where it goes |
|-------------|---------------|
| Tone, planning, collaboration | [CODING_PHILOSOPHY.md](../CODING_PHILOSOPHY.md) §8 |
| Catalog / XFN procedure | [SOPs/behavior-catalog-and-xfn.md](../SOPs/behavior-catalog-and-xfn.md) |
| Repeatable procedure | [SOPs/](../SOPs/) or [tasks/](../tasks/) |
| Stack-specific / XFN tooling | [skills/lang-*](../skills/) or [skills/framework-*](../skills/) |
| Lifecycle behavior | [skills/agent-*](../skills/) (esp. tdd, xfn, arch-drift, telemetry, **debug**) |
| Agent routing / prompt / tool miss | [evals/edd/](../evals/edd/) JSONL + suite (tags `prod-derived`); see [hypothesis-driven-debug.md](../SOPs/hypothesis-driven-debug.md) §11 |
| Project quirk | App repo only |

When a lesson’s **EDD case** field is set, confirm the JSONL row exists and `wk eval run` covers it before marking `promoted`.

## 3. Audit the shared kit

- [ ] Run [agent-arch-drift](../skills/agent-arch-drift/SKILL.md) against the kit repo: duplicate rules, contradictions, skills that grew too long
- [ ] **Skill length budget:** `wk verify` fails role `SKILL.md` bodies over 150 lines unless allowlisted; move procedure detail into [SOPs/](../SOPs/)
- [ ] Check [skills/README.md](../skills/README.md) taxonomy still matches actual skills
- [ ] Confirm skill frontmatter `mcp:` ids exist in [mcps/catalog.json](../mcps/catalog.json)
- [ ] Confirm MCP install is a **single** profile (not stacked collab+devtools+ops); default includes kit-knowledge, memory, and linear
- [ ] Run `pnpm wk measure-context` - always-on surface within target ([SOPs/context-budget.md](../SOPs/context-budget.md))
- [ ] Confirm [AGENTS.md](../AGENTS.md) stays a thin index (no eager “read these eight files” lists)
- [ ] Spot-check recent `handover/<project>/` runs: was test impact aligned? Was an XFN matrix present (including skip reasons)? Were apply suites greened? Was TDD gear 2 done in-session (not a late adapter-only phase)?
- [ ] Confirm stack profiles still list XFN tooling defaults consistent with [agent-xfn](../skills/agent-xfn/SKILL.md)
- [ ] Run [kit-eval-harness.md](./kit-eval-harness.md) golden prompts after routing changes

## 4. Commit promoted changes

- [ ] Commit kit updates with a message that references the lesson title(s)
- [ ] Pull latest kit on other machines (`git pull` in the clone behind `~/.agents`)

## 5. Optional retro

After a multi-phase lifecycle run, check `handover/<project>/` for friction that never became a lesson. Add any worth keeping before closing the feature.
