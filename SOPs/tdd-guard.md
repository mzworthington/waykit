---
title: TDD Guard host hooks
kind: sop
triggers:
  - tdd-guard
  - tdd hook
  - preToolUse
  - red before green
tools:
  - shell
---
# Standard Operating Procedure: TDD Guard hooks

Mechanical red-before-green enforcement for Cursor and Claude Code, adapted from [TDD Guard](https://github.com/nizos/tdd-guard). Waykit does not vendor that plugin. `wk tdd-guard` is the host adapter. The skill [agent-tdd](../skills/agent-tdd/SKILL.md) still owns the catalog impact map and the micro-loop.

## Install

From the app repo (after `wk` is on PATH):

```bash
wk tdd-guard install
```

Writes:

- `.cursor/hooks.json` plus `.cursor/hooks/waykit-tdd-guard.sh` (`preToolUse`, `beforeShellExecution`, `afterShellExecution`, `sessionStart`, `beforeSubmitPrompt`, `stop`)
- `.claude/settings.json` hooks (`PreToolUse`, `UserPromptSubmit`, `SessionStart`, `Stop`) calling `wk tdd-guard`

Commit those files. Session state stays in `.waykit/tdd-guard/` (gitignored).

Claude Code can also install the upstream plugin for LLM-judged diffs. Use one PreToolUse command per matcher; do not stack `npx tdd-guard` and `wk tdd-guard` on the same Write matcher.

## What the hook allows and denies

| Event | Allow | Deny |
|-------|--------|------|
| Write to a test file | One new catalog case (or zero) | Two or more new `it`/`test` cases in one write |
| Write to production source | Last recorded test run **failed** (green), or last run **passed** and the file already exists (refactor) | No test run yet; **new** production file while tests are green |
| Docs, skills, SOPs, JSON, CSS | Always | — |
| Shell `sed -i` / similar onto source | — | Bypass; use Write or StrReplace |

Test runs are inferred from `afterShellExecution` / `postToolUse` when the command looks like `pnpm test`, `node --test`, `vitest`, `pytest`, `go test`, and so on. Fail the runner on purpose during red so the hook records `fail`.

## Stop reminder

Cursor `stop` and Claude `Stop` fire when the agent loop ends. After a recorded test run, the hook sends **one** follow-up: run [agent-pre-commit](../skills/agent-pre-commit/SKILL.md) (the repo hook, not a path-filtered test) before marking COMPLETE. Grill/docs sessions with no test run get no follow-up. `loop_limit` is 1.

## Session control

## Session control

```bash
wk tdd-guard disable
wk tdd-guard enable
```

`WAYKIT_TDD_GUARD=0` also skips denies. Do not disable to skip red on a product slice.

## Agent behavior

Hooks catch skipped red. They do not replace the impact map, gear 1 vs 2, or XFN. If a deny comes back, write or run the missing failing test, then retry the production edit.
