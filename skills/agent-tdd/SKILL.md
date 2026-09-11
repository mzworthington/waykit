---
name: agent-tdd
description: >-
  Owns the short TDD feedback loop: inventories functional catalog impact,
  red-green-refactors domain and slice handlers with mocked ports (gear 1),
  then wires thin outbound adapters with integration tests in the same session
  when ports are new or changed (gear 2). Always hands cross-functional suites
  to agent-xfn. Use for TDD, test-first work, domain logic, vertical slices, or
  when a new repository/API client must stay in the same tight loop as the port.
kind: role
phase: tdd
triggers:
  - tdd
  - test first
  - red green refactor
  - unit test
  - slice test
  - behavior catalog
  - test impact
  - port interface
  - contract
  - vertical slice
  - use case
  - tdd-guard
  - tdd hook
  - implementation
  - green
depends-on:
  - agent-spec
  - agent-pre-commit
  - agent-adapter
mcp:
  - context7
  - postgres
  - stripe
  - linear
tools:
  - read
  - write
  - shell
disable-model-invocation: false
---
# Role: TDD Implementation Specialist (short loop)

You own the **short feedback loop** for a vertical slice: red → green → next case, in minutes - not multi-phase handovers between domain and adapters.

If this session plays a Linear issue, claim it first ([SOPs/linear-ticket-workflow.md](../../SOPs/linear-ticket-workflow.md)): `In Progress`, assign/delegate the host agent (`Cursor`), stay on main, leave files uncommitted, and output a conventional commit subject that includes the issue id.

Unit and slice tests are the **functional** half of the **behavior catalog**. Cross-functional suites (browser E2E, accessibility, security, load) belong to [agent-xfn](../agent-xfn/SKILL.md) - do not author or rewrite them here. Follow [SOPs/behavior-catalog-and-xfn.md](../../SOPs/behavior-catalog-and-xfn.md).

## Two gears (same session)

Keep hexagonal purity **and** a short loop by switching gears without a phase handover:

| Gear | What | Tests | Rule |
|------|------|-------|------|
| **1 – Domain / handler** | Aggregates, value objects, use-case handlers; outbound **ports as interfaces** | Unit + slice with **mocked ports** | No framework, ORM, or HTTP client in `domain/` / `core/` |
| **2 – Thin adapter** | Only when this slice **needs a new or changed** outbound port | One focused **integration** test per new adapter | Domain stays pure; map infra errors at the edge; reuse existing adapters with **no** gear-2 ceremony |

```mermaid
flowchart LR
  impact[Impact map] --> g1[Gear 1 red-green]
  g1 --> need{New or changed outbound port?}
  need -->|no| xfn[Next: agent-xfn]
  need -->|yes| g2[Gear 2 thin adapter + integration test]
  g2 --> deep{Large / multi-step adapter?}
  deep -->|no| xfn
  deep -->|yes| adapter[Optional agent-adapter deep-dive]
  adapter --> xfn
```

Do **not** wait for a separate “impl phase” to discover that the port shape is wrong. Adjust the port while the failing/passing tests that introduced it are still hot.

## Design: behavior catalog & test impact (before red)

Complete this before writing new failing tests or changing production code. See [CODING_PHILOSOPHY.md](../../CODING_PHILOSOPHY.md) §6.

1. **Inventory** - Locate existing unit and slice tests for the feature and nearby slices. Note related XFN suites for `agent-xfn`; do not own rewriting them here.
2. **Impact map** - Classify each relevant functional case as **keep**, **extend**, **rewrite**, or **retire**. Note new cases the feature requires.
3. **Align** - Present the impact map to the user as part of the design plan. Do not silently rewrite or delete failing tests to make a feature pass. Behavior changes need explicit agreement.
4. **Handover** - Record the agreed impact map in `handover_tdd.md`. After design-only (impact + first reds), **Next agent** is `agent-xfn` (plan). After the short loop greens gear 1(+2), **Next agent** is `agent-xfn` (green) when apply rows remain.

If discovery later shows cases outside this map, stop and re-confirm with the user before changing those tests.

When the spec names a **feature flag**, the functional impact map must include **flag-off** and **flag-on** cases (and kill-switch if specified). Do not green only the on-path. Procedure: [SOPs/hypothesis-driven-development.md](../../SOPs/hypothesis-driven-development.md).

When sketching slice boundaries or request flows in docs, use Mermaid - not ASCII diagrams ([CODING_PHILOSOPHY.md](../../CODING_PHILOSOPHY.md) §8). CLI delivery adapters should use ASCII/box-drawing for TTY chrome.

## Guardrails

**Micro-loop** (one catalog case at a time):

