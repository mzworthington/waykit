# What do I use this for today?

Pick the job in front of you. Each card opens the steps and a command you can copy.

Each heading is `id | title`. The [jobs page](/docs/jobs) picker and this file share the same source.

## first-hour | I have never installed Waykit

> Fresh machine. Get `wk` on PATH, bootstrap the repo, then pick debug vs feature.

Get Waykit on PATH, bootstrap the repo, then run the **smallest** loop that matches the job.

1. **Install** with `curl | sh` (git and Node 22+).
2. **Init** `wk init . --mcp default --hook`.
3. **Pick the path**: typo/debug vs product feature ([Jobs for today](/docs/jobs)). Optionally prove routing with the demo eval suite.

```
curl -fsSL https://raw.githubusercontent.com/mzworthington/waykit/main/install.sh | sh
```

- [Start here in 10 minutes](/docs/start)
- [Install commands](/docs/start#install)
- [Jobs for today](/docs/jobs)

## daily | Typo, bug, or failed job

> Do not open grill → spec. Debug plus light XFN is the day-to-day default.

Most sessions are a typo, a failing test, or a red CI job. `agent-debug` owns that (launch it as a host subagent when logs would fill the parent). Open the full feature lifecycle only when RCA needs a new capability.

1. **Reproduce** the symptom (local command, failing job, or live URL).
2. **Board it** with `wk debug-board <project> "<symptom>"`, then follow `agent-debug`.
3. **Light XFN** if you touched UI, auth, or an SLO path. Skip the rest with a reason.

```
wk debug-board <project> "<symptom>"
```

- [Hypothesis-driven debug](/SOPs/hypothesis-driven-debug)
- [Debug skill](https://github.com/mzworthington/waykit/blob/main/skills/agent-debug/SKILL.md)
- [Feature lifecycle](/docs/lifecycle) (only if you need a new capability)

## feature | Starting a product feature

> Need the lifecycle path: grill → PRD if bet → spec → TDD short loop → XFN → ship.

Use this when the job is a **new product capability**, not a typo or a red build. Feature work routes through specialist roles so the catalog and XFN rows stay honest. The orchestrator stays in the parent and launches allowlisted specialists ([host subagents](/docs/subagents)). EDD (alpha) sits in TDD when the change is a prompt or tool schema.

1. **Stress-test the idea** (grilling) until the decision frontier is clear.
2. **Spec** acceptance criteria, then TDD short loop (gear 1 + gear 2). Use EDD (alpha) when the change is a prompt or tool schema.
3. **Green XFN apply rows**, audit, then release with a conventional PR title.

```
Open the orchestrator skill and follow the phase table in AGENTS.md
```

- [Feature lifecycle](/docs/lifecycle)
- [Orchestrator skill](https://github.com/mzworthington/waykit/blob/main/skills/agent-orchestrator/SKILL.md)
- [How EDD fits](/docs/edd)

## context | Always-on context is too fat

> Rules dumps are eating the window. You want a budget you can fail CI on.

Thin bootstrap stays under about 8KB. Philosophy and SOPs load on demand; CI fails if the budget blows.

1. **Measure** with `wk measure-context`.
2. **Compose one MCP profile** so unused tool schemas stay out of the prompt.
3. **Hold the bar** with `wk check` (includes the context budget).

```
wk measure-context && wk check
```

- [Context budget SOP](/SOPs/context-budget)
- [MCP profiles](/SOPs/mcp-library)
- [Operator guide](/docs/kit)

## wrong-tool | Wrong tool or made-up args

> The agent guessed architecture, skipped the MCP tool, or invented parameters.

Capture the miss as a JSONL case, mock the tool, and assert routing until the agent stops guessing.

1. **Write the case** for the prompt that failed (expected tool + args).
2. **Run** `wk eval run --suite evals/edd/demo.yaml --model scripted`
3. **Read the report**, tighten the schema or prompt, re-run until green.

```
wk eval run --suite evals/edd/demo.yaml --model scripted
```

- [See before / after](/evals/edd/examples/before-after)
- [Walk the failing-eval demo](/docs/edd)
- [Demo suite](/evals/edd/demo.yaml)

## ci-gate | Gate a prompt or schema change

> You changed system instructions or a tool contract and need a merge bar.

Treat the prompt and MCP schema like code under test. Fail the PR when routing accuracy drops.

1. **Keep the suite next to the change** (start from `evals/edd/demo.yaml`).
2. **Run** `wk eval ci --suite evals/edd/demo.yaml --threshold-routing 95 --out out/reports`
3. **Attach the markdown report** with `wk eval report --format md --out out/reports`.

```
wk eval ci --suite evals/edd/demo.yaml --threshold-routing 95 --out out/reports
```

- [Before / after](/evals/edd/examples/before-after)
- [Example report](/evals/edd/examples/eval-report)
- [10-minute path](/docs/start)

## kit-graph | I changed a skill or SOP

> You edited the kit tree. Check dangling links, then open the live map.

Skills, host subagent stubs, SOPs, and MCPs are a live graph. You edit the files; `wk ontology check` fails dangling `depends-on`, `mcp:`, and subagent→skill refs; kit-knowledge walks neighbors. You do not maintain a second catalog.

1. **Put the file** where the kit expects it (skill folder, `agents/*.md` stub, SOP, catalog server, or eval YAML).
2. **Check** with `wk ontology check` (`wk check` already runs this gate).
3. **Generate** if you need the public map JSON, then open the map.

```
wk ontology check
```

- [Waykit map](/docs/map)
- [Author the Waykit map](/ontology)
- [Operator guide](/docs/kit)

## repo-hygiene | Owned repos missing README or templates

> You want LICENSE, CONTRIBUTING, and GitHub templates on repos you own, not on every clone.

GitHub is the allowlist. `wk doctor` skips forks and checkouts you cannot admin. Report-only until you pass `--write`.

1. **List sources** with `wk doctor --owned` (`gh` must be logged in).
2. **Match local clones** with `--scan` on your dev directory.
3. **Fill gaps** with `--write` (never overwrites README or LICENSE).

```
wk doctor --owned --scan ~/Documents/dev
```

- [Repo doctor](/docs/doctor)
- [Operator guide](/docs/kit)
- [Conventional commits](/SOPs/conventional-commits)

## consumer-align | App repo drifted from the Waykit handshake

> AGENTS.md got fat, host pointers are missing, or project MCP is a vendor pile instead of kit-knowledge.

Doctor will stay green while the agent bootstrap drifts. `wk align` is the consumer check: handshake, IDE pointers, kit MCP, commit-msg.

1. **Report** with `wk align .` in the app clone (or the [reusable GitHub Action](./align.md#consumer-ci) on a PR).
2. **Fill host pointers** with `--write` (never overwrites `AGENTS.md`).
3. **Compose kit MCP** with `wk mcp default --project`. Use `cloudflare-ops` only for that session, then `wk mcp restore --project`.
4. **Fleet** with `wk align --owned --scan ~/Documents/dev` (kit clones skipped).

```
wk align .
```

- [Consumer align](/docs/align)
- [Hosts](/docs/hosts)
- [Repo doctor](/docs/doctor)
