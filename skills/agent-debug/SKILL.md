---
name: agent-debug
description: >-
  Runs hypothesis-driven debugging for bugs, CI failures, live-site symptoms,
  and fetch/runtime errors. Use when something is broken, a job failed, the UI
  looks wrong, the user reports Failed to fetch, layout overlap, empty
  diagrams, flaky tests, or when a fix needs reproduce → isolate → verify
  before the full feature lifecycle.
kind: role
phase: debug
triggers:
  - bug
  - debug
  - broken
  - failed
  - failure
  - flake
  - reproduce
  - root cause
  - regression
  - CI failed
  - job failed
  - Failed to fetch
  - overlap
  - empty diagram
  - live site
  - hypothesis
depends-on:
  - agent-tdd
  - agent-pre-commit
  - agent-xfn
mcp:
  - sentry
  - chrome-devtools
  - github
  - cloudflare
  - cloudflare-observability
  - linear
tools:
  - read
  - grep
  - shell
  - browser
disable-model-invocation: false
---
# Role: Hypothesis-Driven Debugger

You fix **broken behavior** with a short, evidence-first loop. Do **not** open the full feature lifecycle (`agent-prd` / `agent-spec` → …) for a bug unless root cause expands into a new bounded context. Product bets and flags are [SOPs/hypothesis-driven-development.md](../../SOPs/hypothesis-driven-development.md), not this skill.

If this session plays a Linear issue, claim it before changing code ([SOPs/linear-ticket-workflow.md](../../SOPs/linear-ticket-workflow.md)). Stay on main, uncommitted. Output a conventional commit subject with the issue id. Assign/delegate the host agent (**Cursor**). Do not branch or commit unless asked.

Procedure: [SOPs/hypothesis-driven-debug.md](../../SOPs/hypothesis-driven-debug.md).
Board template: [templates/debug-board.md](../../templates/debug-board.md).
Tooling: `kit debug-board`, `kit debug-ci`.

## When to run

- User reports a bug, failed job, flake, wrong UI, empty data, or runtime/fetch error
- Mid-feature tests go red and product design is not the question
- Prior agent claimed a fix but the symptom remains
- You need forensics on live artifacts / CI logs before touching product code

**Skip** when the ask is a new feature, pure scoping (“how much work?”), or intentional redesign with no broken symptom.

## Scope gate (vs orchestrator)

| Request | Route |
|---------|-------|
| Bug / failed job / live-site symptom | **`agent-debug`** (this skill) |
| Live Cloudflare Web Analytics / RUM / beacon | **`agent-cloudflare-ops`** (this skill only if RCA is app code) |
| PostHog empty events / cookieless / wizard | **`agent-posthog`** (this skill only if RCA is app code) |
| PostHog error cluster on [product-signal-intake](../../SOPs/product-signal-intake.md) (kind bug) | **`agent-debug`** - not grill → spec |
| Bug that needs a new product capability after RCA | Debug → then `agent-orchestrator` / light feature path |
| “Is this already shipped?” / how-does-X-work | Triage only; no impl |
| New feature / new bounded context | `agent-orchestrator` |

## Mandatory loop

Load the SOP. Keep a **Hypothesis Board** on disk. Do not skip **Reproduce** (Evidence) or **Prove**. Unit green alone is not enough for UI or published-artifact bugs.

```text
Triage → Reproduce → Hypothesize → Falsify (cheap first) → Fix → Prove → Handover
```

Each live hypothesis needs a claim, Evidence that would kill it, and a cheap experiment first. Cap at 5. After **Root Cause**, write a failing regression ([agent-tdd](../agent-tdd/SKILL.md) for that test only), then a minimal fix. Agent/tool/prompt misses: promote an **EDD case** from context (do not wait for a paste) and run `kit eval` (SOP §11). Then [agent-pre-commit](../agent-pre-commit/SKILL.md). For UI/auth/SLO touches, apply the orchestrator **light XFN floor**.

## Module router

Read only what the task needs:

| File | Read when |
|------|-----------|
| [SOPs/hypothesis-driven-debug.md](../../SOPs/hypothesis-driven-debug.md) | Always, before the first product-code edit |
| [templates/debug-board.md](../../templates/debug-board.md) | Scaffolding or updating the board |
| [references/tooling.md](./references/tooling.md) | Choosing evidence tools (`kit debug-ci`, browser, cloud transcripts) |
| [SOPs/product-signal-intake.md](../../SOPs/product-signal-intake.md) | PostHog error cluster / kind-bug row |

## Handover

Write `~/.agents/handover/<project>/handover_debug.md` using [templates/handover.md](../../templates/handover.md) with **Phase = debug**. Required fields: Root Cause, hypotheses killed, proof, ops follow-ups, EDD case path or N/A. SOP §9 lists the rest.

If RCA needs a new capability, hand off to `agent-orchestrator` with the debug board as intake.
