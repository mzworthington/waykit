---
title: Dead code - verify, backlog, delete
kind: sop
triggers:
  - dead code
  - prune
  - unused export
  - orphan
  - stale reference
  - legacy redirect
  - expired flag
  - feature flag cleanup
tools:
  - read
  - grep
  - shell
---
# Standard Operating Procedure: Dead Code

Owned by [agent-prune](../skills/agent-prune/SKILL.md) (dead-code track). Detection belongs to [agent-arch-drift](../skills/agent-arch-drift/SKILL.md). Quality gates belong to [agent-pre-commit](../skills/agent-pre-commit/SKILL.md). Complexity shape problems are [complexity-hotspots.md](./complexity-hotspots.md), not this SOP.

Do not auto-run during feature work. Invoke only when the user requests pruning or approves backlog rows.

## 1. Backlog location

`~/.agents/handover/<project>/dead-code-backlog.md`

Do not commit backlog files to the app repo. Status: `ready` | `blocked` | `done`.

If no backlog exists, build one from `agent-arch-drift` findings or grep (§3), then **stop and confirm** with the user before deleting.

## 2. Classify each candidate

| Class | Meaning | Action |
|-------|---------|--------|
| **orphan** | Zero importers; symbol and file unused | Delete module + tests |
| **type-only** | Only a type export is still imported | Move type inline, delete module |
| **stale-ref** | Source deleted but manifests/docs still reference it | Remove stale entries only |
| **compat** | User-facing contract (URLs, redirects, deep links) | Requires explicit user OK + sunset note |

## 3. Verify before delete (mandatory)

For each candidate, run all applicable checks:

```bash
rg -n '<symbol-or-route>' <repo-root>
# Exported but unused (only if the repo already documents a tool)
# e.g. pnpm exec knip, ts-prune
```

Also search route strings (routers, redirects, docs, e2e), codegen manifests (OpenAPI, protobuf, `blueprints/*.yaml`), docs, and tests. Distinguish "only used in its own test file" from real consumers.

Do not delete **compat** items until the user confirms no needed sunset period.

## 4. Delete in batches

One logical cluster per change set:

| Batch example | Scope |
|---------------|-------|
| `diagramState/*` orphans | One module family |
| `App.tsx` redirects | All related routes together |
| TraceLens URL compat | Hook + page + tests together |

Per batch:

1. Delete or inline code (minimal diff - [CODING_PHILOSOPHY.md](../CODING_PHILOSOPHY.md) §4).
2. Remove stale manifest and doc entries in the **same** batch.
3. Run [agent-pre-commit](../skills/agent-pre-commit/SKILL.md) until green.
4. Update backlog row status.

## 5. Compat shims (redirects, legacy URL params)

1. Ask: live bookmarks, published docs, or analytics still hitting this path?
2. Record sunset date in backlog if removing.
3. Remove redirect routes, legacy param fallbacks, and tests together.

If uncertain, leave the row `blocked` and note why in handover.

## 6. Expired feature flags

Treat a closed bet's flag as **compat** until the user confirms removal ([hypothesis-driven-development.md](./hypothesis-driven-development.md)):

1. Confirmed: default on in code, delete flag checks, delete flag-off catalog cases that are no longer reachable, keep flag-on behavior as the new contract.
2. Killed: keep flag off (or delete the new path), restore the prior path, retire flag-on cases.
3. Search for the flag name across code, tests, docs, and release notes before delete.
4. Same batch as other prune work; run pre-commit until green.

## 7. Handover

Write `handover_prune.md` using [templates/handover.md](../templates/handover.md). Phase = `maintenance`. Include:

```markdown
## Removed (dead code)
- <symbol/file> - <one-line reason>

## Simplified (complexity)
- <backlog-id> <location> - <what changed>

## Deferred (blocked)
- <item> - <why, e.g. compat sunset or ADR pending>

## Backlogs
- dead-code-backlog.md: N ready → done
- complexity-backlog.md: N ready → done
```

## 8. Orchestration routes

| Role | Responsibility |
|------|----------------|
| [agent-arch-drift](../skills/agent-arch-drift/SKILL.md) | Find violations; append to `dead-code-backlog.md` |
| **agent-prune** | Verify and execute ready rows |
| [agent-pre-commit](../skills/agent-pre-commit/SKILL.md) | Prove green after each batch |
| [agent-adr](../skills/agent-adr/SKILL.md) | Record hard-to-reverse simplification choices |

When `agent-arch-drift` finds dead code, add a backlog row instead of deleting inline during a feature PR.
