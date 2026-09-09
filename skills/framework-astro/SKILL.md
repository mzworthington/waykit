---
name: framework-astro
description: >-
  Framework profile for Astro content sites: TypeScript, static HTML output,
  islands for interactivity, and GitHub Pages deploys. Use when converting or
  building Astro sites, .astro pages/layouts, content collections, or GitHub
  Pages static hosting.
kind: profile
phase: stack
triggers:
  - astro
  - astro.build
  - islands
  - static site
  - github pages
  - content collection
depends-on:
  - lang-typescript
  - framework-react
mcp:
  - astro-docs
tools:
  - read
  - write
disable-model-invocation: false
---
# Profile: Astro content sites

Astro is the **delivery adapter** for content-driven sites. Domain logic stays in plain TypeScript. Pages and layouts emit HTML at build time. Interactive UI is a leaf island, not the app shell.

Install current docs via `wk mcp astro --install` (Astro Docs MCP). Do not stack that profile on `default`. Prefer `astro add` for official integrations. Verify APIs with Astro Docs MCP before copying training-data snippets.

## Architecture

- **Pages and layouts** (`src/pages`, `src/layouts`) own routing, document head, and composition.
- **Do not put React views in `src/pages/`** — Astro treats that folder as file routes. Keep React in `src/components/` or `src/views/`.
- **Static by default.** `output: 'static'` (or omit SSR adapters). GitHub Pages cannot run an Astro server adapter.
- **Islands:** `client:load` / `client:visible` / `client:idle` only on interactive leaves (menus, widgets, diagrams). Never wrap the whole site in one island to preserve a SPA router. Client islands must not import a markdown glob; page bodies are server props.
- **Markdown is source.** Glob or content collections from repo Markdown. Do not hand-author parallel HTML copies of the same page.
- **TypeScript:** follow [lang-typescript](../lang-typescript/SKILL.md). Prefer `astro check` when the toolchain is TypeScript 6.x. This kit uses TypeScript 7, which does not yet expose the programmatic API `astro check` needs — use `astro sync && tsc --noEmit` until that lands.

## UX when replacing a SPA

Keep visual chrome, copy, and widget behavior. Navigation becomes real documents (MPA). Optional `ClientRouter` view transitions may soften full reloads; do not reintroduce `wouter` / `react-router` as the source of URLs.

Replace client `Link` routers with `<a href>`. Pass `pathname` into islands; do not read the SPA location as the route of record.

## SEO

Set title, description, canonical, robots, Open Graph, Twitter, and JSON-LD **in the layout at build time** from a pure SEO module. Do not rely on `useEffect` document-head patches for crawlers.

## GitHub Pages

See [github-pages.md](github-pages.md) for `site`, trailing slashes, `404.html`, `.nojekyll`, CNAME, and Actions.

## This kit's public site (`web/`)

waykit.dev is the reference implementation:

- Astro file routes in `web/src/pages`; React views in `web/src/views` or `web/src/components` (never under `pages/`).
- Markdown catalog (`web/src/docs/pages.ts`) is **server-only**. Do not import it from islands. Pass page bodies, `docPaths`, and nav `{ path, title }` as props from `.astro` pages.
- Chrome lives in `SiteChrome.astro`. `client:load` on `SiteNav`, landing widgets, mermaid, and the ontology map (`client:visible` is skipped after Astro view-transition swaps; mermaid’s SSR stub is empty so `client:visible` often never intersects). Never wrap a whole page as one island.
- After `astro build`, `wk site assemble` overlays raw Markdown and writes `CNAME` / `.nojekyll`. The Astro `wk Pages` hook writes `sitemap.xml` only. GitHub Actions still runs `pnpm --dir web build` then assemble.

## Testing

- **Unit:** Vitest on domain TS and React islands (jsdom).
- **XFN:** Playwright against the static preview (`astro preview` or assembled `site/`); axe on touched pages.

## Additional resources

- Astro Docs MCP: `https://mcp.docs.astro.build/mcp` ([build with AI](https://docs.astro.build/en/guides/build-with-ai/))
- Pages specifics: [github-pages.md](github-pages.md)
