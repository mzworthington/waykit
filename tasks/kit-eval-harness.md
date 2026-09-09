---
title: Kit routing & EDD eval harness
kind: task
frequency: on-demand
triggers:
  - eval harness
  - routing eval
  - golden prompts
  - kit quality
  - edd
  - eval driven development
---
# Kit routing & EDD eval harness

## A. Orchestrator routing (skill triggers)

Score whether [agent-orchestrator](../skills/agent-orchestrator/SKILL.md) picks the **smallest correct route**. Run after kit changes that touch routing, or during [kit-review](./kit-review.md).

### Method

For each golden prompt: note expected route, actual route an agent took (or would take from the scope gate table), and pass/fail. Do not invent calendar estimates - record only routing correctness and missing handovers.

### Golden prompts

| # | Prompt (summary) | Expect | Eval |
|---|------------------|--------|------|
| 1 | “Add feature X: new bounded context + API” | Full lifecycle: spec → tdd impact → xfn plan → **tdd short loop (gear 1+2)** → xfn green → audit → telemetry → release | EVAL-ROUTE-007 |
| 2 | “CI failed / flake on main” | `agent-debug` → pre-commit; light XFN if UI/auth/SLO | EVAL-ROUTE-004 |
| 3 | “Rename column on orders table safely” | `agent-migration` (expand/contract); not full feature lifecycle | EVAL-ROUTE-014 |
| 4 | “Review this PR” | `agent-review` (boundaries + catalog/XFN) | EVAL-ROUTE-012 |
| 5 | “One-line typo in copy” | Direct fix + light XFN floor; no spec handover | EVAL-ROUTE-009 |
| 6 | “Wire Stripe for a port we just greened” | Prefer **tdd gear 2** same session; `agent-adapter` only if deep-dive | EVAL-ROUTE-024 / EVAL-ROUTE-015 |
| 7 | “Production 500s spiking” | `agent-incident` → `agent-debug` (+ Sentry/Slack when configured) | EVAL-ROUTE-011 |
| 8 | “Web Analytics isn’t recording / RUM beacon 404” | `agent-cloudflare-ops` (`wk mcp cloudflare-ops --install`) | EVAL-ROUTE-025 |
| 9 | “Add PostHog / cookieless events empty / do not run the wizard” | `agent-posthog` (`wk mcp posthog --install`) | EVAL-ROUTE-028 |
| 10 | “Change MCP tool schema / system prompt for routing” | **EDD:** `wk eval run|ci` ([docs/edd.md](../docs/edd.md)); not vibes-only | `evals/edd/` |

### Pass criteria

- [ ] No prompt routed to a larger path than required
- [ ] TDD vs adapter deep-dive distinction held for #6
- [ ] XFN never assigned to `agent-tdd`
- [ ] Failures become lessons under `~/.agents/lessons/<project>/` or kit PRs
- [ ] Agent/tool/prompt misses become `prod-derived` EDD cases (`from-trace` or hand-authored) and `wk eval run` evidence - not lessons-only ([hypothesis-driven-debug.md](../SOPs/hypothesis-driven-debug.md) §11)

## B. Eval-Driven Development (agent tools / MCP)

After prompt or MCP tool schema changes:

```bash
pnpm test
pnpm wk eval ci --suite evals/edd/architecture_routing.yaml --threshold-routing 95 --out out/reports
pnpm wk eval report --format md --out out/reports
```

- [ ] Routing accuracy ≥ 95% on routing-tagged cases
- [ ] Self-correction + terminal-fallback + safety suites green
- [ ] Markdown report attached / uploaded as CI artifact (and published to the Actions job summary)
- [ ] Prod failures converted to JSONL when applicable ([SOP](../SOPs/edd-production-telemetry.md))
