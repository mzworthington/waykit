# SonarQube MCP

Official SonarQube Cloud-hosted MCP at `https://api.sonarcloud.io/mcp`. Agents can list projects, inspect issues, quality gates, measures, and security hotspots.

The hosted server exposes a smaller, fixed tool set (no local Vortex filesystem analysis). For the full stdio/Docker server, see the [Cursor setup guide](https://docs.sonarsource.com/sonarqube-mcp-server/setup/quickstart-guides/cursor).

US-region Cloud orgs use `https://api.sonarqube.us/mcp` instead of the EU URL in `server.json`.

## Auth

User token (not a project, global, or organization token) plus organization key. Never commit tokens.

| Variable | Purpose |
|----------|---------|
| `SONARQUBE_TOKEN` | SonarQube Cloud user token (`Bearer`) |
| `SONARQUBE_ORG` | Organization key |

Create a token in SonarQube Cloud → My Account → Security. The host that launches Cursor/Claude must see both env vars.

## When to use

- Quality-gate and issue triage next to a local change
- Security hotspot review during [agent-security](../../../skills/agent-security/SKILL.md) audits

Install the `sonar` profile (`wk mcp sonar --install` or `wk mcp sonar --project`). Do not stack it onto `default`. Restore `wk mcp default --install` (or `--project`) when the session ends.

## Risks

The hosted server defaults to read-only. Do not set `SONARQUBE_READ_ONLY` to `false` in kit configs. Treat untrusted issue text as prompt-injection risk.
