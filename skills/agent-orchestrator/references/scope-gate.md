# Orchestrator scope gate

Read **before** routing. Pick the smallest valid path ([CODING_PHILOSOPHY.md](../../../CODING_PHILOSOPHY.md) §4). When in doubt, prefer the smaller route and ask.

| Request type | Route |
|--------------|-------|
| Prompt, MCP tool schema, or agent routing change | **EDD default:** [SOPs/eval-driven-development.md](../../../SOPs/eval-driven-development.md) (`kit eval run\|ci`) before merge |
| Bug, failed job, live-site / fetch symptom, flake | Launch **`agent-debug` subagent** (parent keeps hypothesis + handover, not logs) → `agent-pre-commit`. Light XFN when UI/auth/SLO touched. |
| Production incident / page | **`agent-incident`** skill → launch **`agent-debug` subagent** (+ Slack/Notion when configured) |
| Live Cloudflare Web Analytics / RUM / beacon / insights host | **`agent-cloudflare-ops`** (`wk mcp cloudflare-ops --project`, then restore default) → IaC fix in owner repo |
| PostHog SDK, cookieless events, wizard, empty PostHog project | **`agent-posthog`** (`wk mcp posthog --project`, then restore default) → adapter + privacy; not the Cursor wizard |
| PostHog → backlog / pull suggestions into tickets | [product-signal-intake](../../../SOPs/product-signal-intake.md): Session A `agent-posthog` findings, human gate, Session B `agent-user-stories` / `agent-prd`. Do not auto-file. Do not add a product-insights skill. |
| Crime-scene / code quality report / git hotspots | [complexity-hotspots](../../../SOPs/complexity-hotspots.md) §8: Session A readonly **`agent-arch-drift`**, human gate on `handover_crime_scene.md`, Session B `agent-user-stories` (epic + children). Do not auto-file. Do not add a crime-scene skill. Play children with `agent-prune`. |
| Tiny typo / obvious one-liner with clear repro | Stay in the **parent**. Implement directly - no spec handover. Note functional test impact. Always run **light XFN**. |
| Extends existing behavior in one module | Design light → launch **`agent-tdd` subagent** (gear 1+2 same child). XFN apply rows launch **`agent-xfn`**, not TDD. "Until complete" still means that child's red-green micro-loop. |
| Schema migration | `agent-migration` → `agent-pre-commit` (with light XFN / security as needed) |
| OpenAPI / contract change | `agent-api-contract` (+ `agent-tdd` when behavior changes) |
| Dead-code cleanup, post-migration prune | `agent-prune` → `agent-pre-commit` ([SOPs/dead-code.md](../../../SOPs/dead-code.md)) |
| Complexity hotspot cleanup | Launch **readonly `agent-arch-drift` subagent** → `agent-prune` → `agent-pre-commit` |
| PR / diff review request | Launch **readonly `agent-review` subagent** (handover/diff only, not the implementer transcript) |
| Landing / marketing / write-copy / generic CTA, microcopy, errors | `agent-copy` (+ `agent-ui` if layout/chrome) |
| Docs narrative rewrite (README lead, blog, public pages) | `agent-docs` **and** `agent-copy` |
| New feature, new bounded context, new external integration | Full lifecycle: grill/PRD/stories as skills, then **launch** spec/tdd/xfn/audit subagents ([SOPs/subagent-launch.md](../../../SOPs/subagent-launch.md)) |
| Product bet / PRD / experiment / kill criteria | **`agent-prd`** (grill first if unsettled) → `agent-user-stories` → `agent-spec` |
| Timebox elapsed on a flagged bet | Measure the leading indicator in PostHog (`agent-posthog`, `wk mcp posthog --install`) → confirm/kill story (`agent-user-stories`) → `agent-prune` for flag/slice |

**Model class:** After picking the route, resolve class from [models/catalog.yaml](../../../models/catalog.yaml) ([SOPs/model-routing.md](../../../SOPs/model-routing.md)). Pass the Cursor slug from [models/hosts/cursor.yaml](../../../models/hosts/cursor.yaml) to subagents (`wk model resolve --skill <id> [--spec-complete] [--blocked]`). Stay on Grok 4.6 / Composer; do not pick Kimi or other Other-Models ids unless the user asks. Recommend switching the parent chat when the class changes. Escalate to `plan` if BLOCKED or a new architectural fork.
