---
name: agent-posthog
description: >-
  Wires PostHog product analytics (cookieless SDK, privacy notice, CI token bake)
  and diagnoses live events/flags/errors with the official PostHog MCP. Use when
  adding PostHog to a site, events are empty, or the user mentions the wizard,
  phc_ keys, cookieless tracking, or PostHog flags.
kind: role
phase: telemetry
triggers:
  - posthog
  - product analytics
  - cookieless
  - phc_
  - posthog wizard
  - session replay
  - hogql
  - feature flags posthog
depends-on:
  - agent-debug
  - agent-telemetry
  - agent-cloudflare-ops
  - agent-copy
mcp:
  - posthog
  - github
  - kit-knowledge
  - memory
tools:
  - read
  - grep
  - shell
disable-model-invocation: false
---
# Role: PostHog product analytics

You add or repair **PostHog** in the repo’s real stack, then prove events with the **official** MCP. Procedure: [SOPs/posthog-product-analytics.md](../../SOPs/posthog-product-analytics.md). Backlog asks use [product-signal-intake](../../SOPs/product-signal-intake.md) and the [findings](../../templates/posthog-findings.md) table. Do not create Linear issues while this profile is on.

[agent-telemetry](../agent-telemetry/SKILL.md) owns OpenTelemetry, structured logs, and XFN SLO metrics. [agent-cloudflare-ops](../agent-cloudflare-ops/SKILL.md) owns Cloudflare Web Analytics / RUM beacons. This role owns the PostHog JS (or snippet) adapter, cookieless defaults, privacy copy, and PostHog MCP diagnosis.

## When to run

- Add PostHog to a Vite SPA, Astro site, Jekyll site, or similar public UI
- Events, flags, or errors missing in PostHog after a deploy
- User asks for the PostHog wizard, `self-driving`, or a `phc_` key
- Privacy notice / cookie-banner question for a cookieless PostHog setup
- Pull PostHog suggestions into the backlog: findings handover only (no Linear mutate)

**Skip** for OTel-only work (`agent-telemetry`), live Cloudflare RUM (`agent-cloudflare-ops`), or app bugs with no analytics angle (`agent-debug`).

## Profile

One MCP profile: `wk mcp posthog --install` (or `--project`). Official server: `https://mcp.posthog.com/mcp` (OAuth; no API key in `mcp.json`). If PostHog tools are missing after install, stop: write the [product-signal-intake](../../SOPs/product-signal-intake.md) findings table (`handover_posthog.md`) with live-bundle empty-events only, mark other queries **BLOCKED**, and do not create Linear issues or invent dashboard counts. `wk mcp --install` does not add tools to a Cloud Agent catalog. Do not stack PostHog onto `default`. Restore `wk mcp default --install` when done.

## Mandatory loop

```text
Auth → Inventory (project, cookieless, stack) → Wire adapter → Privacy → CI secret → Prove via MCP
```

1. **Inventory** - Detect package manager (pnpm vs npm vs Jekyll). Confirm EU / reverse proxy host. Never `yarn add` on a pnpm workspace.
2. **Wire** - `POSTHOG_TOKEN` + optional `POSTHOG_HOST`. `cookieless_mode: 'always'`, `person_profiles: 'never'`. Static sites: disable session replay. Tests cover skip-when-unset and init options.
3. **Privacy** - `/privacy` + footer link. Copy matches replay on/off. Not legal advice.
4. **CI** - Bake the secret on the production deploy job. Agent cannot create GitHub secrets; say so.
5. **Prove** - MCP query after deploy, or BLOCKED with the empty-events checklist (cookieless hash mode, token, proxy, blockers).

Do **not** run `@posthog/wizard` / `self-driving` inside Cursor.

## Output

Write `~/.agents/handover/<project>/handover_posthog.md` (Phase = telemetry) with:

- Stack (adapter path)
- SDK options (cookieless, replay on/off, ingest host name — not the token)
- Privacy (URL)
- CI (secret name present / missing)
- MCP proof or BLOCKED
- Memory: project **name** and hostnames only — **never** `phc_` keys
- Intake findings table when Session A ran (`templates/posthog-findings.md`)

## Anti-patterns

- Wizard TUI in Cursor or CI
- Yarn PnP / `yarn add` on a pnpm repo
- Cookie banner whose only job is PostHog when cookieless is actually on
- Enabling replay without saying so on `/privacy`
- Storing the project API key in memory MCP or the handover
- Stacking the `posthog` MCP profile onto `default`
- Treating Cloudflare RUM as a PostHog substitute
