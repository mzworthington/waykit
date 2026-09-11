# Docs overview

Public guides for Waykit: the software lifecycle for coding agents, the learning loops around it, the live kit graph and the operator surfaces. Markdown in this directory (plus `SOPs/`, eval write-ups and MCP/ontology READMEs) is the site. Raw `.md` URLs stay next to the HTML so agents and `llms.txt` do not depend on client JavaScript.

`pnpm site:dev` runs the docs app. `pnpm --dir web build` then `wk site assemble` writes `site/`.

## Start

| Page | Who it is for |
|------|----------------|
| [Getting started](./start.md) | First install, handshake, shell completions, then the loops you need |
| [Jobs for today](./jobs.md) | Seven concrete jobs, one command each |
| [Common questions](./faq.md) | Install, keys, context, repo doctor, tab-complete, how agents find an SOP, where EDD fits |

## Practice

| Page | Who it is for |
|------|----------------|
| [Feature lifecycle](./lifecycle.md) | Grill → PRD if bet → spec → TDD → XFN → ship |
| [What Waykit gives you](./kit.md) | `wk` CLI: context budget, live kit graph, MCP profiles, check, doctor |
| [Repo doctor](./doctor.md) | Owned-repo README, license, contributing, GitHub templates |
| [Consumer align](./align.md) | App-repo handshake, host pointers, kit MCP, commit-msg, reusable PR Action |
| [Used on our own product repos](./used-in.md) | ArchLens, steerco, React Cloudflare template, GPIO monitor |
| [Waykit map](./map.md) | Live graph of this kit (derived from files, not a second catalog) |
| [Author the Waykit map](../ontology/README.md) | What becomes a node, how to regenerate, what it is not |
| [EDD guide (alpha)](./edd.md) | Anyone proving agent tool routing in CI |
| [Hosts](./hosts.md) | Cursor, Claude Code, Copilot, Antigravity files |
| [Host subagents](./subagents.md) | Which SDLC roles become isolated agents vs stay skills |

## Reference

| Page | Who it is for |
|------|----------------|
| [SOPs](./sops.md) | Agent-facing procedures |
| [ADRs](./ADRs/) | Hard-to-reverse kit decisions |
| [Eval suites](../evals/edd/README.md) | YAML/JSONL layout and drivers |
| [MCP library](../mcps/README.md) | Profiles and servers |
| [Ontology schema](../ontology/schema.yaml) | Metamodel (`phaseOrder`, types, memory allowlist) |

Independent assessment: [kit value and model-agnostic review](./kit-value-and-model-agnostic-review.md), [review backlog](./kit-review-backlog.md).
