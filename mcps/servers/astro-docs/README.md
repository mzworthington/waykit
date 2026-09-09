# Astro Docs MCP

Remote [Astro Docs](https://docs.astro.build/en/guides/build-with-ai/) MCP. Agents query current Astro APIs, islands, adapters, and deploy guides instead of stale training data.

## Auth

None. Streamable HTTP at `https://mcp.docs.astro.build/mcp`.

If a host cannot use remote HTTP MCP, bridge with:

```json
{
  "command": "npx",
  "args": ["-y", "mcp-remote", "https://mcp.docs.astro.build/mcp"]
}
```

## When to use

- Authoring or converting `.astro` pages, layouts, or integrations
- GitHub Pages / static-output questions
- Checking whether a feature is still experimental

Install with `wk mcp astro --install` for an Astro session. Do not add this server to the everyday `default` profile.

## Risks

The server is documentation retrieval only. Review generated Astro config and adapters; do not assume SSR on GitHub Pages.
