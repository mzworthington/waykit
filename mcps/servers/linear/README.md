# Linear MCP

Official Linear remote MCP. Agents can read issues, update status, and create tickets without leaving Cursor.

## Auth

OAuth via Cursor on first use. No API key in `mcp.json`.

If your host cannot use remote HTTP MCP, bridge with:

```json
{
  "command": "npx",
  "args": ["-y", "mcp-remote", "https://mcp.linear.app/mcp"]
}
```

## When to use

- Pulling acceptance criteria from a Linear issue during spec/impl
- Claiming a ticket: `save_issue` with `state: In Progress` and `assignee: "Cursor"`. Do not set `delegate` when this session will implement. `delegate: "Cursor"` starts another cloud agent ([SOPs/linear-ticket-workflow.md](../../../SOPs/linear-ticket-workflow.md))
- Creating follow-up tickets after a bugfix or audit finding
- Checking board status while scoping work

Stay on **main** with an uncommitted tree; output a conventional commit subject that includes the issue id ([SOPs/linear-ticket-workflow.md](../../../SOPs/linear-ticket-workflow.md)).

Included in the `default` profile (`./install.sh` / `wk mcp default --install`). OAuth on first tool use in Cursor. Notion and Slack stay on `collab` so those tool schemas are not always loaded.
