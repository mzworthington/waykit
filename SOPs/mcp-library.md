---
title: MCP library - add, compose, and install
kind: sop
triggers:
  - MCP
  - mcp.json
  - model context protocol
  - compose-mcp
tools:
  - shell
---
# Standard Operating Procedure: MCP library

Use this when adding a server to the kit catalog, composing a host config, or wiring MCPs into a project.

## 1. Decide scope

| Need | Put it in |
|------|-----------|
| Useful across most projects | `mcps/profiles/default.json` (+ global install) |
| Kit SOP / philosophy / handover chunks | `wk -knowledge` on `default` (already) |
| Linear issues / projects | `default` (OAuth; already in that profile) |
| Notion / Slack | `mcps/profiles/collab.json` |
| Chrome / Next / Playwright | `mcps/profiles/devtools.json` or `project-example` |
| Astro docs / GitHub Pages sites | `mcps/profiles/astro.json` |
| Cloudflare / Vercel | `mcps/profiles/cloud.json` |
| Cloudflare RUM / Worker / DNS diagnosis | `mcps/profiles/cloudflare-ops.json` |
| Sentry / Slack ops | `mcps/profiles/ops.json` |
| Semgrep security scans | `mcps/profiles/security.json` |
| Figma design context | `mcps/profiles/design.json` |
| Stripe payments | `mcps/profiles/payments.json` |
| Bitwarden / LinkedIn / Polyglot / Obsidian | `mcps/profiles/personal.json` (**machine-local only**) |
| Raspberry Pi / home lab SSH | `mcps/profiles/lab.json` (**machine-local only**) |
| Warp Factory tasks / factory onboard | `mcps/profiles/warp.json` |
| PostHog analytics / flags / errors | `mcps/profiles/posthog.json` |
| SonarQube Cloud issues / quality gates | `mcps/profiles/sonar.json` |
| App-specific DB + frontend stack | `project-example` or `wk mcp project-example --project` |
| Personal-only experiment | Local user MCP (`wk mcp default --install`) (do not commit secrets) |

### Profile discipline (token / attention budget)

1. **One profile per session.** Compose a single named profile into `mcp.json`. Do not merge collab + devtools + ops + personal into one global file.
2. **Match skill `mcp:` frontmatter.** If `agent-xfn` lists `playwright`, use `devtools` or a project profile that includes it - do not enable every catalog server “just in case.”
3. **Skills ≠ MCP.** Role behavior stays in `skills/`. MCP is for live systems, vendor docs, memory, and kit chunk retrieval (`wk -knowledge`).
4. Prefer a **small** enabled set. Extra MCP tools compete for attention and inflate tool-schema tokens. Never commit vault sessions or compose `personal` into shared app repos.

See [SOPs/context-budget.md](./context-budget.md).

## 2. Add a server definition

1. Create `mcps/servers/<id>/server.json` with metadata and a Cursor `mcp` fragment:

```json
{
  "id": "my-server",
  "name": "My Server",
  "summary": "One-line purpose.",
  "homepage": "https://example.com",
  "transport": "stdio",
  "phases": ["impl"],
  "triggers": ["keyword"],
  "requiredEnv": ["MY_API_KEY"],
  "mcp": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "some-mcp-package"],
      "env": {
        "MY_API_KEY": "${env:MY_API_KEY}"
      }
    }
  }
}
```

2. Add `mcps/servers/<id>/README.md` covering auth, when to use, and risks.
3. Register the server in `mcps/catalog.json`.
4. Add the id to the right profile under `mcps/profiles/` (or create a new profile).

**Rules**

- Never commit real tokens; only `${env:NAME}` / OAuth placeholders.
- `mcp` object keys become Cursor `mcpServers` keys - keep them stable and unique.
- Prefer official or well-known packages; note the homepage for audit.
- First-party TypeScript stdio servers must `--import` the kit’s `node_modules/tsx/dist/esm/index.mjs`. Bare `tsx/esm` resolves from Cursor’s workspace cwd (the consumer app), not `~/.agents`, so tool discovery fails.

## 3. Compose and install

```bash
# Preview
wk mcp default

# Global Cursor config (backup written if file exists)
wk mcp default --install

# Collab extras (Notion OAuth, Slack env tokens; Linear is already on default)
wk mcp collab --install

# Ops / incident (Sentry OAuth + Slack)
wk mcp ops --install

# Security audit (Semgrep)
wk mcp security -o .cursor/mcp.security.json

# Design / payments (opt-in; tokens or OAuth)
wk mcp design -o .cursor/mcp.design.json
wk mcp payments -o .cursor/mcp.payments.json

# Personal / sensitive (Bitwarden, LinkedIn, Polyglot, Obsidian) - machine only
wk mcp personal --install

# Home lab (Raspberry Pi over SSH) - machine only
wk mcp lab --install

# Warp Factory (OAuth; send/continue factory tasks)
wk mcp warp --install

# PostHog (OAuth; analytics, flags, errors)
wk mcp posthog --install

# SonarQube Cloud (user token + org in env)
wk mcp sonar --install

# Project config
wk mcp project-example --project
wk mcp cloudflare-ops --project          # RUM / Worker diagnosis for this session
wk mcp restore --project                 # previous profile, or kit default
wk mcp cloudflare-ops --install          # RUM / Worker diagnosis (user-scope)
wk mcp default --install --host claude   # user-scope Claude Code only
```

The installer (`curl | sh` in [Getting started](../docs/start.md), or `./install.sh` from a checkout) runs the **default** profile install for every supported host. Opt into `collab`, `ops`, `security`, `personal`, `devtools`, `cloud`, `cloudflare-ops`, `warp`, `posthog`, and `sonar` explicitly.

## 4. Verify in the host

1. Restart Cursor, Claude Code, VS Code / Copilot, or Antigravity so MCP reloads.
2. Confirm the server shows a healthy status in that host’s MCP UI.
3. Ask the agent to use a tool from that server on a real task.
4. If auth fails, confirm the env var is set in the environment that launches **that** host.

Host paths: [docs/hosts.md](../docs/hosts.md).

## 5. Project handshake

For app repos, keep kit standards via `AGENTS.md` and optionally commit composed project MCP files (no secrets) using `wk mcp <profile> --project`. After a named session profile (`cloudflare-ops`, `posthog`, …), `wk mcp restore --project` recomposes the previous name (kit `default` if none). The stamp `.wk-mcp-profile.stamp` is gitignored and holds profile names only. Starting fragment: [templates/project-mcp.json](../templates/project-mcp.json).
