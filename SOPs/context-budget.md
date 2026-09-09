---
title: Context budget - always-on vs on-demand
kind: sop
triggers:
  - context budget
  - token usage
  - always-on
  - prompt bloat
  - kit-knowledge
tools:
  - shell
---
# Standard Operating Procedure: Context budget

Keep always-on agent context small. Load philosophy, SOPs, and skills **on demand**. Prefer **kit-knowledge** and **memory** MCP over dumping files into the prompt.

## Targets

| Surface | Target |
|---------|--------|
| Always-on bootstrap (`AGENTS.md` + project handshake) | **&lt; ~2k tokens** (~8KB chars). Host pointers are listed, not summed. |
| Skill discovery (descriptions only) | Acceptable; do not pre-load skill bodies |
| Full SOP / philosophy read on typo or debug routes | **Zero** unless the route needs that procedure |
| MCP servers enabled | **One profile** matching the work; match skill `mcp:` frontmatter |

## Split

| Mechanism | Holds |
|-----------|-------|
| Always-on | Invariants + phase→skill index ([AGENTS.md](../AGENTS.md)) |
| Skills | Role/phase behavior when triggered |
| File read / **kit-knowledge** | SOP slices, philosophy sections, handovers |
| **memory** MCP | Glossary, SLOs, prefs across sessions (never secrets) |
| Other MCP | Live systems (GitHub, Context7, browsers, …) |

## Measure

```bash
pnpm wk measure-context
```

Reports character/token estimates for always-on surfaces and flags when over budget. Re-run after editing `AGENTS.md` or project handshake templates. Public write-up: [docs/kit.md](../docs/kit.md).

## Session checklist

- [ ] Did not bulk-read `CODING_PHILOSOPHY.md` or multiple SOPs before the first edit on a small route
- [ ] Loaded at most one phase skill body for the active route
- [ ] Used kit-knowledge or a single SOP path when a procedure was needed
- [ ] Spec/XFN stored durable facts in memory MCP (or N/A in handover)
- [ ] Only one MCP profile active; unused heavy servers not installed globally