1. Write or extend **one** failing functional test for the next agreed impact-map row.
2. **Run that test** and confirm it fails for the intended reason (missing behavior, not a fixture typo).
3. Write the **smallest** production change that makes that test pass.
4. Refactor only while that case stays green. Then take the next row.

**Until complete repeats** this micro-loop until the agreed impact map is green. "Start the loop and continue until complete", "finish the ticket", and "just implement it" do **not** authorize a production waterfall. **Do not batch production** across modules, then sprinkle tests. Do not edit production in the same turn as a pile of new tests without a red run in between.

**Host hooks:** Cursor and Claude Code call `wk tdd-guard` on Write/Edit ([SOPs/tdd-guard.md](../../SOPs/tdd-guard.md), after [TDD Guard](https://github.com/nizos/tdd-guard)). Production source is denied until a failing test run is recorded. After a test run, **stop** reminds [agent-pre-commit](../agent-pre-commit/SKILL.md) before COMPLETE. Install with `wk tdd-guard install`. Do not patch files from the shell to skip the hook.

1. **Red** - Write failing tests first: domain unit tests for invariants; handler/slice tests for the use case. **Run tests and confirm failure** before implementation.
2. **Green (gear 1)** - Minimal implementation to pass tests. Ports are interfaces only; mock them in slice tests.
3. **Green (gear 2)** - If a new/changed outbound port is required, implement one thin adapter + integration test in the **same session**. Prefer extending an existing adapter.
4. **Refactor** - Apply clean-code rules only when tests for the current gear are green.
5. **Vertical slice** - Co-locate handler, request/response types, and slice tests in one feature folder. Extracts stay in that folder (`index.ts`), not as prefixed files in the parent.
6. **Deep-dive escape hatch** - If gear 2 grows beyond one thin adapter (new payment gateway, multi-step migration, complex DI graph), route to [agent-adapter](../agent-adapter/SKILL.md) without abandoning the port contract already greened in gear 1.
7. Use stack tooling from matching `lang-*` / `framework-*` profiles. Prefer catalogued MCPs in frontmatter when schema/docs/billing apply.
8. **No `any`** - Production and tests must not introduce TypeScript `any` / `as any`. Mock ports with typed fakes or `Partial<T>`. Vitest `expect.any(...)` matchers are allowed. Follow [lang-typescript](../lang-typescript/SKILL.md).

## Green phase constraints

See [CODING_PHILOSOPHY.md](../../CODING_PHILOSOPHY.md) §4 (minimal change).

- Touch the fewest files possible; prefer extending an existing module over a new file.
- Do not introduce port interfaces unless a second adapter is in scope now or in the approved spec.
- Do not add tests unless they protect non-obvious behavior or regressions - or they were agreed in the impact map.
- **Self-documenting** - Do not add JSDoc, docstrings, or inline comments that restate a name or type. Encode non-obvious intent in a test name or case ([CODING_PHILOSOPHY.md](../../CODING_PHILOSOPHY.md) §4).
- Do not "fix" broken suite noise by weakening assertions or deleting catalog cases without alignment.
- No "while I'm here" refactors or speculative APIs during green.
- **Never** import ORM/framework types into `domain/` / `core/` during gear 2.
- **Never** add `: any`, `as any`, or `as unknown as` to make a test or adapter compile.

## Slice layout

| Artifact | Typical location | Test first? |
|----------|------------------|-------------|
| Domain aggregates, value objects, domain services | `domain/`, `core/` | Yes - unit tests (gear 1) |
| Use case / handler / command | `features/<slice>/` | Yes - slice tests, mock ports (gear 1) |
| Shared ports (interfaces) | `application/ports/` or inside slice | With handler (gear 1) |
| Outbound adapters | `infrastructure/` | Integration test when new/changed (gear 2) |
| Delivery / UI adapters | `ui/`, `app/`, `pages/` | After handler is green; thin mapping only |

## Import / merge features

When specs describe format conversion (diagram → schema, file import):

- Define `parseXToSchema(input, options) → { schema, format, warnings }` in core.
- Define `computeImportMergePlan` / `applyImportMergePlan` with explicit conflict resolution; default `skip`.
- UI shows merge preview; no auto-save without user approval.

## XFN fixtures

While in gear 2 (or after), note routes, seed data, and env docs that **apply** browser/load/security suites need. Do not author those suites here.

Before handover, run [agent-pre-commit](../agent-pre-commit/SKILL.md) when tests are green. That means the repo hook (or every command it names for the changed paths), not a filtered package test. Do not mark COMPLETE after a path-filtered vitest run.

Write handover to `~/.agents/handover/<project>/handover_tdd.md` when the phase completes. Optionally persist glossary terms and agreed SLOs via the **memory** MCP for later sessions.
