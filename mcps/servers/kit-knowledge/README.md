# Kit Knowledge MCP

Local stdio server that returns **chunks** from the agent lifecycle kit so agents avoid bulk-reading `CODING_PHILOSOPHY.md`, SOPs, and handovers into every turn.

## Auth / storage

No secrets. Reads from `wk _ROOT` (default `${userHome}/.agents`). Handovers come from `~/.agents/handover/<project>/`.

Requires Node 22+ and `pnpm install` in the kit so `node_modules/tsx` exists. Cursor starts stdio servers with the **consumer repo cwd**, which does not have `tsx`. Launch with `--import` of the kit’s `tsx/dist/esm/index.mjs`, not the bare `tsx/esm` specifier. Compose from the kit symlink so `${userHome}/.agents` resolves.

## Tools

| Tool | Purpose |
|------|---------|
| `list_kit_index` | Names/ids only (philosophy §§, SOP stems, skill names) |
| `search_kit` | Keyword search with short excerpts |
| `get_philosophy_section` | One `CODING_PHILOSOPHY.md` section by id or title |
| `get_sop` | One SOP by stem (truncated if very long) |
| `get_handover` | Latest or named phase handover for a project |
| `get_entity` | One ontology entity by id (`skill:…`, `sop:…`, `philosophy:…`, `doc:…`) |
| `get_related` | Ontology edges from an entity (optional `relation` filter) |

## When to use

- Prefer over `Read` of entire philosophy / SOP trees
- Spec / XFN / orchestrator sessions that need a procedure slice
- Looking up a prior handover without loading the whole handover folder

## When not to use

- Live vendor APIs → **context7**, GitHub, Sentry, etc.
- Cross-session durable facts → **memory** MCP
- Role behavior → load the matching `skills/agent-*` skill (not this server)

## Risks

- Tool schemas still occupy context; keep **kit-knowledge** in the lean `default` profile only - do not also stack unused heavy profiles.
- Path assumes `~/.agents` → kit clone. Set `wk _ROOT` if the kit lives elsewhere.
