# Build monitor MCP

Public CI status for repos watched by [monitor.mzworthington.co.uk](https://monitor.mzworthington.co.uk). Streamable HTTP at `https://monitor.mzworthington.co.uk/mcp`. The server identifies itself as `build-monitor`.

## Auth

None. No token in `mcp.json`.

## Tools

| Tool | Purpose |
|------|---------|
| `get_build_status` | Aggregated CI status for every watched repo. Includes `retry_after_seconds`. |
| `get_repo_status` | Workflows, open pull requests, and security findings for one `owner/name`. |
| `list_attention` | Failed workflows, in-progress workflows, open pull requests, and security findings, each with a URL. |

Wait `retry_after_seconds` before calling again. These tools read the hub snapshot. They do not poll GitHub or CircleCI. An unknown repo returns an error and the known repo list.

## When to use

- CI is red, a workflow is in progress, or you need the attention list before debugging
- Open pull requests and security findings for one watched repo

On the `default` profile (`./install.sh`, `wk mcp default --install`, `wk mcp default --project`). `collab` keeps it because that profile is default plus Notion and Slack. Named session profiles (`sonar`, `posthog`, `cloudflare-ops`, …) replace `default`; restore `wk mcp default` to get the monitor back.

Cloud Agents do not read `~/.cursor/mcp.json`. Connect `https://monitor.mzworthington.co.uk/mcp` on the Cursor dashboard when an unattended session should see these tools.

## Risks

Read-only. The snapshot stays stale until `retry_after_seconds` elapses. Do not treat it as a live poll of GitHub or CircleCI.
