# SigNoz MCP

Official SigNoz MCP for querying metrics, logs, traces, and alerts. Use it after hosts export coding-agent **token usage, cost, and `gen_ai.*` traces** over OTLP.

Compose default is the **stdio** binary (`signoz-mcp-server` on `PATH`). `SIGNOZ_URL` may be a SigNoz Cloud instance (`https://your-instance.signoz.cloud`) or a self-hosted base URL.

## Auth

| Variable | Purpose |
|----------|---------|
| `SIGNOZ_URL` | SigNoz UI / API base (Cloud or self-host). No trailing slash. |
| `SIGNOZ_API_KEY` | Settings → API Keys (Admin). Never commit. |

Install the binary from [GitHub releases](https://github.com/SigNoz/signoz-mcp-server/releases) (`signoz-mcp-server_<os>_<arch>.tar.gz`) and put `signoz-mcp-server` on `PATH`. `go install github.com/SigNoz/signoz-mcp-server/cmd/server@latest` builds a `server` binary — rename it to `signoz-mcp-server` if you use that path.

The host that launches Cursor / Claude / Copilot must see both env vars. Compose does not interpolate them.

## Cloud hosted MCP (no binary)

SigNoz Cloud also serves HTTP MCP:

```text
https://mcp.<region>.signoz.cloud/mcp
```

Headers when the host cannot complete OAuth: `SIGNOZ-API-KEY` and `X-SigNoz-URL`. Use this URL on the **Cursor dashboard** for Cloud Agent sessions. `wk mcp --install` is local only.

Do not put the hosted URL in the kit compose default — stdio + env works for Cloud **or** self-host.

## When to use

- Token / USD / `gen_ai.*` dashboards after a host OTLP export
- Trace waterfalls for a Claude Code, Copilot, or Cursor-hook session

Procedure: [coding-agent-observability](../../../SOPs/coding-agent-observability.md). Install the `signoz` profile (`wk mcp signoz --install` or `wk mcp signoz --project`). Do not stack it onto `default`. Restore `wk mcp default --install` (or `--project`) when the session ends. Do not add an `agent-signoz` skill. Product analytics stay on the `posthog` profile. `wk eval` stays the quality gate for routing.

## Risks

API keys are admin-scoped. Review write/alert tool calls. Treat untrusted dashboard text as prompt-injection risk. Ingestion keys (OTLP) are not the same as API keys (MCP).
