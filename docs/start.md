# Getting started

Four steps to Waykit on a repo. macOS and Linux; needs git and Node 22+. No API key.

1. **Install Waykit (~2 min)** - Links `~/.agents` and puts `wk` on your PATH via `~/.local/bin`.
2. **Bootstrap this checkout (~2 min)** - `wk` with no arguments opens a guided menu on a TTY, or run `wk init . --mcp default --hook` to write the thin handshake, IDE pointers and a default MCP profile. Already in this repo? `./install.sh` is enough.
3. **Pick the path (~1 min)** - Typo, bug or failed CI: launch `agent-debug` (host subagent when logs are noisy) plus light XFN if you touched UI, auth or an SLO. New product capability: the [feature lifecycle](/docs/lifecycle) (orchestrator parent launches allowlisted specialists). Day-to-day CLI: `wk align .`, `wk doctor`, `wk check` ([operator guide](/docs/kit)). Cards: [Jobs for today](/docs/jobs).
4. **Optional: prove a tool call (~3 min, EDD alpha)** - `wk eval run --suite evals/edd/demo.yaml --model scripted`, then `wk eval ci --suite evals/edd/demo.yaml --threshold-routing 95 --out out/reports`.

## Install Waykit

If `wk` is missing after install, add `~/.local/bin` to `PATH`.

```bash
curl -fsSL https://raw.githubusercontent.com/mzworthington/waykit/main/install.sh | sh
wk init . --mcp default --hook
```

## Run an eval locally (optional)

```bash
wk eval run --suite evals/edd/demo.yaml --model scripted
wk eval ci --suite evals/edd/demo.yaml --threshold-routing 95 --out out/reports
wk eval report --format md --out out/reports
```

The scripted driver works offline. A provider key is only for optional live-model evals.

## Shell completions

`./install.sh` runs `wk completion install`, which writes a **thin stub** to `~/.zfunc/_wk` (zsh) and `~/.local/share/bash-completion/completions/wk` (bash). The stub calls `wk __complete` on each tab, so new verbs and flags appear after you upgrade `wk` without regenerating the file.

zsh (once, in `~/.zshrc` **before** `compinit`, then `exec zsh`):

```zsh
fpath=("$HOME/.zfunc" $fpath)
autoload -Uz compinit && compinit
```

bash (once, in `~/.bashrc`):

```bash
source "$HOME/.local/share/bash-completion/completions/wk"
```

If you skip install, `source <(wk completion zsh)` still works: that printout is the same stub, not a baked command list. Tab after `wk` lists commands; `wk eval `, `wk ontology `, and `wk mcp ` get the next word from the live CLI.

## Next

- [Jobs for today](/docs/jobs) — typo/debug vs product feature, plus the other cards
- [Feature lifecycle](/docs/lifecycle) only when the job is a new product capability
- [Host subagents](/docs/subagents) for which roles launch in a fresh window
- [EDD guide (alpha)](/docs/edd) for suites, CI, and production misses
- [Hosts](/docs/hosts) for Cursor, Claude Code, Copilot, and Antigravity files
- [What Waykit gives you](/docs/kit) for context budget, the live kit graph, and MCP profiles
- [Repo doctor](/docs/doctor) for README, license, and GitHub templates on repos you own
- [Consumer align](/docs/align) for handshake, host pointers, kit MCP, and the reusable PR Action
- [Used on our own product repos](/docs/used-in) for first-party checkouts that already pass `wk align`
- [Waykit map](/docs/map) is that graph in the browser; [author it](/ontology) after you change skills or SOPs
- [Common questions](/docs/faq)
