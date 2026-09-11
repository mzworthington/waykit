# Agent Bootstrap

This repository **is** Waykit (the `.agents` kit). Consumers symlink `~/.agents` here (`install.sh`). App repos use the thin handshake: [templates/project-AGENTS.md](./templates/project-AGENTS.md).

Do not commit or push unless the user explicitly asks.

**Do not eager-read** philosophy, SOPs, or skills. Use this index, then load only what the task needs (file read or **kit-knowledge** MCP).

## Invariants (always on)

1. **Hexagonal** - dependencies point inward; domain stays pure.
2. **Mermaid** for architecture diagrams in docs. **ASCII/box-drawing** for TTY CLI chrome ([CODING_PHILOSOPHY.md](./CODING_PHILOSOPHY.md) §8).
3. **Commits / tickets** - conventional subjects ([SOPs/conventional-commits.md](./SOPs/conventional-commits.md)); type follows **behavior**. Linear playbook: [SOPs/linear-ticket-workflow.md](./SOPs/linear-ticket-workflow.md) (main, uncommitted unless asked).
4. **Tests are the behavior catalog** - align functional + XFN impact before non-trivial coding. Prefer self-documenting names; do not comment intent. When why is not obvious, encode it in a test.
5. **One MCP profile per session** - prefer skill frontmatter `mcp:` ids; more tools cost tokens ([mcps/README.md](./mcps/README.md)).

## Load on demand

| Need | Load |
|------|------|
| Architecture / clean-code detail | [CODING_PHILOSOPHY.md](./CODING_PHILOSOPHY.md) or kit-knowledge `get_philosophy_section` |
| Feature routing / multi-phase | [agent-orchestrator](./skills/agent-orchestrator/SKILL.md) |
| Phase work | Matching `skills/agent-*` only for that phase |
| Stack rules | Matching `lang-*` / `framework-*` / `profile-*` after detecting the codebase |
| CI/CD / GitHub Actions | [profile-pipeline](./skills/profile-pipeline/SKILL.md) |
| Catalog / XFN matrix | [SOPs/behavior-catalog-and-xfn.md](./SOPs/behavior-catalog-and-xfn.md) during Design |
| Debug / RCA | [agent-debug](./skills/agent-debug/SKILL.md) + [SOPs/hypothesis-driven-debug.md](./SOPs/hypothesis-driven-debug.md) |
| Product bet / PRD / flags | [agent-prd](./skills/agent-prd/SKILL.md) + [SOPs/hypothesis-driven-development.md](./SOPs/hypothesis-driven-development.md) |
| EDD (prompts, MCP tools, routing; **alpha**) | [docs/edd.md](./docs/edd.md) + [SOPs/eval-driven-development.md](./SOPs/eval-driven-development.md) |
| Model class / host slug | [SOPs/model-routing.md](./SOPs/model-routing.md) (`models/catalog.yaml` + `models/hosts/`) |
| Subagent vs skill | [docs/subagents.md](./docs/subagents.md) (`wk agents status`, [SOPs/subagent-launch.md](./SOPs/subagent-launch.md)) |
| SOP / handover search | **kit-knowledge** MCP (`search_kit`, `get_sop`, `get_handover`, `get_entity`, `get_related`) |
| Kit ontology | `ontology/schema.yaml` only (index derived at use time; authoring: `ontology/README.md`) |
| Cross-session facts | **memory** MCP (typed allowlist: glossary/SLO/prefs/project facts, never secrets) |
| Vendor/framework API docs | **context7** MCP |
| Linear issues / projects | **linear** MCP (OAuth; on the `default` profile) |
| Warp Factory tasks | **warp-factory** MCP (`wk mcp warp --install`; OAuth on first use) |
| PostHog product analytics | [agent-posthog](./skills/agent-posthog/SKILL.md) (`wk mcp posthog --install`) |
| PostHog → Linear backlog | [product-signal-intake](./SOPs/product-signal-intake.md) (findings, then stories/PRD after `wk mcp default`) |
| Crime-scene report | [complexity-hotspots](./SOPs/complexity-hotspots.md) §8 (arch-drift → gate → stories) |

## Phase → skill

| Phase | Skill |
|-------|-------|
| Idea stress-test | [agent-grilling](./skills/agent-grilling/SKILL.md) / [agent-grill-me](./skills/agent-grill-me/SKILL.md) |
| PRD / product bet | [agent-prd](./skills/agent-prd/SKILL.md) |
| Spec | [agent-spec](./skills/agent-spec/SKILL.md) |
| Linear backlog / user stories | [agent-user-stories](./skills/agent-user-stories/SKILL.md) |
| TDD short loop | [agent-tdd](./skills/agent-tdd/SKILL.md) ([SOPs/tdd-guard.md](./SOPs/tdd-guard.md)) |
| XFN | [agent-xfn](./skills/agent-xfn/SKILL.md) |
| Adapter deep-dive | [agent-adapter](./skills/agent-adapter/SKILL.md) (only if gear 2 is too large) |
| UI / copy | [agent-ui](./skills/agent-ui/SKILL.md), [agent-copy](./skills/agent-copy/SKILL.md) (human-centric / de-AI voice) |
| Migration / API contract | [agent-migration](./skills/agent-migration/SKILL.md), [agent-api-contract](./skills/agent-api-contract/SKILL.md) |
| Review / docs / release | [agent-review](./skills/agent-review/SKILL.md), [agent-docs](./skills/agent-docs/SKILL.md) (+ [agent-copy](./skills/agent-copy/SKILL.md) for narrative voice), [agent-release](./skills/agent-release/SKILL.md) |
| Incident / security / arch | [agent-incident](./skills/agent-incident/SKILL.md), [agent-security](./skills/agent-security/SKILL.md), [agent-arch-drift](./skills/agent-arch-drift/SKILL.md), [agent-adr](./skills/agent-adr/SKILL.md) |
| Prune / perf / debug / telemetry | [agent-prune](./skills/agent-prune/SKILL.md), [agent-perf-opt](./skills/agent-perf-opt/SKILL.md), [agent-debug](./skills/agent-debug/SKILL.md), [agent-telemetry](./skills/agent-telemetry/SKILL.md), [agent-cloudflare-ops](./skills/agent-cloudflare-ops/SKILL.md), [agent-posthog](./skills/agent-posthog/SKILL.md) |
| Pre-commit | [agent-pre-commit](./skills/agent-pre-commit/SKILL.md) |

Handovers: `~/.agents/handover/<project>/` ([templates/handover.md](./templates/handover.md)). Run pre-commit before marking a phase **COMPLETE** when hooks exist.

Public site: [waykit.dev](https://waykit.dev) (Astro in `web/`, Markdown in `docs/`; DNS in [edge-dns](https://github.com/mzworthington/edge-dns)).

Taxonomy: [skills/README.md](./skills/README.md). MCP catalog: [mcps/README.md](./mcps/README.md). Context budget: [SOPs/context-budget.md](./SOPs/context-budget.md).
