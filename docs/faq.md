# Common questions

Need a job, not an objection? [Jobs for today](/docs/jobs). First install: [Getting started](/docs/start).

## What is Waykit?

Waykit is the software lifecycle for coding agents: grill, PRD/bet when value is unproven, spec, TDD, quality, audit, release, plus learning loops so the next session is better than the last. Eval-driven development (**alpha**) is one of those loops, when the change is a prompt or a tool contract. Feature path: [lifecycle](/docs/lifecycle). Day-to-day typo or failed job: [Jobs for today](/docs/jobs) (`agent-debug`, not grill → spec). Hosts: [Cursor, Claude Code, Copilot, Antigravity](/docs/hosts).

## How do I install Waykit?

On macOS or Linux, run the installer, then bootstrap the app repo:

```bash
curl -fsSL https://raw.githubusercontent.com/mzworthington/waykit/main/install.sh | sh
wk init . --mcp default --hook
```

You need git and Node 22+. If `wk` is not found, add `~/.local/bin` to `PATH`. Full steps: [Getting started](/docs/start).

## Do I need an API key?

No. Install, `wk check`, and `wk eval` with `--style local` (the default) run offline. Cursor, Claude Code, Copilot, and Antigravity load skills and `AGENTS.md`; they are not the eval runner. A provider key is only for `--style http` over an OpenAI-compatible API. `--style cli` shells out to `cursor-agent`, `claude`, or `agy`. Details: [EDD guide (alpha)](/docs/edd). Host files: [hosts](/docs/hosts).

## How do I check README, license, and GitHub templates on my repos?

Use `wk doctor`. It asks GitHub for **sources you admin** and skips forks:

```bash
wk doctor --owned --scan ~/Documents/dev
wk doctor . --write
```

Report-only by default. `--write` fills missing files and never overwrites README or LICENSE. Handshake and hooks stay on `wk init`. After init, `wk align .` checks the handshake still matches. Guides: [Repo doctor](/docs/doctor), [Consumer align](/docs/align), [Used on our own product repos](/docs/used-in).

## How do I check that an app repo still follows Waykit?

Use `wk align`. It is the consumer counterpart to doctor: handshake size, host pointers, kit-knowledge MCP, and `commit-msg`. `--write` fills missing IDE pointers and never overwrites `AGENTS.md`. `--mcp` composes kit default project MCP when you ask.

```bash
wk align .
wk align . --write --mcp
```

## How do I tab-complete wk commands?

`wk completion install` writes a stub that asks the current `wk` binary on each tab (so CLI upgrades stay in sync). Add `fpath=("$HOME/.zfunc" $fpath)` before `compinit` in `~/.zshrc`, or `source` the bash file. Details: [Getting started](/docs/start#shell-completions).

## Why not dump everything into AGENTS.md?

Agents pay for every byte in the bootstrap. Always-on files (`AGENTS.md` and the project handshake) stay under about 8KB, roughly 2k tokens. Host pointers (`.cursorrules`, `CLAUDE.md`, Copilot instructions, `GEMINI.md`) are copies of the same thin file; a session loads one of them, so `wk measure-context` does not sum every host. Philosophy and SOPs load on demand via kit-knowledge. Compose **one MCP profile** per session (`wk mcp default --install`, or `--host claude` / `copilot` / `antigravity`) so unused tool schemas stay out of the prompt. `wk measure-context` prints the breakdown; `wk check` fails if the budget is exceeded. Operator write-up: [What Waykit gives you](/docs/kit). Host paths: [hosts](/docs/hosts).

## How does host subagent launch work?

Allowlisted specialists (debug, xfn, spec, tdd, review, security, arch-drift) get a thin stub in `~/.cursor/agents` after `wk agents install`. The parent prints a Task prompt with `wk agents launch-prompt` and reads `COMPLETE`/`BLOCKED` from the handover. EDD’s `launch_specialist` tool is only an eval adapter. Copilot and Antigravity have no kit agent directory.

`WK_SUBAGENTS=0` is skills-only **when the shell that starts the host exports it**. Then `wk agents status` must show `mode: skills-only`. Cursor Chat does not see a var you exported in a different terminal. YAML `skillsOnly: true` is the catalog default if the env is unset. FAQ path: [Host subagents](/docs/subagents).

## How does the agent find the right SOP?

The kit is a live graph: skills, host subagent stubs, SOPs, MCP servers, evals, and docs. You edit those files; `wk ontology check` fails dangling `depends-on`, `mcp:`, and subagent→skill links. Agents stay on the thin handshake, then kit-knowledge walks neighbors (`get_entity`, `get_related`) instead of dumping the tree. Browse it: [Waykit map](/docs/map). How to add a node: [Author the Waykit map](/ontology). Launch flow: [Host subagents](/docs/subagents).

## How do I stop the agent skipping red?

Install host TDD hooks in the app repo:

```bash
wk tdd-guard install
```

Cursor and Claude Code then run `wk tdd-guard` before writes. Production source is denied until a failing test run is recorded. Procedure: [TDD Guard hooks](/SOPs/tdd-guard). Upstream LLM validator (Claude plugin): [nizos/tdd-guard](https://github.com/nizos/tdd-guard).

## Where does EDD fit?

Inside TDD, when the change is a prompt or a tool contract. **EDD is alpha:** you write a failing eval for the tool and arguments you expect, implement until the **scripted** harness passes, then gate the merge with `wk eval ci --threshold-routing 95`. That is not proof the live model is correct. A production miss can become a JSONL case in the same suite. How mocks, styles, and CI work: [EDD guide](/docs/edd).

## Is the Waykit map my product architecture?

No. The [Waykit map](/docs/map) is **this kit**: skills, host subagents, SOPs, MCP servers, evals, and docs. It does not draw your system. Add a skill, stub, or SOP in the kit checkout, then `wk ontology check` and `wk ontology generate`. Step-by-step: [Author the Waykit map](/ontology).
