---
title: Eval-Driven Development (EDD) — alpha
kind: sop
triggers:
  - edd
  - eval driven development
  - agent eval
  - llm as judge
  - eval watch
  - eval ci
  - routing accuracy
tools:
  - shell
  - read
  - write
---
# Standard Operating Procedure: Eval-Driven Development (EDD)

**Alpha.** Companion: [docs/edd.md](../docs/edd.md), [evals/edd/README.md](../evals/edd/README.md). When changing agent prompts, MCP tool schemas, or routing behavior, use this harness instead of ad-hoc playground checks. A green scripted run is not proof the live host model is correct.

## Loop (red → green → refactor)

1. **Red  -  Define intent:** Add a JSONL case (`id`, `prompt`, optional `history` / `tags` / `expect`) and point a YAML suite at it with metrics (`tool_selection`, `schema_match`, `argument_correctness`, `task_completion`, `criteria_judge`, `mcp_use`, `plan_adherence`, `step_efficiency`, `plugin`, `llm_as_judge`, `self_correction`, `terminal_fallback`).
2. **Green  -  Implement interface:** Register the tool contract (MCP JSON under `evals/edd/tools/` or suite `mcp_tools`) and system prompt. Run `wk eval run --suite … --style local` (or `--style http` / `--style cli`).
3. **Refactor  -  Refine context:** Iterate tool `description` / parameter hints / system prompt until routing and schema assertions pass without hallucinated parameters.

## CLI

| Command | Purpose |
|---------|---------|
| `wk eval run --suite <path> --model <name>` | Execute one suite |
| `wk eval watch --suite <path> --target <file>` | Re-run on prompt / tool schema changes |
| `wk eval report --format md\|json --out <dir> [--github-summary]` | Markdown or JSON cost/latency/failure report; optional Actions job summary |
| `wk eval ci --threshold-routing 95 --out out/reports` | Headless gate; fail if routing accuracy &lt; threshold |
| `wk eval run --suite evals/edd/goldens/architecture_routing.yaml --style cli --cli cursor-agent --model …` | Live golden (not CI) |
| `wk eval dataset lint\|dedupe\|synthesize\|from-trace` | Dataset hygiene (schema lint, dedupe, paraphrases, prod promote) |

## IDEs vs live keys

Cursor, Claude Code, Copilot, and Antigravity load Kit via host pointers and MCP files ([docs/hosts.md](../docs/hosts.md)). Run evals with `--style local`; no provider key. `--style http` POSTs to an OpenAI-compatible `/chat/completions`. `--style cli` shells out to one assistant binary for agent and judge. Key order, nightly vs PR: [docs/edd.md](../docs/edd.md#cursor-claude-copilot-antigravity-and-api-keys).

## CI

- **Local gate:** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) **Verify** runs `wk check` / `wk eval ci` with `--style local`. Cases tagged `requires-live` are skipped so paraphrases do not fail CI. `wk check` covers architecture routing, model routing, kit-knowledge, Cloudflare ops, safety, self-correction, and terminal-fallback suites.
- **Live weekly:** [`.github/workflows/edd-live.yml`](../.github/workflows/edd-live.yml) runs Sundays 03:00 UTC when `CURSOR_API_KEY` is set. It installs Cursor CLI and runs `--style cli --cli cursor-agent`. Optional repo variable `KIT_EVAL_MODEL` (default `cursor-grok-4.6-medium`). Missing `CURSOR_API_KEY` skips the job.
- **Threshold gating:** `--threshold-routing 95` blocks merges when routing/schema extraction fails more than 5% of routing-tagged cases.
- **Artifacts:** Reports upload with `if: always()` (`out/reports/eval-report.md`, `edd-report.md` / `.json`).
- **Job summaries:** CI workflows publish an overview table plus the full Markdown report to `$GITHUB_STEP_SUMMARY` (via `wk eval report --github-summary`, or automatically when `GITHUB_ACTIONS=true`). Open the workflow run → Summary to read pass rate, routing/schema, and failure traces without downloading artifacts. Unit tests use `pnpm test:ci`, which also writes `out/reports/unit-test-report.md` into that Summary.

## Reports

`wk eval report` emits overall pass rate, token/latency cost, routing + schema adherence, and **failure traces** (expected vs actual tool/args, diagnosis, suggested fix). Example: [evals/edd/examples/eval-report.md](../evals/edd/examples/eval-report.md).

Under GitHub Actions, the same Markdown is folded into the job summary so green/red checks carry meaning (what gated, which suites, metrics).

## Production bridge

Live spans share eval field names (`emitAgentSpan`). Hard failures convert to JSONL via `productionTraceToJsonl` / `wk eval dataset from-trace`. Shadow sample + judge: `wk eval shadow --infile … --sample 0.05`. See [SOPs/edd-production-telemetry.md](./edd-production-telemetry.md).

## IDE session → EDD (debug / lessons)

When a miss appears in the **current** Cursor, Claude, Copilot, or Antigravity thread (wrong tool, bad args, prompt/schema drift), [agent-debug](../skills/agent-debug/SKILL.md) must promote a case from context (no user paste required), then red/green with `wk eval` ([hypothesis-driven-debug.md](./hypothesis-driven-debug.md) §11). Lessons that capture the same friction set **EDD case** + optional **Promote to** `evals/edd/*.jsonl` ([templates/lesson.md](../templates/lesson.md)). Threads you cannot see stay invisible until reopened or exported.
