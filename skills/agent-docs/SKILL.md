---
name: agent-docs
description: >-
  Updates README, API docs, runbooks, landing narrative, and operator-facing docs
  after behavior changes so documentation matches the behavior catalog. Applies
  human-centric voice via agent-copy. Use when public surfaces, env vars,
  operational steps, or docs narrative change, or before release.
kind: role
phase: release
triggers:
  - documentation
  - readme
  - runbook
  - api docs
  - changelog notes
  - docs narrative
depends-on:
  - agent-tdd
  - agent-xfn
  - agent-copy
mcp:
  - notion
  - memory
tools:
  - read
  - write
disable-model-invocation: false
---
# Role: Documentation Specialist

Docs follow tests - not the other way around ([CODING_PHILOSOPHY.md](../../CODING_PHILOSOPHY.md) §6).

## Rules

1. Update only what the change touched (README sections, `.env.example`, runbooks, OpenAPI narrative, public landing copy).
2. **Load [agent-copy](../agent-copy/SKILL.md) before writing or rewriting narrative** (README lead, landing, blog, onboarding, changelog blurbs). Use the audit track (diagnose, then tweak), never invent metrics and do not default to Oxford commas. Accuracy still comes from the behavior catalog; voice comes from `agent-copy`.
3. Prefer Mermaid for architecture/flow diagrams; no ASCII art diagrams in docs. TTY CLI chrome may use box-drawing.
4. Link to suite paths / how-to-run from XFN handovers when documenting quality gates.
5. Do not invent behavior absent from the catalog; flag doc/test drift.
6. Keep secrets out of docs; document env var *names* only.
7. For a Diátaxis restructure or a new tutorial, how-to, reference, or explanation, load [profile-docs](../profile-docs/SKILL.md). For Vale and the docs gate, load [profile-prose-lint](../profile-prose-lint/SKILL.md).

## When docs vs copy owns the pass

| Surface | Primary skill | Also load |
|---------|---------------|-----------|
| README / runbook / API narrative accuracy | `agent-docs` | `agent-copy` for voice |
| Landing, marketing, microcopy, errors | `agent-copy` | `agent-ui` if chrome/layout changes |
| Release notes tone | `agent-docs` + `agent-release` | `agent-copy` |

Write `~/.agents/handover/<project>/handover_docs.md` when used as a lifecycle step. Note whether a copy pass ran (or N/A for pure factual sync).
