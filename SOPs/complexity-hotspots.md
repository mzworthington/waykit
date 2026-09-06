---
title: Complexity hotspots - detect, backlog, reduce
kind: sop
triggers:
  - complexity
  - hotspot
  - cognitive complexity
  - cyclomatic
  - god class
  - long function
  - simplify
  - refactor complexity
  - crime scene
  - temporal coupling
  - bus factor
  - code quality report
tools:
  - read
  - write
  - grep
  - shell
---
# Standard Operating Procedure: Complexity Hotspots

Reduce structural complexity in **small, test-backed batches**. Detection belongs to [agent-arch-drift](../skills/agent-arch-drift/SKILL.md); execution belongs to [agent-prune](../skills/agent-prune/SKILL.md) (complexity track). Whole-repo **crime-scene** ranking (churn × size, temporal coupling, knowledge) is the same detection role, then a human gate, then Linear via [agent-user-stories](../skills/agent-user-stories/SKILL.md). Align with [CODING_PHILOSOPHY.md](../CODING_PHILOSOPHY.md) §4 (minimal change): simplify before adding layers. Do not add an `agent-crime-scene` skill.

## 1. What counts as a hotspot

A **complexity hotspot** is code that is hard to change safely because of shape, not because it is unused (that is dead code).

| Signal | Typical threshold | Notes |
|--------|-------------------|-------|
| **Cognitive / cyclomatic complexity** | Above project linter default or > 15 per function | Prefer repo-configured rules (ESLint, Sonar, Checkstyle) |
| **Function length** | > 40–60 lines without clear structure | Domain logic may be longer if cohesive |
| **File length** | > 300–400 lines mixing concerns | Split by vertical slice, not arbitrary chunking |
| **Nesting depth** | > 3–4 levels | Extract guard clauses or early returns |
| **Parameter count** | > 3 positional args | Use a parameter object at the boundary |
| **God module** | Many unrelated exports in one file | Split slice or extract shared domain |
| **Duplicate logic** | Same branch/business rule in 2+ places | Consolidate or extract shared domain function |
| **Shotgun coupling** | One story forces edits across unrelated slices | Re-home behavior into the owning slice |

When metrics and judgment disagree, **trust change friction**: if reviewers consistently miss edge cases in a module, treat it as a hotspot even if metrics are borderline.

## 2. Backlog location

Per project, maintain:

`~/.agents/handover/<project>/complexity-backlog.md`

Do not commit backlog files to the app repo. Template:

```markdown
# Complexity backlog

| ID | Location | Signal | Class | Status | Notes |
|----|----------|--------|-------|--------|-------|
| C-001 | src/features/foo/Handler.ts | cognitive 22 | extract | ready | split validation block |
```

**Status values:** `candidate` → `ready` → `done` | `blocked` | `wontfix`

**Class values:** `extract` | `inline` | `split-slice` | `consolidate` | `defer`

## 3. Detection (audit / drift)

During [agent-arch-drift](../skills/agent-arch-drift/SKILL.md) reviews or when the user asks for a complexity pass:

1. Run project metrics when documented (see §5).
2. Walk changed files and top churn modules from recent PRs.
3. For each hotspot, open a backlog row with **signal**, **class**, and a one-line **remediation** hypothesis.
4. Do **not** refactor inline during a feature PR unless the user scoped simplification in the same change.

Route execution to `agent-prune` when rows are `ready`.

## 4. Reduction (prune - complexity track)

[agent-prune](../skills/agent-prune/SKILL.md) complexity track:

1. Load `complexity-backlog.md`; process only `ready` rows (confirm with user if backlog was auto-generated). If none, stop or ask the user to triage `candidate` rows.
2. One **batch** = one hotspot cluster (one function family or one slice folder).
3. Prefer **behavior-preserving** refactors: extract function, guard clauses, move code into owning slice, consolidate duplicates. New modules from an extract go in a **capability folder** with `index.ts`.
4. Run tests for touched slices; re-check metrics when the repo has a complexity command; run [agent-pre-commit](../skills/agent-pre-commit/SKILL.md) before marking `done`.
5. If simplification needs a lasting boundary change, route to [agent-adr](../skills/agent-adr/SKILL.md) and set row `blocked`.

| Class | Meaning | Action |
|-------|---------|--------|
| **extract** | Long function or nested block | Extract named function; guard clauses |
| **inline** | Abstraction with one call site | Inline per minimal change |
| **split-slice** | File mixes unrelated capabilities | Move into owning vertical slice |
| **consolidate** | Duplicate logic in 2+ places | Single shared domain/helper (must have 2+ consumers) |
| **defer** | Needs ADR or product decision | Set `blocked`; route to `agent-adr` if boundary change |

