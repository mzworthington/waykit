# Memory MCP (typed)

Local stdio knowledge-graph memory compatible with the upstream JSONL format, with **create_entities** gated by the kit ontology allowlist (`GlossaryTerm`, `Slo`, `Preference`, `ProjectFact`).

## Auth / storage

No API keys. Graph path: `${userHome}/.agents/sync/mcp-memory.jsonl` (`sync/` is gitignored).

Launch uses the kit `tsx` ESM loader path (same cwd-independent stdio pattern as kit-knowledge). Cursor’s workspace cwd will not resolve bare `tsx/esm`. The stdio entrypoint compares `realpath` of `argv[1]` to this file so a `~/.agents` symlink still starts the server.

## Tools

Same surface as `@modelcontextprotocol/server-memory` (`create_entities`, `create_relations`, `add_observations`, `delete_*`, `read_graph`, `search_nodes`, `open_nodes`).

- **Writes of new entities** with unknown `entityType` are rejected.
- **Reads** of legacy unknown types still succeed.
- Lint orphans: `wk memory lint`.

## When to use

- Glossary terms, XFN SLOs, preferences, project facts across sessions
- After **spec** / **xfn** handovers (orchestrator DoD)

## When not to use

- Secrets
- Kit-static facts (skills/SOPs) - use **kit-knowledge** / live-derived ontology (`get_entity` / `get_related`)
