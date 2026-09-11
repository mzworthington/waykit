---
title: Release checklist
kind: sop
triggers:
  - release
  - ship
  - changelog
  - version
tools:
  - shell
---
# Standard Operating Procedure: Release

Use with [agent-release](../skills/agent-release/SKILL.md). Pipeline shape (verify on PR and `main`, promote, changelog push-back): [profile-pipeline](../skills/profile-pipeline/SKILL.md).

This kit ships as a **git checkout** (`install.sh` / `wk _REF`), not npm. Versioned
artifacts are **GitHub Releases** (`vX.Y.Z` tags). Changelog generation uses
**git-cliff** (same stack as ArchLens).

## 1. Quality gates

- [ ] Functional impact map aligned; no silent catalog rewrites
- [ ] XFN matrix complete; every **apply** row green or BLOCKED with owner
- [ ] Security + arch-drift findings addressed or explicitly deferred
- [ ] Pre-commit / CI green on the release revision

## 2. Human-facing package

- [ ] Conventional **commit subject** output ([conventional-commits.md](./conventional-commits.md), [linear-ticket-workflow.md](./linear-ticket-workflow.md)); stay on main, uncommitted unless asked
- [ ] Changelog / release notes: user-visible behavior, migrations, flags (name, default, expiry, rollback)
- [ ] Rollback: previous version / flag off / migration reverse notes
- [ ] Bets: timebox still open **or** confirm/kill follow-up filed ([hypothesis-driven-development.md](./hypothesis-driven-development.md))

### Kit release automation

Pipelines (keep these separate on purpose):

| Pipeline | Workflow | When |
|----------|----------|------|
| **Verify → Promote** | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | PR / `main` / `workflow_dispatch` |
| **Pages** | [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml) | Docs-site path changes on `main` |
| **CodeQL** | [`.github/workflows/codeql.yml`](../.github/workflows/codeql.yml) | PR / `main` / weekly |
| **Live EDD** | [`.github/workflows/edd-live.yml`](../.github/workflows/edd-live.yml) | Weekly schedule (Sunday 03:00 UTC) |

After green **Verify** on `main`, the **Promote** job:

1. **Detect** - `bin/release.sh detect` looks at conventional commits since the last `v*` tag.
   - `feat` → minor, `fix`/`perf`/`refactor` → patch, `!` / `BREAKING CHANGE` → major
   - `docs` / `chore` / `ci` / `test` alone do **not** cut a release
2. **Publish** - creates a GitHub Release with **version-scoped** notes (`bin/release.sh publish`): commits since the previous tag only, headed `## vX.Y.Z` (never `[unreleased]`)
3. **Sync notes** - `bin/release.sh sync-notes` rewrites every existing `vX.Y.Z` GitHub Release body from `previous-tag..this-tag` (idempotent repair)
4. **Changelog** - regenerates date-grouped `CHANGELOG.md` via `pnpm changelog` (`bin/changelog-render.mjs`) and commits `chore(changelog): …` when needed. CHANGELOG stays date-grouped; GitHub Release notes stay version-scoped.

Local:

```bash
pnpm changelog                         # regenerate date-grouped CHANGELOG.md
pnpm release:detect                    # print whether HEAD would release
bash bin/release.sh notes              # preview notes since last tag → HEAD
bash bin/release.sh notes '' v1.0.0    # first-release range (beginning → tag)
bash bin/release.sh notes v1.0.0 v1.1.0
bash bin/release.sh sync-notes         # repair GitHub Release bodies (needs GH_TOKEN)
```

Consumers pin installs with `wk _REF=vX.Y.Z` (see `install.sh`).

## 3. Ops handoff

- [ ] Load SLOs mapped to telemetry (or N/A) per `handover_telemetry.md`
- [ ] Docs/runbooks updated when operators or public API changed ([agent-docs](../skills/agent-docs/SKILL.md))
- [ ] Report catalog + XFN summary to the user before calling Release COMPLETE
