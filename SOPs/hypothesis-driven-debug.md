---
title: Hypothesis-driven debugging
kind: sop
triggers:
  - bug
  - debug
  - failed job
  - root cause
  - reproduce
  - flake
  - Failed to fetch
  - live site
tools:
  - read
  - grep
  - shell
  - browser
---
# Standard Operating Procedure: Hypothesis-Driven Debugging

Owned by [agent-debug](../skills/agent-debug/SKILL.md). Use this when behavior is **wrong today**, not when designing a new feature.

Product bets, experiments, and feature flags: [hypothesis-driven-development.md](./hypothesis-driven-development.md).

Align with [CODING_PHILOSOPHY.md](../CODING_PHILOSOPHY.md) §4 (minimal change): evidence before edits; smallest fix that kills the symptom.

## 1. Intake checklist

Fill before the first product-code edit (board: [templates/debug-board.md](../templates/debug-board.md)):

| Field | Required |
|-------|----------|
| Environment | prod / staging / local / CI job name |
| Exact user action | clicks, URL, diagram/system name |
| Expected vs actual | one sentence each |
| Evidence | screenshot(s), job URL, console/Network, YAML path |
| Media labels | for each image: before \| after \| unrelated |
| Recent change? | PR, deploy, catalog publish, dependency bump |
| Agent/tool miss? | yes → plan EDD promote (§11) / no → EDD N/A |

If the user omitted env or action, ask **once** with a tight list, or infer from artifacts and mark **inferred**.

Scaffold a board before deep walks:

```bash
wk debug-board <project> "<short title>"
```

Normalize vocabulary once (“packages” vs “plugins”). If live data contradicts the user’s label, **ask once** immediately.

## 2. Triage classes

| Class | Cheap first experiment |
|-------|------------------------|
| UI / layout | Label before/after screenshots; reproduce load path; measure boxes/coords |
| Published data | `curl`/fetch live catalog revision; count nodes in the **named** entity vs peers |
| CI / media / sync | `wk debug-ci` class from the failing **step log** (`flake` vs `config-drift` vs tool/auth); diff vs a green suite |
| Fetch / bulk load | One failing URL + status vs `TypeError`; then concurrency/SW; CORS last |
| Naming mismatch | Search peer entities when the named one looks fine in artifacts |
| Already on main? | Search merged PRs / `git log -S` for the feature before implementing |

## 3. Hypothesis rules

1. Cap at **5** active hypotheses; park the rest.
2. Every hypothesis needs a **kill experiment** that takes less than a deep refactor.
3. Run the **cheapest** kill first (config A/B, artifact count, one curl).
4. Update the board after every experiment (alive / killed / confirmed).
5. Stop adding theories when one is confirmed; implement the fix.

### Ban list

- Unbounded `_probe*.spec.ts` / throwaway probes without deleting them
- “Maybe CORS” before a single failing URL is identified
- UI-filter theories when the source YAML is empty or wiped
- Product deep-dives after a viewport/config mismatch already fits
- Opening `agent-orchestrator` ceremony for a forensic bug
- Declaring done from unit tests while live/UI still broken
- Treating a green sibling workflow (CodeQL, Lighthouse) as the CI prove gate
- Treating every red `pnpm/setup` as an npm 504 without reading the failing step (`ERR_PNPM_NO_PKG_MANIFEST` is config-drift)
- Combining resilience patch, UX redesign, and CI policy in one PR
- Shipping workflow/release policy the user did not ask for
- ASCII/box-drawing **diagrams** for RCA (use Mermaid; CLI TTY chrome may use ASCII)

## 4. Reproduce ladder

```text
Live / CI evidence  →  Local fixture or failing test  →  UI path (if UI symptom)
```

| Step | Pass criteria |
|------|----------------|
| Evidence | Can point to job log line, artifact field, or screenshot region |
| Fixture / test | Automated red that names the bug |
| UI | Same diagram/route shows the break on demand |

Never invert TDD: do not land green production code then “add tests later” for domain fixes. Write a failing regression closest to the bug ([agent-tdd](../skills/agent-tdd/SKILL.md) for the regression only), then the smallest fix. When the miss is agent routing, prompts, tool schemas, or MCP args, promote an EDD case in the same loop (§11). Split PRs when symptoms diverge (layout ≠ catalog wipe ≠ pipeline policy).

## 5. Split the work

Separate PRs (or ask before combining) when any two differ:

| Bucket | Examples |
|--------|----------|
| Symptom fix | Layout bbox, stick merge, fetch retry |
| Data / publish | Catalog wipe guard, republish |
| Pipeline / release policy | “build from release only”, workflow triggers |
| UX redesign | Catalog-first open, new empty states |
| Unrelated CI | Redirect timeouts in e2e while debugging fetch |

## 6. Proof gates

| Claim | Proof |
|-------|-------|
| “Layout fixed” | Before/after visual of **initial load** (not only unit packing tests) |
| “Empty system fixed” | Named entity non-empty in **published** artifact or explicit republish TODO |
| “Job fixed” | Named verify workflow green (`ci.yml`, not a sibling CodeQL/Lighthouse run); or BLOCKED with a permission/tool gap |
| “On main” | Working tree on default branch, **uncommitted**; proposed conventional commit subject (with ticket id) |
| “Agent/tool miss fixed” | New or existing EDD case red→green; `wk eval run` (or `ci`) evidence |

