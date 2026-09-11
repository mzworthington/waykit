---
title: Conventional commits and PR titles
kind: sop
triggers:
  - commit
  - pull request
  - PR title
  - squash merge
  - conventional commits
  - changelog
  - feat vs docs
tools:
  - shell
---
# Standard Operating Procedure: Conventional Commits & PR Titles

Default: stay on **main**, leave the tree **uncommitted**, and **output** a conventional subject for the user to commit. Do not create a branch or run `git commit` unless asked. If the user does open a PR, keep that title conventional too.

Align with [CODING_PHILOSOPHY.md](../CODING_PHILOSOPHY.md) §8 (Interaction Mandate).

## Format

```text
<type>(optional-scope): <description>
```

- **type** (required): one of `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`
- **scope** (optional): short area (`cli`, `canvas`, `skills`, `sops`, `mcp`, …)
- **description**: imperative, lowercase start, no trailing period, ≤ ~72 chars for the subject line (hard cap 100 including a ticket suffix)
- Breaking change: `!` after type/scope (`feat(api)!: …`) and/or a `BREAKING CHANGE:` footer in the body
- **Linear ticket:** when the session played an issue, put `(WAY-123)` at the end of the subject when it fits, and repeat the identifier on its own line in the body. Procedure: [linear-ticket-workflow.md](./linear-ticket-workflow.md)

Work stays on **main** and **uncommitted** unless the user asks to commit. The message is an **output** of the work, not a reason to create a branch or run `git commit`.

Examples:

| Good | Bad |
|------|-----|
| `feat(skills): add agent-debug skill` | `docs: add agent-debug skill` |
| `feat(sops): route model class before tdd` | `docs: update model-routing SOP` |
| `fix(cli): retry transient R2 errors` | `Fixed the R2 issue` |
| `docs: prefer Mermaid over ASCII diagrams` | `Prefer Mermaid diagrams over ASCII art` |
| `chore: update .gitignore for env files` | `Update gitignore` |
| `feat(skills): claim linear tickets (WAY-123)` | `feat: claim tickets` (ticket missing when one was in play) |

## Type (not file extension)

Hosts often default Markdown to `docs`. **Do not.** Type follows **behavior change**:

| Paths / change | Type |
|----------------|------|
| `skills/`, `SOPs/`, `models/`, `AGENTS.md` routing, MCP profiles | `feat` / `fix` (scope `skills`, `sops`, `mcp`, …) |
| App or CLI product behavior | `feat` / `fix` |
| Human-only narrative (`docs/`, README, marketing) with no agent or product behavior change | `docs` |
| Eval or test-only | `test` (keep `feat` when the same change ships a new capability) |
| Tooling, lockfiles, ignore rules | `chore` / `ci` / `build` |

A `.md` skill or SOP is still agent behavior. `docs` is for humans reading a guide, not for changing what the agent does.

## Rules

1. **Output** a conventional subject at the end of ticket work. Do not `git commit` unless the user asks. Stay on **main**.
2. Include the Linear identifier in the subject suffix and body when a ticket was in play ([linear-ticket-workflow.md](./linear-ticket-workflow.md)).
3. If the user later opens a PR, that title uses the same format.
4. Prefer one clear type from the table above. Never pick `docs` only because the path ends in `.md`.
5. Do not use merge-commit style subjects (`Merge pull request #…`).

## Git hook

Every app repo should run a **commit-msg** hook that rejects a non-conventional subject:

- Husky: `.husky/commit-msg` (Waykit, ArchLens, steerco, react-cloudflare-template)
- pre-commit: `stages: [commit-msg]` (gpio-build-monitor)
- `.githooks/commit-msg` copied into `.git/hooks` on bootstrap (edge-dns, mzworthington)

The hook is the POSIX checker in [templates/git/commit-msg](../templates/git/commit-msg) (same rules as `wk commit-msg`). `wk init --hook` installs both `pre-commit` and `commit-msg`.

Check a title without committing:

```bash
wk commit-msg --message "feat(cli): add commit-msg hook"
```
