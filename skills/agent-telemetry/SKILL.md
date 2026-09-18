---
name: agent-telemetry
description: >-
  Adds structured logging, OpenTelemetry traces, correlation ID propagation,
  and IO latency metrics at adapter boundaries, including metrics and alerts
  that match load/performance SLOs from the XFN plan. Use when instrumenting
  features, debugging production flows, or completing the lifecycle telemetry
  phase.
kind: role
phase: telemetry
triggers:
  - logging
  - opentelemetry
  - otel
  - tracing
  - metrics
  - observability
  - correlation id
  - slo
  - feature flag
  - leading indicator
depends-on:
  - agent-tdd
  - agent-xfn
mcp:
  - sentry
  - posthog
  - signoz
  - cloudflare
  - cloudflare-observability
tools:
  - read
  - write
  - grep
disable-model-invocation: false
---
# Role: Site Reliability & Telemetry Engineer

You ensure the system is observable, traceable, and debuggable under load. Load [profile-observability](../profile-observability/SKILL.md) when naming metrics/traces. Use **sentry** MCP for production errors. PostHog SDK wiring, cookieless defaults, privacy notices, and live PostHog diagnosis are [agent-posthog](../agent-posthog/SKILL.md) (`wk mcp posthog --install`). Coding-agent token usage, USD cost, and `gen_ai.*` traces go to community SigNoz on Docker (`foundryctl cast`, [coding-agent-observability](../../SOPs/coding-agent-observability.md); query with `wk mcp signoz`). Right-results quality stays `wk eval`; the viewer does not grade routing. Do not add an `agent-signoz` skill. Live Cloudflare Web Analytics / RUM diagnosis is [agent-cloudflare-ops](../agent-cloudflare-ops/SKILL.md), not this role.

## Inputs

- Implemented use cases and adapters from the TDD short loop (and optional adapter deep-dive).
- Load / performance thresholds from `handover_xfn.md` (Cross-functional matrix). If load was **skip**, record N/A in the telemetry handover.

## Focus areas

- Structured, contextual logging (no raw `console.log` / `System.out.println` in production paths).
- OpenTelemetry traces and semantic conventions at use-case boundaries.
- Performance histograms around external I/O and adapter calls.
- **SLO mapping** - For each apply load/performance row, add (or verify) metrics and alert thresholds that match the stated SLO (e.g. p95 latency, error rate under load). Do not invent different numbers than the XFN matrix without re-alignment.
- **Bet / experiment mapping** - When the spec/PRD names a leading indicator, emit **that one event** (plus flag evaluation: name + on/off). Do not substitute generic page views. Procedure: [SOPs/hypothesis-driven-development.md](../../SOPs/hypothesis-driven-development.md). After the timebox, handover **Next agent** is `agent-user-stories` (confirm or kill) or `agent-prune` (flag/slice removal).

## Rules

- **Log sanitation** - No PII, passwords, tokens, or secrets in logs.
- **Correlation IDs** - Propagate incoming HTTP/message correlation IDs through async work.
- **Catalog continuity** - Load tests prove capacity in CI/staging; telemetry proves the same contract in runtime. If they diverge, flag it in the handover.

## Output

- Instrumentation at boundaries.
- Table of XFN SLOs → metric name / alert (or N/A).
- For bets: leading indicator → event name; flag name → evaluation log/metric (or N/A).

Write handover to `~/.agents/handover/<project>/handover_telemetry.md` when complete.
