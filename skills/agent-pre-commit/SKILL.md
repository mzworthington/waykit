---
name: agent-pre-commit
description: >-
  Discovers and runs git pre-commit hook checks before handover or commit,
  then fixes failures until green. Also enforces Conventional Commits for
  commit subjects and PR titles (squash-merge uses the PR title). Use when
  finishing implementation, before declaring work complete, when opening or
  updating a PR, when the user asks to fix lint/build/hook errors, or when a
  repo has .husky/pre-commit, .git/hooks/pre-commit, or .pre-commit-config.yaml.
kind: role
phase: quality
triggers:
  - pre-commit
  - pre commit hook
  - husky
  - lint-staged
  - hook checks
  - fix lint
  - fix build
  - quality gate
  - conventional commits
  - PR title
  - commit message
depends-on: []
mcp:
  - linear
tools:
  - read
  - write
  - shell
disable-model-invocation: false
---
# Role: Pre-commit Quality Gate

Run the repo's pre-commit checks after code changes and **fix all failures** before handover or telling the user work is done.

## When to run

- End of **tdd short loop** (`agent-tdd`) and optional **adapter deep-dive** (`agent-adapter`)
- Before **release** in `agent-orchestrator` / `agent-release`
- Any time the user reports hook, lint, format, typecheck, or build failures
- Proactively when you have modified tracked files in a repo with a pre-commit hook

Skip when the user asked for a read-only review or when no hook exists and no project check scripts are documented.

## 1. Discover hooks

Check, in order:

| Path | Type |
|------|------|
| `.pre-commit-config.yaml` | [pre-commit](https://pre-commit.com/) framework |
| `.husky/pre-commit` | Husky shell hook |
| `.husky/commit-msg` | Conventional commit subject |
| `.githooks/commit-msg` | Portable commit-msg (copied to `.git/hooks` on bootstrap) |
| `.git/hooks/pre-commit` | Plain git hook |

Also read `package.json` / `Makefile` / CI workflow for scripts the hook delegates to (`lint`, `format:check`, `typecheck`, `test`, etc.).

## 2. Run checks

### pre-commit framework

```bash
pre-commit run --all-files
```

Re-run after fixes until exit code 0.

### Husky or custom shell hook

Hooks often gate on **staged** paths only. Stage modified tracked files, run the hook, then unstage (does not commit):

```bash
git add -u
.husky/pre-commit    # or: .git/hooks/pre-commit
git restore --staged .
```

If the hook still skips checks, read the script and run the underlying commands directly (see §3).

**Subset is not PASS.** A filtered `vitest run path/…` run is not the quality gate. Status is FAIL or BLOCKED until the commands named in the hook for those paths exit 0 (`lint-staged`, `oxlint --deny-warnings`, format, typecheck, knip, `vitest run --changed`, and so on). Do not mark a phase COMPLETE after skipping hook steps or after running only a path-filtered test command. [quality-loops](../../SOPs/quality-loops.md) work-picker sessions use this hook, not a path-filtered test.

### No hook

Run the project's documented quality scripts from README, `AGENTS.md`, or CI (e.g. `pnpm lint`, `pnpm typecheck`, `pnpm test`).

## 3. Infer checks from the hook script

When the hook is path-conditional, map changed files to commands:

```bash
git diff --name-only HEAD
git diff --cached --name-only
```

Common patterns:

| Changed paths | Typical commands |
|---------------|------------------|
| `app/` TypeScript | `cd app && pnpm lint && pnpm typecheck && pnpm test` (or `vitest run --changed`) |
| `docs/`, `*.md` | `cd app && pnpm format:check` |
| `app/packages/core/` | schema/codegen `--check` if hook references it |
| `*.go` in a Go module | `make check test` in that module |

Prefer the **exact commands** named in the hook over guessing.

## 4. Fix loop

1. Run checks (§2–3).
2. On failure: read stderr, fix the reported files, do not `--no-verify` or skip hooks unless the user explicitly requests it.
3. Re-run the **same** check command until exit code 0.
4. If auto-fixers run (`prettier --write`, `lint-staged`), re-run checks to confirm clean.

Report to the user: which hook/commands ran and what was fixed.

## 5. Handover note

When completing a lifecycle phase, include in the handover:

```markdown
## Pre-commit
- Hook: `.husky/pre-commit` (or none)
- Commands: `pnpm lint`, `pnpm typecheck`, …
- Status: PASS

## Goal
- Asked: <user's question, one sentence>
- Met by: <what we did that satisfies it, one sentence>
```

Do not mark **COMPLETE** while hook checks are failing. Mirror the Goal table after Pre-commit in [templates/handover.md](../../templates/handover.md).

## 6. Commit messages

When work is ready (or the user is about to commit), follow [SOPs/conventional-commits.md](../../SOPs/conventional-commits.md) and [SOPs/linear-ticket-workflow.md](../../SOPs/linear-ticket-workflow.md).

- **Output** a commit subject `type(optional-scope): description`. Include `(WAY-123)` when a Linear issue was in play, and repeat the id in the body.
- Stay on **main**. Leave the tree **uncommitted**. Do not `git commit`, push, or open a PR unless the user explicitly asks.
- Type follows **behavior**, not file extension. Changes under `skills/`, `SOPs/`, `models/`, or `AGENTS.md` routing are `feat(skills):` / `feat(sops):` / `fix`, never `docs` just because they are Markdown.
