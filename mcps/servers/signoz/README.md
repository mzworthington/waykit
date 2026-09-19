# SigNoz MCP

Official SigNoz MCP for querying metrics, logs, traces, and alerts. Use it after hosts export coding-agent **token usage, cost, and `gen_ai.*` traces** over OTLP.

Compose default is `mise exec --cd ~/.agents -- signoz-mcp-server`. Pin: `github:SigNoz/signoz-mcp-server` in kit `mise.toml`. `SIGNOZ_URL` may be a SigNoz Cloud instance (`https://your-instance.signoz.cloud`) or a self-hosted base URL.

## Auth

| Variable | Purpose |
|----------|---------|
| `SIGNOZ_URL` | SigNoz UI / API base (Cloud or self-host). No trailing slash. |
| `SIGNOZ_API_KEY` | Settings → API Keys (Admin). Never commit. |

Install from the kit pin (do not curl a release tarball by hand):

```bash
mise install                  # or: mise run install-tools
```

`mise use github:SigNoz/signoz-mcp-server@0.14.0` only when bumping the pin. The host that launches Cursor / Claude / Copilot must see `mise` and both env vars. Compose does not interpolate them.

## Cloud hosted MCP (no binary)

SigNoz Cloud also serves HTTP MCP:

```text
https://mcp.<region>.signoz.cloud/mcp
```

Headers when the host cannot complete OAuth: `SIGNOZ-API-KEY` and `X-SigNoz-URL`. Use this URL on the **Cursor dashboard** for Cloud Agent sessions. `wk mcp --install` is local only.

Cloud Agent **ingest** is a different URL: `https://ingest.<region>.signoz.cloud:443` with header `signoz-ingestion-key` (dashboard secret / env). Never commit the key. Correlate turns with `cursor.conversation.id` (`bc-...`). Do not point Cloud Agents at localhost.

Do not put the hosted URL in the kit compose default — stdio + env works for Cloud **or** self-host.

## When to use

- Token / USD / `gen_ai.*` dashboards after a host OTLP export
- Trace waterfalls for a Claude Code, Copilot, or Cursor-hook session
- Cursor Cloud Agent traces on SigNoz Cloud (hosted MCP + Cloud ingest)

Procedure: [coding-agent-observability](../../../SOPs/coding-agent-observability.md). Install the `signoz` profile (`wk mcp signoz --install` or `wk mcp signoz --project`). Do not stack it onto `default`. Restore `wk mcp default --install` (or `--project`) when the session ends. Do not add an `agent-signoz` skill. Product analytics stay on the `posthog` profile. `wk eval` stays the quality gate for routing.

## Risks

API keys are admin-scoped. Review write/alert tool calls. Treat untrusted dashboard text as prompt-injection risk. Ingestion keys (OTLP) are not the same as API keys (MCP).
