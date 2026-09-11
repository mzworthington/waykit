---
name: framework-alpine
description: >-
  Framework profile for Alpine.js HTML-first UIs: x-data components, alpine.data
  factories, CSP-friendly @alpinejs/csp, and no domain rules in markup. Use when
  building or converting static or Worker-served pages with Alpine, x-data, x-show,
  x-on, alpine.data, or alpinejs.dev.
kind: profile
phase: stack
triggers:
  - alpine
  - alpine.js
  - alpinejs
  - x-data
  - alpine.data
  - alpinejs.dev
depends-on:
  - profile-api
mcp:
  - context7
tools:
  - read
  - write
disable-model-invocation: false
---
# Profile: Alpine.js HTML-first UIs

Alpine is a **delivery adapter**. Snapshot aggregation, auth, and persistence stay in domain or HTTP adapters. Markup binds to already-shaped JSON. Do not grow a second SPA or a parallel REST client inside `x-data`.

Verify current APIs with **context7** (`/websites/alpinejs_dev` or `/alpinejs/alpine`) before copying training-data snippets. Docs: [alpinejs.dev](https://alpinejs.dev/).

## Architecture

- **HTML owns structure.** Semantic landmarks, one `h1`, native `button`/`a`. Alpine adds behavior (`x-data`, `x-on`, `x-show`, `x-text`, `x-for`).
- **`Alpine.data` before inline blobs.** Register named factories on `alpine:init`. `x-data="monitor"` not a 200-line object in the attribute. CSP-friendly Alpine **requires** this ([CSP build](https://alpinejs.dev/advanced/csp)).
- **One page root, small children.** Page-level `x-data` holds server snapshot + UI chrome (expanded rows). Nested components get their own `Alpine.data` and receive rows as props, not a second fetch.
- **Published snapshot is the plug-in API.** Clients (web, SwiftBar, e-ink) read the same JSON (`GET /status`, first `/ws` message). Do not invent a private Alpine-only endpoint. Contract work goes through [profile-api](../profile-api/SKILL.md).
- **No domain in the view.** Roll-up, last-valid merge, and GitHub mapping stay in tested modules. Alpine calls those functions or renders their output.

## Install

- **Bundled (preferred):** pin `alpinejs` or `@alpinejs/csp`. Call `Alpine.start()` after `Alpine.data` registration. Do not load CDN *and* a bundle.
- **CSP:** default Alpine uses `new Function`. On Cloudflare Pages/Workers with a strict CSP, use [`@alpinejs/csp`](https://alpinejs.dev/advanced/csp). Expressions in markup must be allowlisted names (`toggle`), not `open = ! open`.
- **CDN only for spikes.** Pin a version. Production Worker assets vendor the file so the UI does not depend on jsDelivr at runtime.

## Markup habits

Community Alpine skills (for example [mindrally alpine-js](https://explainx.ai/skills/mindrally/skills/alpine-js)) repeat the same delivery rules. Keep them; drop TALL/Livewire/Ghost and `x-html`.

- **Small `x-data`.** Inline objects are toys. Reusable logic is `Alpine.data()`. Methods hold branching; attributes stay one call (`@click="toggle"`).
- **`x-show` before `x-if`.** Toggle visibility when the node should stay in the tree (menus, status rows). `x-if` only when mount cost or a11y requires the node gone.
- **`x-transition` is chrome.** Pair with `x-show`. Do not use motion as the only state signal.
- **Classes via `:class` / `x-bind:class`.** Bind to existing CSS or Tailwind utilities already in the product. Do not add Laravel Livewire, `@entangle`, or a second design system.
- **Alpine 3 events.** `@click.outside` (not legacy `@click.away`). `@keydown.escape` to close. Move focus with `$refs`, not `querySelector`.
- **Forms.** Native `required` / `:invalid` first. Alpine disables the submit button and maps errors; it does not become the validator for CI or auth.

## UX and a11y

Load [agent-ui](../agent-ui/SKILL.md) for landmarks and copy. Alpine specifics:

- Disclosure controls are real `button`s with `:aria-expanded`.
- `x-for` on a `<template>` wrapping a single root element, with `:key`.
- Prefer `x-cloak` (CSS `[x-cloak]{display:none!important}`) so unbound markup does not flash.

## State

- Server snapshot is source of truth. Last-valid merge belongs next to the snapshot port, not only in `localStorage`.
- Optional `@alpinejs/persist` is UI convenience (expanded folders). It must not be the only cache for CI status.
- `$store` only for truly global chrome (theme). Feature state stays on the page component.

## Testing

- **Unit:** factories and snapshot merge with no DOM (Vitest / pytest as the repo already uses).
- **XFN:** Playwright against the static or Wrangler preview; axe on the Alpine page. Alpine is not an excuse to skip E2E.

## Anti-patterns

| Refuse | Do instead |
|--------|-----------|
| Domain roll-up inside `x-data` | Tested module; Alpine displays fields |
| `x-html` with CI text | `x-text` / text nodes |
| React/Vue “while we're here” | Stay Alpine unless the product already chose another framework |
| Inline `x-data="{ ... }"` on CSP pages | `Alpine.data` + `@alpinejs/csp` |
| `@click.away` | `@click.outside` |
| `@entangle` / Livewire in this stack | Snapshot HTTP + Alpine |
| Fetch GitHub from the browser | Existing hub snapshot |

## Additional resources

- Markup cheat sheet: [markup.md](markup.md)
- Alpine docs: https://alpinejs.dev/
- CSP build: https://alpinejs.dev/advanced/csp
- `Alpine.data`: https://alpinejs.dev/globals/alpine-data