Output the conventional commit subject without waiting to be asked. Do not branch or commit unless asked. Follow [conventional-commits.md](./conventional-commits.md) and [linear-ticket-workflow.md](./linear-ticket-workflow.md).

## 7. CI / ops playbook

```bash
# Latest failed run logs (repo root)
kit debug-ci
# Or a specific run:
kit debug-ci --run <run-id>
```

`wk debug-ci` prints a **class** (`flake` | `config-drift` | `tool-missing` | `auth` | `product-bug`). Classify from the failing **step log**, not the commit subject. `ERR_PNPM_NO_PKG_MANIFEST` is config-drift (nested workspace / missing `working-directory` on `pnpm/setup`). An npm **504 while downloading the pnpm binary** is flake. Wrapping every setup failure in sleep+retry is an agent miss: it doubles a deterministic error.

Prove against the **named verify workflow** (`ci.yml` / “CI & Deployment”), not a green sibling (CodeQL, Dependabot, Lighthouse). Filter with `gh run list --workflow ci.yml`. Local tests plus a green sibling are not the CI prove gate. Do not mark a Linear issue done until that workflow is green (or BLOCKED with a documented gap).

When Actions cannot be dispatched (403):

1. Document the permission gap.
2. Run the documented local equivalent if the repo has one.
3. Mark handover **BLOCKED** on remote re-run if local is insufficient.

Install missing media/browser tools only when the failing step needs them (not by default).

## 8. Prior-run context

For recurring symptoms, use `cursor-cloud` MCP when available:

1. `list-cloud-agents` (filter by name/recency)
2. `batch-fetch-details` with `includeTranscripts` / `includeDiffMetadata`
3. Summarize via subagents - do not load huge transcripts inline

Prefer learning the prior RCA over rediscovering it.

## 9. Handover & lessons

Write `handover_debug.md` using [templates/handover.md](../templates/handover.md) with **Phase = debug**. Attach or link the debug board. COMPLETE only when proof gates pass. Include:

- Root cause (one sentence)
- Hypotheses killed
- Proof of fix (paths, screenshots, job URL)
- Ops follow-ups (republish, workflow_dispatch, tool install)
- Whether a feature slice is still needed
- Proposed conventional commit subject (with Linear id when in play)
- EDD case path / id when the miss was agent/tool/prompt related (or N/A)

Stay uncommitted on main unless the user asked to commit.

Append a lesson when the user corrected framing or the same anti-pattern repeated ([lessons/README.md](../lessons/README.md)). For agent/tool/prompt misses, set **Promote to** an `evals/edd/*.jsonl` when the lesson is routing/prompt/tool ([templates/lesson.md](../templates/lesson.md)).

## 10. Orchestration routes

| Request | Route |
|---------|-------|
| Bug, failed job, live symptom | `agent-debug` → `agent-pre-commit` |
| Live Cloudflare Web Analytics / RUM / beacon | `agent-cloudflare-ops` (this SOP only if RCA is app code) |
| PostHog empty events / cookieless / wizard | `agent-posthog` (this SOP only if RCA is app code) |
| PostHog error cluster on [product-signal-intake](./product-signal-intake.md) (kind bug) | `agent-debug` - not grill → spec |
| UI/auth/SLO touched | + light XFN floor ([agent-orchestrator](../skills/agent-orchestrator/SKILL.md)) |
| “Is this already shipped?” / how-does-X-work | Triage only (§1–2); no impl |
| RCA needs new capability | `agent-debug` (COMPLETE with RCA) → `agent-orchestrator` |
| New feature / new bounded context | `agent-orchestrator` |
| Complexity-only cleanup | `agent-arch-drift` → `agent-prune` (not debug) |

## 11. Promote agent misses to EDD (mandatory when applicable)

When root cause is **wrong tool, bad args, prompt/schema drift, MCP misuse, or infinite retries** - including a miss that only exists in the **current IDE chat** - do not stop at a code fix or a prose lesson.

| Step | Action |
|------|--------|
| 1. Capture | From conversation context (no user paste required), write a trace or JSONL row: `id`, `prompt`, `expect` / `history`, reason (`user_downvote` \| `shadow_fail` \| `unhandled_tool_exception` \| `circuit_breaker`) |
| 2. Promote | `wk eval dataset from-trace --trace <file> --out evals/edd/<suite>.jsonl` **or** append a hand-authored case with tags `prod-derived` (+ reason tag) |
| 3. Red | `wk eval run --suite evals/edd/<suite>.yaml --model scripted` fails on the new case (or prove an existing case already covers it) |
| 4. Green | Fix prompt/schema/routing; re-run until green; prefer `wk eval ci --threshold-routing 95` when routing is involved |
| 5. Lesson (optional) | If process/rules should change too, append a lesson with **Promote to** pointing at that suite/JSONL ([templates/lesson.md](../templates/lesson.md)) |

Skip only when the bug is pure app/UI/CI with **no** agent-tool contract impact - mark the debug board **EDD case: N/A**.

Procedure companions: [eval-driven-development.md](./eval-driven-development.md), [edd-production-telemetry.md](./edd-production-telemetry.md).
