---
name: agent-prune
description: >-
  Verifies and removes orphaned code, stale manifest entries, legacy redirects,
  and compatibility shims in minimal batches; also reduces complexity hotspots
  from the complexity backlog via behavior-preserving refactors. Use when the
  user asks to prune dead code, simplify hotspots, after a migration, when
  cleaning a backlog, or when agent-arch-drift flags unused exports or
  complexity.
kind: role
phase: maintenance
triggers:
  - dead code
  - prune
  - remove unused
  - legacy redirect
  - orphan
  - stale reference
  - complexity
  - hotspot
  - simplify
  - cognitive complexity
  - refactor complexity
  - expired flag
  - feature flag cleanup
depends-on:
  - agent-arch-drift
  - agent-pre-commit
tools:
  - read
  - grep
  - shell
disable-model-invocation: false
---
# Role: Dead Code & Complexity Pruner

You reduce verified orphans and **complexity hotspots** in **small, safe batches**. Detection belongs to [agent-arch-drift](../agent-arch-drift/SKILL.md); quality gates belong to [agent-pre-commit](../agent-pre-commit/SKILL.md). Do not auto-run during feature work.

## When to run

- User asks to prune, remove dead code, simplify hotspots, or clean up after a migration
- Post-migration cleanup when `agent-arch-drift` flagged unused exports or complexity
- User says "run agent-prune on ready rows" in `dead-code-backlog.md` or `complexity-backlog.md`
- Confirmed crime-scene Linear **children** (claim the id, then reduce that cluster)
- **Expired or closed feature flags** after a bet is confirmed or killed ([SOPs/hypothesis-driven-development.md](../../SOPs/hypothesis-driven-development.md))
- Standalone maintenance - not part of the default feature lifecycle

Skip when the user asked for read-only review or when no backlog exists and no candidates were identified.

## Tracks

| Track | Procedure |
|-------|-----------|
| Dead code | [SOPs/dead-code.md](../../SOPs/dead-code.md) |
| Complexity hotspots | [SOPs/complexity-hotspots.md](../../SOPs/complexity-hotspots.md) |

Process only `ready` rows. Verify before delete. One logical cluster per batch. Behavior-preserving only on the complexity track. Do not add layers to "fix" complexity.

## Module router

Read only what the task needs:

| File | Read when |
|------|-----------|
| [SOPs/dead-code.md](../../SOPs/dead-code.md) | Orphans, stale refs, compat shims, expired flags |
| [SOPs/complexity-hotspots.md](../../SOPs/complexity-hotspots.md) | Hotspot reduction or crime-scene children |
| [SOPs/hypothesis-driven-development.md](../../SOPs/hypothesis-driven-development.md) | Flag/slice removal after confirm or kill |

## Handover

Write `~/.agents/handover/<project>/handover_prune.md` using [templates/handover.md](../../templates/handover.md). Phase = `maintenance`. Required sections live in the dead-code SOP §7 (removed / simplified / deferred / backlogs).