**Reject during prune:**

- Rewrites that change behavior without catalog/test alignment.
- New abstractions with a single call site (inline instead).
- Splitting files without moving toward vertical-slice cohesion.
- Prefixed dump files in a parent (`mermaidC4.ts` beside `mermaidImport.ts`); nest `mermaidImport/` with `index.ts` instead ([CODING_PHILOSOPHY.md](../CODING_PHILOSOPHY.md) §3).
- Leaving `name.ts` beside a `name/` directory.

## 5. Tooling (use what the repo already has)

| Stack | Examples |
|-------|----------|
| TypeScript | `eslint` complexity rules, `typescript-eslint`, optional `ts-complexity` / Sonar |
| Java | Checkstyle, PMD, Sonar cognitive complexity |
| C# | Roslyn analyzers, Sonar, NDepend if present |
| General | `rg` for duplicate strings/branches; `git log --stat` for churn |

Do not add new analysis tools without user alignment. Document the command used in the handover.

## 6. Orchestration routes

| Request | Route |
|---------|-------|
| "Simplify X" / complexity cleanup | `agent-arch-drift` (scan) → backlog → `agent-prune` → `agent-pre-commit` |
| Crime-scene / code quality report / git hotspots | Session A: `agent-arch-drift` §8 → findings handover. Human gate. Session B: `agent-user-stories` (epic + children). Play with `agent-prune`. Do not auto-file. |
| Post-audit remediation | Rows already in backlog or Linear children → `agent-prune` |
| Feature work touching a known hotspot | Note backlog ID in handover; optional small extract-only fix in scope |

Not part of the default feature lifecycle unless the user requests it or audit rows are `ready`.

## 7. Handover

Complexity work uses phase `maintenance` in `handover_prune.md` (same artifact as dead-code prune). Include:

- Backlog IDs completed
- Metrics before/after when available
- Tests run
- Rows left `blocked` or `defer` with reason

## 8. Crime-scene pass (git only)

Use when the user asks for a **code quality / crime-scene report** (Tornhill: hotspots where complexity meets change). This is ranking by **change friction**, not a linter dump.

**Tools:** `git` only. Do not add CodeScene, Sonar, ESLint complexity plugins, or a kit binary. Document every command in the handover.

Default window: last **6 months** (`--since='6 months ago'`). Skip lockfiles, vendor, generated, `dist/`, `node_modules/`. Cap pairing to the **top 20** churn paths.

### Three signals

| Signal | Git recipe | Treat as hotspot when |
|--------|------------|------------------------|
| **Hotspot** | Churn = commit count per path (`git log --since --pretty=format: --name-only`). Size = current LOC (`git show HEAD:path \| wc -l`). Score = churn × LOC. | High score vs the rest of the window (report the top cluster, not every file) |
| **Temporal coupling** | Among top-churn paths, count how often two paths appear in the same commit (`git log --name-only --pretty=format:%H`). | A pair co-changes often but does not belong in one slice (shotgun / hidden coupling) |
| **Knowledge** | `git shortlog -sn -- path` (commit authors). | **Island:** one author ≳ 70% of commits. **Fragment:** no author ≳ 40% and many names. Either is a risk note, not a rewrite by itself |

Static smells without churn stay on the §1 / §2 complexity table. They are not crime-scene rows.

### Session A — report

1. Run the three signals. Write `~/.agents/handover/<project>/handover_crime_scene.md` from [templates/crime-scene-findings.md](../templates/crime-scene-findings.md).
2. Also add matching `candidate` rows to `complexity-backlog.md` when the cluster is a shape problem (not only a knowledge note).
3. **Do not** create Linear issues. **Do not** refactor.
4. Stop. Next agent is `agent-user-stories` only after the Operator column is filled.

### Human gate

The operator marks `file` or `skip` per row. Unconfirmed rows stay skip. No agent files from an unconfirmed table. If the operator says to wrap up without filling the column, treat Session-notes recommended `file` rows as confirmed; the rest stay skip.

### Session B — Linear

[agent-user-stories](../skills/agent-user-stories/SKILL.md) on the `default` profile:

1. Deduplicate: reuse an open **complexity** epic for the project if one exists.
2. Otherwise one **epic** for this scan (`Story` + **Children**; no fake AC).
3. One **child** per `file` row: operator INVEST, one sitting, no UI wireframe. Want is lower change friction, not “run git log”. Observables: tests still pass; the named cluster is smaller or split.
4. Labels `Improvement`. Play children later with `agent-prune` (claim the Linear id first).
