# Skills taxonomy

All invocable instructions live here as [Cursor Agent Skills](https://cursor.com/docs/agent/skills) (`<name>/SKILL.md` with YAML frontmatter).

The kit enforces **hexagonal architecture**, **domain-driven design**, **vertical slices**, and **clean code** - see [CODING_PHILOSOPHY.md](../CODING_PHILOSOPHY.md).

We keep **one `skills/` tree** for playbooks. Cursor still discovers skills from that path. Thin **host subagent stubs** are generated into [agents/](../agents/) and installed to the user home (`wk agents install`); they are not a second playbook tree. Taxonomy is expressed via frontmatter (`kind`, `phase`, `triggers`) and naming prefixes.

## Naming convention

| Prefix | `kind` | When to use |
|--------|--------|-------------|
| `agent-*` | `role` | Lifecycle persona for a single phase (spec, TDD, audit, …) |
| `profile-*` | `profile` | Cross-stack domain rules (IaC security, API, observability, …) |
| `lang-*` | `profile` | Language-wide coding rules (TypeScript, Java, C#, Python, Go, C++, Rust, HCL) |
| `framework-*` | `profile` | Framework-specific delivery rules (Next.js, FastAPI, Spring, Terraform, …) |

**Roles vs profiles:** Roles define *who you are* and *what phase output* to produce. Profiles define *how to write code* for a stack. The orchestrator (`agent-orchestrator`) routes between roles; stack detection activates profiles.

**Host subagents:** Do not generate a Cursor/Claude agent for every role. Allowlist: [docs/subagents.md](../docs/subagents.md), machine-readable [subagents.yaml](./subagents.yaml). Isolation (`agent-debug`, `agent-xfn`), readonly audit (`agent-review`, `agent-security`, `agent-arch-drift`), sequential (`agent-spec`, `agent-tdd`). Orchestrator stays the parent. `lang-*` / `framework-*` / `profile-*` stay skills. TDD gear 1 and gear 2 stay one `agent-tdd` session; `agent-adapter` is the escape hatch, not a second TDD agent. Freeze the list if auto-delegation is worse than today’s skill picker (`wk eval miss-rate` after `wk eval dataset from-trace`). Session mode: `wk agents status`. Task prompt: `wk agents launch-prompt`.

## Lifecycle roles (`agent-*`)

| Skill | Phase | Loads when |
|-------|-------|------------|
| [agent-orchestrator](./agent-orchestrator/SKILL.md) | orchestration | Multi-phase feature work, handovers; on-demand `references/scope-gate.md` |
| [agent-grilling](./agent-grilling/SKILL.md) | spec | Design-tree interview primitive, decision frontier, fact/decision separation |
| [agent-grill-me](./agent-grill-me/SKILL.md) | spec | Stateless user-invoked idea stress-testing, active dialogue, ungrillable boundary check |
| [agent-prd](./agent-prd/SKILL.md) | spec | PRD / bet card: belief, leading indicator, kill criteria, experiment, flag plan |
| [agent-spec](./agent-spec/SKILL.md) | spec | Requirements, Gherkin, XFN criteria, ambiguity removal |
| [agent-user-stories](./agent-user-stories/SKILL.md) | spec | Linear INVEST tickets, AC; Mermaid on UI; operator stories skip wireframe; bets get Hypothesis + flag Notes |
| [agent-tdd](./agent-tdd/SKILL.md) | tdd | Short loop: catalog impact, gear-1 domain/handlers, gear-2 thin adapters → hands XFN to `agent-xfn` |
| [agent-xfn](./agent-xfn/SKILL.md) | xfn | XFN matrix (plan then post-wiring green); browser E2E, a11y, security, load |
| [agent-adapter](./agent-adapter/SKILL.md) | impl | **Optional deep-dive** when gear 2 is too large; else prefer `agent-tdd` |
| [agent-ui](./agent-ui/SKILL.md) | impl | Thin UI/delivery adapters; semantic HTML; a11y-first |
| [agent-copy](./agent-copy/SKILL.md) | impl | Product/landing copy, microcopy, human-centric voice; audit vs net-new tracks; on-demand `references/` |
| [agent-migration](./agent-migration/SKILL.md) | maintenance | Expand/contract schema migrations |
| [agent-api-contract](./agent-api-contract/SKILL.md) | spec | OpenAPI/AsyncAPI contract evolution |
| [agent-review](./agent-review/SKILL.md) | audit | PR/diff review vs boundaries + catalog/XFN |
| [agent-docs](./agent-docs/SKILL.md) | release | README/runbook/API narrative; loads `agent-copy` for human-centric voice |
| [agent-release](./agent-release/SKILL.md) | release | Ship checklist, conventional PR title, catalog summary |
| [agent-incident](./agent-incident/SKILL.md) | debug | Production incident coordination → `agent-debug` |
| [agent-security](./agent-security/SKILL.md) | audit | OWASP, validation, secrets; verify XFN security suites |
| [agent-arch-drift](./agent-arch-drift/SKILL.md) | audit | Hexagonal boundaries, SOLID, catalog/XFN completeness, git crime-scene ranking |
| [agent-adr](./agent-adr/SKILL.md) | audit | Sparse MADR ADRs in `docs/ADRs/` (hard to reverse / off-norm only) |
| [agent-prune](./agent-prune/SKILL.md) | maintenance | Dead-code + hotspot reduction; procedure in SOPs |
| [agent-debug](./agent-debug/SKILL.md) | debug | Hypothesis-driven RCA; procedure in SOP; on-demand `references/tooling.md` |
| [agent-telemetry](./agent-telemetry/SKILL.md) | telemetry | Logging, tracing, metrics; XFN SLO mapping |
| [agent-cloudflare-ops](./agent-cloudflare-ops/SKILL.md) | telemetry | Live Web Analytics / RUM / beacon diagnosis via Cloudflare MCP |
| [agent-posthog](./agent-posthog/SKILL.md) | telemetry | Cookieless PostHog SDK, privacy notice, official PostHog MCP |
| [agent-perf-opt](./agent-perf-opt/SKILL.md) | maintenance | Profiling memory leaks, CPU bottlenecks, SQL EXPLAIN ANALYZE |
| [agent-pre-commit](./agent-pre-commit/SKILL.md) | quality | Pre-commit hook discovery, run checks, fix failures |

Related SOPs: [behavior catalog & XFN](../SOPs/behavior-catalog-and-xfn.md), [complexity hotspots](../SOPs/complexity-hotspots.md), [dead code](../SOPs/dead-code.md), [hypothesis-driven development](../SOPs/hypothesis-driven-development.md), [hypothesis-driven debug](../SOPs/hypothesis-driven-debug.md), [conventional commits](../SOPs/conventional-commits.md), [Linear ticket execution](../SOPs/linear-ticket-workflow.md), [API contracts](../SOPs/api-contracts.md), [release](../SOPs/release.md), [db migration](../SOPs/db-migration.md), [Cloudflare analytics ops](../SOPs/cloudflare-analytics-ops.md), [PostHog product analytics](../SOPs/posthog-product-analytics.md), [product signal intake](../SOPs/product-signal-intake.md), [model routing](../SOPs/model-routing.md), [subagent launch](../SOPs/subagent-launch.md).

### TDD short loop (important)

`agent-tdd` owns **gear 1** (domain + mocked ports) and **gear 2** (thin adapter + integration test) in the **same session**. Do not insert a handover between inventing a port and wiring its first adapter. `agent-adapter` is an escape hatch for large integrations only. XFN remains the intentional slow outer loop. Production comments that restate names are out of scope; tests carry intent.

## Stack profiles

| Language / domain | Frameworks |
|-------------------|------------|
| [profile-iac](./profile-iac/SKILL.md) (secure IaC, CAF, least privilege) | [framework-terraform](./framework-terraform/SKILL.md), [framework-pulumi](./framework-pulumi/SKILL.md) |
| [profile-pipeline](./profile-pipeline/SKILL.md) (CI/CD, GitHub Actions, promote-up) | (cross-stack delivery; IaC apply still follows profile-iac) |
| [profile-api](./profile-api/SKILL.md) | (cross-stack HTTP/event APIs) |
| [profile-mcp](./profile-mcp/SKILL.md) | (MCP tools, stdio/SSE transports, LLM JSON schemas) |
| [profile-observability](./profile-observability/SKILL.md) | feeds [agent-telemetry](./agent-telemetry/SKILL.md) |
| [lang-hcl](./lang-hcl/SKILL.md) | [framework-terraform](./framework-terraform/SKILL.md) |
| [lang-typescript](./lang-typescript/SKILL.md) | [framework-next](./framework-next/SKILL.md), [framework-react](./framework-react/SKILL.md), [framework-astro](./framework-astro/SKILL.md), [framework-express](./framework-express/SKILL.md), [framework-nuxt](./framework-nuxt/SKILL.md), [framework-pulumi](./framework-pulumi/SKILL.md) |
| [lang-python](./lang-python/SKILL.md) | [framework-fastapi](./framework-fastapi/SKILL.md) |
| [lang-rust](./lang-rust/SKILL.md) | - |
| [lang-go](./lang-go/SKILL.md) | - |
| [lang-cpp](./lang-cpp/SKILL.md) | - |
| [lang-java](./lang-java/SKILL.md) | [framework-springboot](./framework-springboot/SKILL.md), [framework-quarkus](./framework-quarkus/SKILL.md) |
| [lang-csharp](./lang-csharp/SKILL.md) | [framework-dotnet](./framework-dotnet/SKILL.md) |

## Frontmatter fields

Every `SKILL.md` includes:

```yaml
---
name: agent-spec              # lowercase identifier (Cursor discovery)
description: ...              # third person; WHAT + WHEN (trigger terms)
kind: role | profile          # taxonomy
phase: spec | tdd | xfn | ... # lifecycle phase (roles only)
triggers: [...]               # keywords for routing
depends-on: [...]             # related skills
mcp: [...]                    # optional catalogued MCP server ids (see mcps/)
tools: []                     # optional CLI/tool hints for the agent
# model-class: plan           # optional overlay; kit catalog is source of truth (models/catalog.yaml)
---
```

**Skill length budget:** Role `SKILL.md` bodies must stay under 150 lines (`wk verify` fails otherwise). Put long procedures in [SOPs/](../SOPs/) or a skill-local `references/` folder (see [agent-copy](./agent-copy/SKILL.md), [agent-debug](./agent-debug/SKILL.md), [agent-orchestrator](./agent-orchestrator/SKILL.md), [agent-prune](./agent-prune/SKILL.md)).

**Context budget:** Always-on bootstrap stays thin ([AGENTS.md](../AGENTS.md)); load SOPs/philosophy via file read or **kit-knowledge** MCP. See [SOPs/context-budget.md](../SOPs/context-budget.md). Match installed MCP profile to skill `mcp:` frontmatter - one profile per session.

**Discoverability:** Prefer `disable-model-invocation: false` so specialists can be selected when users `@` them; the orchestrator still owns multi-phase routing.

## Extending

- Add project-specific rules in **your app repo** (`.cursor/skills/` or a local overlay), not here.
- Add new languages/frameworks by copying a profile skill and adjusting frontmatter.
- Keep role skills focused on behavior and output schema; keep stack detail in profiles.
- Prefer **Mermaid** for architecture/flow diagrams in skill docs and outputs. Do not add ASCII/box-drawing **diagrams** ([CODING_PHILOSOPHY.md](../CODING_PHILOSOPHY.md) §8). TTY CLI chrome (banners, prompt frames) is ASCII on purpose.
- Co-locate skill unit evals under `skills/<skill-name>/evals/eval.json` (see [evals/README.md](../evals/README.md) for the hybrid evals model).
- Thin host subagent stubs: [agents/](../agents/) from [subagents.yaml](./subagents.yaml) (`wk agents generate`).
- Shared MCP servers live in [mcps/](../mcps/) (not under `skills/`); see [SOPs/mcp-library.md](../SOPs/mcp-library.md).
- Capture session lessons locally under `lessons/<project>/`; promote approved rules via [tasks/kit-review.md](../tasks/kit-review.md).
- Routing regressions: [tasks/kit-eval-harness.md](../tasks/kit-eval-harness.md).

## Kit vs external

Two ownership models - do not mix them in git.

| Kind | Committed in this repo? | Location | Update path |
|------|-------------------------|----------|-------------|
| **Kit-authored** | Yes | `skills/agent-*`, `skills/profile-*`, `skills/lang-*`, `skills/framework-*` | PRs in this repo |
| **Upstream / official** | No (lockfile only) | `~/.cursor/skills` via `gh skill` | [external.lock.json](./external.lock.json) + sync script |

**When to prefer kit profile vs upstream skill:** Use kit `lang-*` / `framework-*` for hexagonal/DDD/vertical-slice rules. Use upstream skills (Cloudflare, Vercel React, Stripe, …) for vendor-specific APIs and platform idioms. If both apply, kit architecture wins on structure; upstream wins on vendor API details - do not duplicate long vendor guides into kit skills.

**Why:** Upstream skills are large, change often, and carry their own licenses. Vendoring them into `skills/` bloats the repo, blocks clean upgrades, and blurs ownership with lifecycle roles.

`.gitignore` blocks accidental commits of non-kit directories under `skills/`. Validate locally:

```bash
pnpm kit verify
```

### Install upstream skills

Declare in [external.lock.json](./external.lock.json); install to Cursor **user** scope:

```bash
kit sync --install   # → ~/.cursor/skills
kit sync --update    # lockfile ids in ~/.cursor/skills only (not --all agents)
```

Or during bootstrap: `INSTALL_EXTERNAL_SKILLS=1 ./install.sh`

Defaults include Cloudflare platform skills (`cloudflare/skills`) and Vercel `react-best-practices` (`vercel-labs/agent-skills`). Full procedure: [SOPs/external-skills.md](../SOPs/external-skills.md).

### If upstream skills landed in `skills/`

`gh skill` or Cursor sometimes writes into the kit tree when `~/.agents` is symlinked here. Remove them from `skills/` (they are gitignored) and reinstall:

```bash
rm -rf skills/cloudflare skills/wrangler   # example - only non-kit dirs
kit sync --install
kit verify
```

Do **not** add upstream skills to git. To pin a new upstream skill, append to the lockfile and re-run `--install`.
