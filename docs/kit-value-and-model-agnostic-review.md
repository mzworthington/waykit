# Kit review: value and model-agnosticism

**Status:** refreshed 2026-09-01 (supersedes the Aug 30 draft on PR #22).  
**Open actions:** [kit-review-backlog.md](./kit-review-backlog.md)

**Verdict:** Still **valuable** for teams that want hexagonal + DDD + TDD/XFN discipline on Cursor, Claude Code, Copilot, or Antigravity. **Not** a full EDD product: the harness is alpha (scripted merge gate, OpenAI-compatible live path). Host MCP/model/rules writers now cover those four; Windsurf is rules-only forever. Public copy should name EDD as alpha.

---

## What this kit is

Waykit is a **governance + procedure pack** for coding agents, plus a TypeScript CLI (`wk`) for bootstrap, MCP compose, security scan, and eval harnesses. Core ideas:

1. Thin always-on bootstrap (`AGENTS.md`) with on-demand skills/SOPs/philosophy.
2. Lifecycle roles (`agent-*`) and stack profiles (`lang-*` / `framework-*`).
3. Architecture invariants (hexagonal, DDD, vertical slices, clean code) with **applicability / opt-out** ([CODING_PHILOSOPHY.md](../CODING_PHILOSOPHY.md), [docs/ADRs](./ADRs/README.md)).
4. Eval-Driven Development for agent tool routing/schemas (`wk eval`).
5. MCP profile catalog and multi-IDE *pointer* files via `wk export-rules`.

Rough inventory (as of this refresh): ~45 skills, SOPs, dual eval layers (`evals/suites` + `evals/edd`), MCP profiles, install/init, nightly live-model workflow (when keyed).

---

## What still holds (strengths)

1. **Context budget as design:** thin `AGENTS.md`, on-demand loads, one MCP profile, `wk measure-context` / `wk check`.
2. **Lifecycle taxonomy:** phase → skill routing, handovers, tests-as-catalog, orchestrator + specialists.
3. **EDD shape:** YAML metrics + JSONL cases, scripted merge gate, optional live path, shadow/prod→JSONL story ([docs/edd.md](./edd.md)).
4. **Architecture floor:** explicit defaults with documented applicability/opt-out (landed after the Aug 30 draft).
5. **Supply-chain hygiene:** layout verify, lockfile, audit, secrets-out-of-repo MCP fragments.
6. **Portable content layer:** philosophy/SOPs/role prose travel; runtime discovery does not.

---

## What changed since the Aug 30 draft

| Finding (Aug 30) | Status now |
|------------------|------------|
| Architecture invariants feel non-optional | **Improved:** applicability and opt-out + seed ADRs (#36) |
| Closed-loop / live EDD aspirational | **Improved:** deeper EDD suites, shadow path, nightly `edd-live.yml` (still skips without `wk _EVAL_API_KEY`) |
| Default CI is scripted keyword driver | **Still true:** intentional merge gate; docs now say so clearly |
| Skill-trigger evals are theater | **Still true:** `wk /src/edd/run_evals.ts` does not invoke a model or assert `required_patterns` / `required_output_sections` |
| Multi-IDE peer-depth oversold | **Improved:** MCP/model/rules writers for Cursor, Claude, Copilot, Antigravity; Windsurf is rules-only forever |
| Skill length budget slipping | **Improved:** role `SKILL.md` bodies gated at 150 lines. `agent-copy`, `agent-debug`, `agent-prune`, and `agent-orchestrator` thinned via SOPs and skill-local `references/` |
| Thin stack profiles | **Still true:** several `framework-*` / `lang-*` skills ~38–48 lines |
| Process weight | **Still true:** shortcuts exist; default narrative is multi-phase |

---

## Model-agnosticism (focused answer)

| Layer | Agnostic? | Notes |
|-------|-----------|--------|
| Philosophy / SOPs / role prose | **Mostly yes** | Markdown procedures; model-neutral instructions |
| Host discovery & MCP | **No** | Cursor skill format + `.cursor/mcp.json` dominate |
| Multi-IDE export | **Cosmetic** | Pointer files ≠ equal capability |
| Skill routing evals (`run_evals`) | **N/A** | No model in the loop |
| EDD live runner | **Weakly** | OpenAI-compatible `/chat/completions`; Anthropic key only via compatible gateway |
| Default CI proof | **No** | Scripted driver; live is nightly + secret |

**Bottom line:** Model-agnostic at the **documentation** layer; **provider-shaped (OpenAI-compatible) + Cursor-centric** at the runtime layer.

---

## Value judgment (unchanged in substance)

**Worth adopting when:** Shared hexagonal/TDD norms, MCP/tool agents that need a routing harness, thin always-on rules, Cursor / Claude Code / Copilot / Antigravity.

**Weak fit when:** Equal Windsurf depth, out-of-the-box multi-model proof CI, architecture-flexible guidance, or a minimal prompt pack without lifecycle ceremony.

**Net:** High **concept and structure** value; medium–rising **execution** value (EDD and honesty improved); still not “any model / any host, same guarantees.”

---

## Highest-leverage remaining work

Tracked in [kit-review-backlog.md](./kit-review-backlog.md). Top three:

1. Make skill-trigger evals assert `required_patterns` / `required_output_sections` (copy already says they are registration / prompt hygiene, not a live model run).
2. Enforce role skill line budget; cut or deepen thin stack profiles.

---

*Review stance: product/architecture assessment of the kit as shipped on `main`, not a PR diff review. Evidence from `AGENTS.md`, `README.md`, `docs/edd.md`, `wk /src/edd/run_evals.ts`, MCP/install paths, skill line counts, and post–Aug 30 merges (#23–#43).*
