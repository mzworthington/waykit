---
title: Linear ticket execution
kind: sop
triggers:
  - linear ticket
  - in progress
  - assign agent
  - claim ticket
  - ticket number
  - uncommitted
  - main branch
tools:
  - read
---
# Standard Operating Procedure: Linear ticket execution

Use when this session is **playing a Linear issue** (identifier in the prompt, a linked issue, or an agreed ticket). Authoring or reviewing a backlog without executing one issue is [agent-user-stories](../skills/agent-user-stories/SKILL.md) and does **not** bulk-claim.

Align with [CODING_PHILOSOPHY.md](../CODING_PHILOSOPHY.md) §8 (Interaction Mandate). Linear MCP (`save_issue`, `get_issue`, `list_issue_statuses`) lives on the `default` profile.

## Claim (before changing product code)

1. Resolve the identifier (`WAY-123`). Skip if the user only asked to inspect.
2. Skip if the issue is already **Done** or **Canceled**.
3. Search open and merged pull requests for that identifier before any product edit.
   - A merged pull request means stop. Do not open another.
   - An open pull request means continue on that pull request. Do not open a second one.
4. Set `state` to the team's started column (`In Progress`, or `list_issue_statuses` if the name differs).
5. Set `assignee` to the host agent so the board shows who is playing the issue:
   - Cursor → `assignee: "Cursor"`.
   - If that app user is missing, `assignee: "me"`.
6. Do not set `delegate` when this session will implement the issue. `delegate: "Cursor"` starts another cloud agent. A session Linear already started, and the work picker, are already the implementer.
7. Set `delegate: "Cursor"` only to hand the issue to a cloud agent. Then stop. Do not implement in the same session.
8. Do not reassign away from another human unless the user asked to take the ticket.

Do not auto-complete the issue when the diff is ready. Leave it In Progress until the user ships it.

## Git (always)

- Stay on **main** (the repo default branch). Do not create, checkout, or push a feature branch.
- Leave the working tree **uncommitted**. Do not `git commit`, `git push`, or open a PR unless the user explicitly asks.
- When the work is ready, **output** the commit message as a deliverable. The user commits on main.

## Commit message output

Follow [conventional-commits.md](./conventional-commits.md). Include the Linear identifier.

```text
feat(scope): short description (WAY-123)

WAY-123
```

- Subject stays conventional; the ticket token may be uppercase.
- Repeat the identifier in the body (optional `Refs: WAY-123`).
- Type follows **behavior**, not file extension.
- Do not invent an identifier. If there is no ticket, omit it.

## Skills

Every executing `agent-*` role follows this SOP. Grill-only or bulk story-rewrite sessions skip claim unless one issue is the work item.
