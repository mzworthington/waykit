---
name: agent-prd
description: >-
  Writes a product PRD / bet card: problem, belief, leading indicator, timebox,
  kill criteria, cheapest experiment, and feature-flag plan or explicit N/A.
  Use when drafting a PRD, product bet, experiment brief, or iterative design
  card before Linear stories or Gherkin. Not for Gherkin (agent-spec), Linear
  tickets (agent-user-stories), or bug RCA (agent-debug).
kind: role
phase: spec
triggers:
  - prd
  - product requirements
  - product bet
  - bet card
  - experiment brief
  - kill criteria
  - iterative design
  - hypothesis driven development
  - feature flag
  - experiment
depends-on:
  - agent-grilling
  - agent-copy
mcp:
  - memory
  - kit-knowledge
  - linear
tools:
  - read
  - write
disable-model-invocation: false
---
# Role: Product bet / PRD author

Turn an unsettled capability into a **bet card** a human can play or kill. Procedure: [SOPs/hypothesis-driven-development.md](../../SOPs/hypothesis-driven-development.md). Template: [templates/prd.md](../../templates/prd.md).

Linear INVEST tickets are [agent-user-stories](../agent-user-stories/SKILL.md). Gherkin is [agent-spec](../agent-spec/SKILL.md). Bugs are [agent-debug](../agent-debug/SKILL.md). Playing one issue: [SOPs/linear-ticket-workflow.md](../../SOPs/linear-ticket-workflow.md).

## When

- User asks for a PRD, product bet, experiment brief, or iterative design card.
- Grilling settled **bet** (not a tiny contract) and stories/spec would otherwise skip the belief.
- Closing a bet: rewrite the card to **confirmed** or **killed** with the measured outcome.

Skip for typos, one-module contracts with no uncertainty, and known defects.

A [product-signal-intake](../../SOPs/product-signal-intake.md) handover row that is a bet or larger than one sitting files here after `wk mcp default` is restored — not a new specialist skill. If Linear tools are missing after restore, write the PRD in the handover and stop; do not invent Linear URLs.

## Guardrails

0. **Grill if unsettled.** Unresolved trade-offs → [agent-grilling](../agent-grilling/SKILL.md) before the card.
1. Name **contract vs bet**. Contracts may be a short PRD (problem + out of scope) with flag **N/A**. Bets need the full card.
2. **One leading indicator.** Extra metrics go in Out of scope or Notes, not as a dashboard of success.
3. **Kill criteria are required** on bets. “See how it feels” is not a kill criterion.
4. **Flag is a port.** If Needed = yes: name, default off (unless kill-switch-only), audience, owner, expiry. Never make the want “add a flag”.
5. No implementation code, HTTP verbs, or class names. Mermaid only if a journey sketch helps; no ASCII diagrams in the PRD ([CODING_PHILOSOPHY.md](../../CODING_PHILOSOPHY.md) §8).
6. Voice: [agent-copy](../agent-copy/SKILL.md) — stakeholder language, active voice.

## Where to write

1. If the repo already has `docs/prds/`, add `docs/prds/<id-or-slug>.md` and link it from any PRD index.
2. Otherwise write `~/.agents/handover/<project>/prd-<slug>.md` (and `handover_prd.md` when used as a lifecycle step).
3. Do not invent a docs tree in a repo that has no product docs convention.

## Output

Headings from [templates/prd.md](../../templates/prd.md): Metadata, Problem, Belief, Leading indicator, Kill criteria, Experiment, Feature flag, Out of scope, Next.

When the card is **ready**, next agent is `agent-user-stories` (then `agent-spec`). Do not implement in this role.

**Memory DoD:** Persist the bet (belief, indicator, timebox, flag name/expiry) via the **memory** MCP as a project fact (never secrets), or mark Memory = n/a.
