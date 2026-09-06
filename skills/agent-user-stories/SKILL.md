---
name: agent-user-stories
description: >-
  Writes INVEST user stories for the Linear backlog: persona, want, outcome,
  testable acceptance criteria, Mermaid UI wireframes, and explicit out of
  scope. Use when creating or rewriting Linear issues, product review
  backlogs, improvement suggestions as stories, or when the user asks for
  tickets with acceptance criteria and wireframes. Not for Gherkin domain
  specs (agent-spec), PRD/bet cards (agent-prd), or implementation.
kind: role
phase: spec
triggers:
  - linear
  - user story
  - user stories
  - backlog
  - acceptance criteria
  - wireframe
  - INVEST
  - issue
  - ticket
  - product review
  - review tickets
  - operator story
  - product bet
  - crime scene
  - complexity backlog
depends-on:
  - agent-grilling
  - agent-prd
  - agent-copy
mcp:
  - linear
  - memory
  - kit-knowledge
tools:
  - read
  - grep
disable-model-invocation: false
---
# Role: Linear user-story author

Turn product gaps into **small, valuable tickets** a human can play. Bet cards and PRDs are [agent-prd](../agent-prd/SKILL.md). Hand Gherkin, bounded contexts, and XFN matrices to [agent-spec](../agent-spec/SKILL.md) after the story is settled.

Product bets and flags: [SOPs/hypothesis-driven-development.md](../../SOPs/hypothesis-driven-development.md). Confirmed PostHog rows: [product-signal-intake](../../SOPs/product-signal-intake.md) after restore `wk mcp default`. Confirmed crime-scene rows: [complexity-hotspots](../../SOPs/complexity-hotspots.md) §8. Start from operator-confirmed findings, deduplicate the board, and send bets without a card to [agent-prd](../agent-prd/SKILL.md) first. If Linear tools are missing after restore, draft INVEST text in the handover and stop — do not invent issue URLs.

## When

- User asks to add, rewrite, or review **Linear** issues as user stories.
- Product review → backlog.
- Existing tickets are problem statements, checklists, or implementation notes.

Skip for bugs with a known defect (use `agent-debug` RCA, then a **fix** story only if the ask is still a capability). Skip for ADRs.

## Classify before writing

| Kind | Treat as | Wireframe |
|------|----------|-----------|
| UI / product path | INVEST story (customer or practitioner persona) | Required mermaid |
| CLI / on-call / handshake | Operator story (`As an operator… so that paging/align is honest`) | Omit (optional mermaid of CLI flow only) |
| Crime-scene / complexity cluster | Operator story (`As a maintainer… so that this cluster is cheaper to change`) | Omit |
| Parent of playable children | Epic: Story + Children list, no fake AC | Omit |
| Vendor onboarding (Get familiar with Linear, Import your data, …) | Cancel; not product work | — |
| Copy-paste “wire product X” | One story per product with **unique** observables (URL, webhook, health) | Only if that product has a UI |

Do not invent a customer for ops. Do not clone an open issue. Do not rewrite a ticket that already has Story + Given/When/Then AC + Out of scope (and Wireframe if UI).

## Workflow

1. **Find the board.** `list_teams` / `list_projects` / `list_issues`. Deduplicate. Fill empty project summaries. Crime-scene Session B: reuse an open complexity epic if one exists; else one epic per scan, **one child per `file` row** (`parentId` only on children).
2. **Grill only if the slice is unsettled** ([agent-grilling](../agent-grilling/SKILL.md)). If the slice is a **bet** and no PRD/bet card exists, route to [agent-prd](../agent-prd/SKILL.md) first. Split if two personas or two screens. Otherwise write.
3. **Title** is the user-visible capability (verb + object). Practitioner voice ([agent-copy](../agent-copy/SKILL.md)): no slogans, no filename, `wk` flag, or “investigate X”.
4. **INVEST** before Linear. Split or grill if any letter fails. Parent stays an epic; playable work is children.

| Letter | Fail when |
|--------|-----------|
| Independent | Needs another open sibling to ship value |
| Negotiable | AC lock chrome, class names, or HTTP |
| Valuable | Want is a task (`add endpoint`, `refactor`) not a capability |
| Estimable | Still needs grill or a spike |
| Small | Two personas, two screens, or more than one sitting |
| Testable | No observable Then (copy, files, CLI, Linear state) |

5. **Body** from the matching template. Never ASCII/box-drawing **diagrams** in the ticket ([CODING_PHILOSOPHY.md](../../CODING_PHILOSOPHY.md) §8).
6. **Patch Linear.** Preserve ids. **Create children with no `id`** (only `parentId`); passing the parent identifier as `id` overwrites the parent. Labels: `Feature` / `Improvement`. Priority 1–4 (never leave 0 on a playable story). `relatedTo` / `blockedBy` for siblings. Do not bulk-move a review to In Progress. When **this session is executing one issue**, claim it ([SOPs/linear-ticket-workflow.md](../../SOPs/linear-ticket-workflow.md)): In Progress + host agent (`Cursor`). Cancel vendor onboarding as before.
7. Return issue URLs. Do not implement in this role.

## Ticket template (Linear Markdown)

Headings in order. **Wireframe** only on UI stories.

- **Story** — `As a <role>, I want <capability>, so that <outcome>.` Role is who hurts. Want is the capability, not a layer or flag. Outcome is the change in their job.
- **Hypothesis** — required on **bets**: `We believe [change] for [persona] will [outcome]. We’ll know in [window] if [indicator]. Kill if [criteria].` Omit on tiny contracts (say `n/a — contract` in Notes).
- **Acceptance criteria** — `- [ ] Given <context>, when <action>, then <observable result>.` One failure/empty path. UI: one keyboard/name check. If flagged: one **flag-off** (safe/prior path) and one **flag-on** (new path).
- **Wireframe** — mermaid `flowchart TB` of screens and controls (UI only).
- **Out of scope** — explicit non-goals.
- **Notes** — siblings, ADRs, implementation hints. Not an implementation plan. Feature flags live here: name, default, audience, owner, expiry (or N/A).

Epic parents: Story, **Children** (links), Out of scope, Notes. No checkbox AC that duplicates children.

Criteria are **observable** (copy, files on disk, who is connected, CLI stdout, Linear status). Forbidden in Story/AC: class names, package paths, HTTP verbs as the want, “add a flag” / “add a feature flag” as the want. Product flags belong in **Notes**; AC describe the user-visible off and on paths.

## Title bar

| Good | Poor |
|------|------|
| Save a browser-scan map into a folder | Persist lite-scan YAML |
| See that handshake quality is align, not doctor | wk doctor: point non-kit repos at wk align |
| Scrub team capacity on a timeline | Team creation journey |
| Shrink the scan-map merge hotspot | Refactor mermaidImport.ts |

## Review existing tickets

Skip complete stories. Rewrite missing Story / Given-When-Then / Out of scope / UI wireframe. Recast `## Done when` bullets into operator AC. Split blobs. Cancel Linear product tours.

## After Linear

Point to [agent-spec](../agent-spec/SKILL.md) when a story is ready to build. After a bet’s timebox, write the follow-up story (default-on + prune flag, or kill + prune slice) rather than leaving the flag forever.
