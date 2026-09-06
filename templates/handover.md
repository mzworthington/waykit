# Handover: <phase>

## Metadata

| Field | Value |
|-------|-------|
| **Phase** | grilling \| spec \| tdd \| xfn \| impl \| audit \| debug \| telemetry \| release \| maintenance |
| **Status** | COMPLETE \| BLOCKED |
| **Project** | `<project-name>` |
| **Next agent** | `agent-<role>` |
| **Date** | YYYY-MM-DD |
| **Linear ticket** | `WAY-123` or n/a |
| **Proposed commit** | `feat(scope): description (WAY-123)` or n/a |

Mark **COMPLETE** only when this phase's Definition of Done below is satisfied. Otherwise use **BLOCKED** and list gaps.

## Summary

One paragraph describing what was accomplished in this phase.

## Deliverables

- Bullet list of concrete outputs (specs, interfaces, files, audit findings).

## Test case impact

Tests are the behavior catalog (source of truth above docs). See [SOPs/behavior-catalog-and-xfn.md](../SOPs/behavior-catalog-and-xfn.md).

| Case / suite | Layer (unit / slice / browser E2E / a11y / security / load) | Action (keep / extend / rewrite / retire / add) | Aligned with user? |
|--------------|---------------------------------------------------------------|--------------------------------------------------|--------------------|
| … | … | … | yes / pending |

During **tdd short loop** / **impl**, if impact expands beyond the Design map, re-confirm with the user and update this table before changing those tests.

## Cross-functional matrix

See [agent-xfn](../skills/agent-xfn/SKILL.md).

| Quality | Apply / skip | Rationale | Threshold / SLO | Suites / paths | Green status (planned / green / n/a) |
|---------|--------------|-----------|-----------------|----------------|--------------------------------------|
| Browser E2E | | | | | |
| Accessibility | | | | | |
| Security tests | | | | | |
| Load / performance | | | | | |

## Phase Definition of Done

Incomplete DoD ⇒ Status must be **BLOCKED**, not COMPLETE.

| Phase | Minimum to mark COMPLETE |
|-------|--------------------------|
| **prd** | Bet or contract named; problem; belief; leading indicator + timebox + kill criteria (bets); experiment; feature-flag table or N/A; **memory MCP** updated with bet/flag facts (or explicit N/A) |
| **spec** | Gherkin scenarios (flag off/on/kill when flagged); draft XFN criteria (or explicit unknowns); draft catalog notes; bet/flag row or N/A; **memory MCP** updated with glossary terms (or explicit N/A - no new durable terms) |
| **tdd** (design) | Functional impact table filled; every row Aligned = yes; first reds as needed; Next agent = `agent-xfn` (plan) |
| **tdd** (short loop) | Gear 1 green (domain/handlers, mocked ports); gear 2 done or N/A (thin adapter + integration test, or reused existing); XFN fixtures noted; Next agent = `agent-xfn` (green) or `agent-adapter` only if deep-dive required |
| **xfn** (plan) | Every matrix quality apply or skip + rationale; impact rows for apply qualities; suite paths or stubs; thresholds; SLOs noted for telemetry; Aligned = yes; **memory MCP** updated with agreed SLOs/thresholds (or explicit N/A) |
| **xfn** (green) | Every **apply** row Green status = green (or BLOCKED with owner); how-to-run documented; refresh memory if SLOs changed |
| **impl** (adapter deep-dive) | Large adapters wired without domain rule changes; stayed-within Design maps **or** revised maps re-aligned; fixtures needed by XFN noted |
| **audit** | Security + arch findings recorded; catalog/XFN completeness checked (missing apply suites or silent rewrites = fail) |
| **debug** | Root cause stated; debug board updated; reproduce + proof gates passed for the symptom class; regression test added when domain logic changed. See [SOPs/hypothesis-driven-debug.md](../SOPs/hypothesis-driven-debug.md) |
| **telemetry** | Instrumentation added; XFN load SLOs (if any) mapped to metrics/alerts or explicit N/A; bet leading indicator + flag evaluation mapped or N/A. Cloudflare RUM/beacon diagnosis (`agent-cloudflare-ops`) inventories live vs IaC and proves HTTP/MCP evidence. PostHog SDK / empty events (`agent-posthog`) uses the official MCP, cookieless defaults, and a privacy notice. When product-signal-intake ran, the findings table is in the handover |
| **release** | Prior phase DoDs satisfied; conventional PR title; catalog + matrix summary reported; flags include expiry and rollback ([SOPs/release.md](../SOPs/release.md)); open bets have a confirm/kill next step |
| **maintenance** | Prune/complexity/migration batch complete; expired flags / killed slices handled when in scope; backlog rows updated; pre-commit green. See [SOPs/dead-code.md](../SOPs/dead-code.md), [SOPs/complexity-hotspots.md](../SOPs/complexity-hotspots.md) |

## Memory (required for spec / xfn when durable facts exist)

Store durable facts for later sessions via the catalogued **memory** MCP - **never secrets**.

| Field | Value |
|-------|-------|
| **Stored** | yes \| n/a (reason) |
| **Entities / notes** | e.g. glossary terms, SLOs, project prefs written this phase |

## Open questions / blockers

- List anything that must be resolved before the next phase.

## Bet / feature flag (when the slice is a bet or flagged)

See [SOPs/hypothesis-driven-development.md](../SOPs/hypothesis-driven-development.md).

| Field | Value |
|-------|-------|
| **Kind** | contract \| bet \| n/a |
| **Leading indicator** | event or n/a |
| **Timebox** | date/event or n/a |
| **Kill criteria** | or n/a |
| **Flag** | name / default / expiry or n/a |
| **Status** | draft \| in-flight \| confirmed \| killed \| n/a |

## Context for next agent

Pointers to files, decisions, constraints, and (for telemetry) load/performance SLOs from the XFN matrix.

## Pre-commit (when applicable)

| Field | Value |
|-------|-------|
| **Hook** | `.husky/pre-commit` / `.pre-commit-config.yaml` / none |
| **Commands run** | e.g. `pnpm lint`, `pnpm typecheck` |
| **Status** | PASS \| FAIL (do not mark COMPLETE if FAIL) |
