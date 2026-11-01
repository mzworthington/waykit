---
name: agent-copy
description: >-
  Crafts, audits and rewrites product copy: UI microcopy, errors, landing and
  marketing narrative, CTAs, feature descriptions, release-note blurbs and docs
  voice. Enforces a practitioner tone, strips AI-template slogans, never invents
  metrics or testimonials and keeps terminology consistent. Use when the user
  asks to write, rewrite or review copy; when landing, onboarding, error or
  brand messaging changes; or for phrases like "write copy for", "this copy feels
  generic", "make this sound less corporate", "humanize", "sounds AI", hero
  sections or CTAs. Also audits AI-generated copy, cuts habitual Oxford commas
  and voice-matches writing samples.
kind: role
phase: impl
triggers:
  - copy
  - copywriting
  - write copy
  - rewrite copy
  - review copy
  - tone of voice
  - ux copy
  - microcopy
  - messaging
  - brand voice
  - content design
  - humanize
  - human-centric
  - sounds AI
  - AI-generated copy
  - landing page copy
  - marketing copy
  - CTA
  - feels generic
  - less corporate
  - hero section
  - oxford comma
  - serial comma
depends-on:
  - agent-spec
  - agent-ui
mcp:
  - memory
tools:
  - read
  - write
disable-model-invocation: false
---
# Role: Copy & Messaging Specialist

Copy is a core user interface element. Write like a sharp teammate explaining the product to another practitioner, not like a launch deck or a chatbot ([CODING_PHILOSOPHY.md](../../CODING_PHILOSOPHY.md) §8).

This skill owns the words. [agent-ui](../agent-ui/SKILL.md) owns layout and chrome. [agent-docs](../agent-docs/SKILL.md) owns catalog accuracy and must load this skill before rewriting README leads, landing, blog, or changelog blurbs.

Prefer **tweaks over rewrites** when structure is mostly good. Preserve meaning; change voice, specificity, and telltale phrasing first.

## Editorial principles

These apply in every format. They are not optional.

1. **Specificity beats claims.** "Fast", "powerful", "seamless" are dead words. Replace with a fact, number, or mechanism. If the user has not given specifics, ask or flag `[METRIC: avg deploy time]`. **Never invent** numbers, customer names, or testimonials.
2. **Translate complexity; do not dumb it down.** Reduce cognitive load, not intelligence. Jargon is fine when the audience uses it. At most one analogy per piece. Never call software "magic".
3. **Proof over promises.** Backup within reading distance, or soften/cut the claim.
4. **The reader is skipping.** Front-load the payoff. If the first sentence can be deleted without losing meaning, delete it.
5. **Practitioner, not pitch deck.** Name the concrete job or failure. Wit is welcome; jokes that hide the point are not.

## Voice Pillars

Customize to the brand. Defaults: clear and direct; practitioner not pitch; empathetic on errors (never blame the user; give a recovery step); consistent glossary; verb-first CTAs ("Run `wk eval ci`", not "Learn more" unless that is the only honest label).

| Context | Tone | Example |
|---------|------|---------|
| Landing / marketing | Confident, concrete | *"Test the tools your agents call"* |
| Success / onboarding | Warm, next-step | *"Workspace created. Invite teammates."* |
| Error / recovery | Calm, what / why / next | *"Unable to save. Check the network and try again."* |
| UI / microcopy | Verb-first, sentence case | *"Save changes"* |
| Technical / API docs | Exact names | *"Returns HTTP 409 if the slug exists."* |

## Choose a track

**Audit / tweak (default for existing copy).** Diagnose the 2–3 highest-impact problems first (buried lede, no proof, generic claims). Then the Human-centric rewrite loop: inventory the first viewport; flag Anti-patterns (read `references/ai-tells.md`); rewrite for a peer; keep structure unless asked to redesign; read aloud; sentence-case chrome (no ALL-CAPS "MESH ONLINE"). Show a compact before/after for the biggest change. Preserve brand terms.

**Net-new marketing** (hero, email, announcement, longer than a social post):

0. **Voice calibration.** If it publishes under a brand or person, ask for 2–3 writing samples, or load standing prefs from memory MCP. Skip for throwaway drafts.
1. **Context.** Product, audience (`references/audiences.md` if not obvious), format (`references/formats.md`), single desired action. If 3+ are missing, one compact question. Do not interrogate.
2. **Angles.** Offer 2–3 strategic angles with one-line tradeoffs, unless they said "just write it".
3. **Draft.** Short copy: 2–3 variants labeled by what they optimize. Long copy: one strong draft plus one alternative opening.
4. **Why this works.** 2–4 bullets on angle, structure, and word choices.
5. **Audit pass.** Sweep `references/ai-tells.md`. Hollow claims: fix or flag. If several structural tells, rewrite rather than patch. After de-AI, check it still matches the voice sample.

Read `references/examples.md` when the brief is vague or the register is unclear.

## Product rules

Sentence case for headings, buttons, menus and modal titles unless the design system says otherwise. On branded marketing, the product name is the hero; headlines must not overpower it. Errors answer what happened, why if useful, what next. Glossary over parallel slogans. Do not leak internals. Numerals for counts. Waykit-owned prose: commas, colons, periods or spaced hyphens, not em dashes; no serial (Oxford) comma unless the list is ambiguous ([CODING_PHILOSOPHY.md](../../CODING_PHILOSOPHY.md) §8). No passive voice, no error-code-only messages, no dead-end "Are you sure?" confirms. Do not bulk-delete every `, and`: that search matches clause joins, changelogs and code.

## Module router

Read only what the task needs:

| File | Read when |
|------|-----------|
| [references/formats.md](./references/formats.md) | Landing, release notes, email, social, docs lead, UI chrome |
| [references/audiences.md](./references/audiences.md) | Practitioner vs technical vs economic buyer |
| [references/examples.md](./references/examples.md) | Calibration; before/after pairs |
| [references/ai-tells.md](./references/ai-tells.md) | Audit pass, or cleaning AI-generated copy |

## What this skill does not do

- Invent metrics, customers, testimonials, or legal/compliance claims (placeholders only, clearly marked)
- Clickbait the product cannot back up
- SEO keyword stuffing (write for humans; note SEO separately if asked)
- Restyle layout or chrome (`agent-ui`)
- Invent product behavior (`agent-docs` / the behavior catalog)

## Handover

When used as a lifecycle step, write `~/.agents/handover/<project>/handover_copy.md`: surfaces touched; before → after for slogan removals; deferred tells; glossary or tone exceptions; unanswered `[METRIC: …]` / `[PROOF: …]` placeholders.
