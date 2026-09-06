# PostHog findings

Phase handover for **product-signal-intake**. Fill in Session A (`wk mcp posthog`). File in Session B (`wk mcp default`) only after a human gate. Never create Linear issues from this table while PostHog is the only profile.

| Field | Value |
|-------|-------|
| **Project** | `<project-name>` |
| **Date** | YYYY-MM-DD |
| **Evidence window** | dates only — no `phc_` keys, no project API secrets |
| **Status** | intake \| gated \| filed \| blocked |

## Rows

| Signal | Evidence window (no project keys) | Kind (bug / contract / bet / skip) | Size (sitting / epic) | Proposed next agent | Operator (file / skip) |
|--------|-----------------------------------|------------------------------------|-----------------------|---------------------|------------------------|
| | | | | | |

Proposed next agent: `agent-debug`, `agent-user-stories`, `agent-prd`, or skip.

## Query coverage

Mark done or n/a (reason). No event payloads that include secrets.

| Query | Done |
|-------|------|
| Errors / error clusters | |
| Empty or dropping events | |
| Funnel drop-offs | |
| Flag exposure vs leading indicator | |
| Timeboxed bets due | |

## Session notes

- Session A profile: `wk mcp posthog`
- Restore: `wk mcp default` before Session B
- Linear create: only after the Operator column is `file`
- Missing PostHog tools: classify live-bundle empty-events only; mark other queries blocked; no invented dashboard counts
- Missing Linear tools after restore: draft in this handover; do not invent issue URLs
