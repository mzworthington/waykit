# Homepage mockups

Exploration only. These pages are not wired into `web/` and are not the live [waykit.dev](https://waykit.dev) homepage.

Open [`index.html`](./index.html) in a browser, or the four pages below. Screenshots live in [`images/`](./images/).

## What is wrong with the current homepage

The first viewport currently stacks:

1. Brand, a process slogan (`Grill, spec, TDD, ship, then learn`), a lede that also disclaims EDD alpha, five badges, four equal CTAs.
2. Eight "today" job cards, with install buried as card one.
3. The live ontology explorer.

A practitioner scanning for *why this exists* has to finish a product tour first. The map, the full CLI table and the five-step eval demo are true. They are also second-session material. They compete with the seven things this round asked to push:

| Ask | Where it lives now | Problem |
| --- | --- | --- |
| High-quality code | Implied by TDD in the slogan | Never named as the outcome |
| Learning loops | Lede clause + later eval proof | Split across hero, proof and demo |
| Full agent PDLC / SDLC | Slogan + lifecycle CTA + job card | Sequence without a picture |
| Single-line install | Inside the first job card | Not the hero action |
| Evals | Proof + interactive demo | Two long blocks after the map |
| CLI | Full operator table | Catalog, not the first four verbs |
| Evidence (our repos) | Mid-page cards | After map and CLI |

None of the mockups invent metrics or customer quotes. Repos named are the first-party set already on the homepage.

## Shared cuts (all four)

- One primary action: the curl install. One secondary: lifecycle or GitHub.
- EDD honesty stays next to evals, not in the hero.
- Job picker, ontology map, badge row, four-CTA row and the 5-step demo stay off this page. They already have docs routes.
- CLI shows four verbs (`wk`, `wk align`, `wk check`, `wk eval ci`), not the operator catalog.
- Copy is sentence case, no serial comma unless the last two items would merge, no em dashes.

Install line used everywhere:

```bash
curl -fsSL https://raw.githubusercontent.com/mzworthington/waykit/main/install.sh | sh
```

Follow-up, not a second slogan: `wk init . --mcp default --hook`.

## The four directions

### 01 · Install first (`01-install.html`)

**Organizing idea:** activation. If they only remember one thing, they can run Waykit in a minute.

**Hero:** `Put a release bar on the agent` + the curl block.

**Why this shape:** the current "Install Waykit" button jumps to a job card. Treating the command as the hero matches how practitioners actually adopt CLIs (Homebrew, rustup). Repos sit immediately under the fold as quiet proof. Quality, PDLC and loops are three equal cards so none of those asks get dropped.

**Tradeoff:** the lifecycle is not visible as a picture. People who need to *see* grill → ship may bounce to mock 02. The headline is outcome, not brand; Waykit still leads the header.

**Ship this if:** inbound is "what do I run?" more than "what is the methodology?"

### 02 · Lifecycle spine (`02-lifecycle.html`)

**Organizing idea:** the product *is* the agent-supported PDLC. Learn is drawn as a return path, not a fifth slogan.

**Hero:** `Grill to ship. Then the loop.` plus the phase row (Grill, Spec, TDD, XFN, Audit, Ship) and a Learn strip.

**Why this shape:** the live headline lists the phases as prose. A spine makes "full PDLC" scannable in one glance and puts high-quality code on TDD/XFN instead of as marketing. Install is still one screen away, in a terminal block, not competing with the diagram.

**Tradeoff:** slower to first command. Worse for "I already believe you, give me the curl." Better for "is this another prompt pack?"

**Ship this if:** the homepage's job is to differentiate from skill dumps and AGENTS.md packs.

### 03 · Proof first (`03-proof.html`)

**Organizing idea:** we eat this. The four product repos are the argument.

**Hero:** `The kit we actually run` and a 2×2 of ArchLens, steerco, the Cloudflare template and GPIO monitor. Install comes after.

**Why this shape:** staff engineers skip slogans. They open `AGENTS.md` and look for TDD, hexagonal cores and a thin handshake. Leading with repos makes "evidence it works" the first-class ask instead of a mid-page grid after the map. The kit, curl, loops and CLI follow in one short section.

**Tradeoff:** a first-time visitor does not know what Waykit is until they scroll. Weak if traffic is cold search. Strong if traffic is GitHub, word of mouth, or "show me you use it."

**Ship this if:** credibility is the bottleneck, not discoverability of install.

### 04 · Quality and loops (`04-quality-loops.html`)

**Organizing idea:** two columns, two promises. Left is the bar (TDD, XFN, hexagonal, `wk check`). Right is how the system learns (evals, quality loops, work picker). Light paper so it does not look like the current dark docs site.

**Hero:** `High-quality code. Agents that learn.`

**Why this shape:** those two asks are easy to bury under "lifecycle." A split makes them visually equal. PDLC is a thin spine under the fold, not the whole story. Visual contrast (light) helps you compare this round against the live site without squinting.

**Tradeoff:** light theme is a bigger brand departure. The split can feel like two products if the spine is too quiet. Install is lower than in 01.

**Ship this if:** you want craft + learning to be the remembered pair, and you are willing to restyle later.

## Recommendation

Do not ship a collage of all four. Pick a **lead** and steal parts:

1. **Default recommendation: 01 structure, 02 spine as the first section below the command.** Curl in the hero. Lifecycle picture next. Repos as a strip. Three cards only if they still earn their space after the spine exists.
2. Keep 03's repo card copy (specific, checkable) even if the layout stays 01.
3. Keep 04's split if user research says people still cannot tell "quality" from "loops." Otherwise the Learn return path in 02 already says it.
4. Leave the ontology explorer and job wall on `/docs/map` and `/docs/jobs`. They are good tools on the wrong URL.

## 05 · Main graphic (in progress)

**Organizing idea:** one picture that carries value, quality and loops so the copy does not have to.

**Shape:** a closed circuit on the dark kit palette.

| Layer | What it shows |
| --- | --- |
| Forward rail | Grill → Spec → TDD → XFN → Audit → Ship |
| The bar | TDD and XFN as filled chips (not dots). Centre badge: high-quality code + kit mark |
| Learn return | Dashed arc: eval miss → quality loops → Linear → work picker |
| Value | The caption under the figure: closed loop, not three equal cards |

**Why SVG, not a photo:** the product *is* the process. A diagram stays crisp at any width, matches IBM Plex / teal tokens, and can animate (rail draw, bar pulse, learn dash flow) without looking like stock art.

**Placement bet:** brand-sized lockup + short headline + one CTA, then the figure full-bleed, then curl. That flips 01 (curl first) when differentiation matters more than activation. Steal the asset into 01 or 02 if curl must stay above the fold.

**Open:** [`05-main-graphic.html`](./05-main-graphic.html) · asset [`graphics/value-quality-loop.svg`](./graphics/value-quality-loop.svg)

## 06 · Loops in loops (current)

**Organizing idea:** show that Waykit is not one loop. Nested loops, an eval gate, and outside signals that *start* Learn.

| Layer | What it shows |
| --- | --- |
| Outer PDLC | Same Grill → Ship → Learn circuit as 05 |
| Short loop | Ellipse around TDD: red → green → refactor |
| Eval gate | Diamond after Ship: `wk eval ci` validates routing before Learn |
| Outside in | CI, RUM, Lighthouse, Sonar drop into signal intake (warm accent, not teal) |
| Quality loop | Nested arc on Learn: Linear → hygiene → work picker → draft PR |

**Why the warm accent:** teal owns the intentional PDLC and TDD loops. Sand (`#c4b5a0`) marks *external* pressure so inbound signals do not look like another phase chip.

**Open:** [`06-loops-in-loops.html`](./06-loops-in-loops.html) · asset [`graphics/loops-in-loops.svg`](./graphics/loops-in-loops.svg)

**Next design passes:** decide if signal intake sits above the bar or only on Learn (current: above, funneling down); whether PostHog belongs in the outside row or stays off-home; denser mobile collapse of nested labels.

## 07 · Implementation and eval (paper)

**Organizing idea:** the architecture-board diagram (nested PDLC/SDLC/TDD, eval gate, outside factors) restyled to the live site, not the dark mockups.

| Cut | Why |
| --- | --- |
| No platform title, header bars, shadows, gold hex | Deck chrome. The page already names Waykit. |
| Paper + `#0f766e` + `#8a7a66` | Live `web/src/site.css` tokens. Accent marks eval and outside, same job sand does on 06. |
| Kit mark on the eval column | Brand hinge, not a filled check hex or pass/fail gate. |
| Eval list = datasets, tests, routing, drift | What `wk eval ci` actually names. Not hallucination scans. |
| No decision, pass/fail, or connector arrows | The columns are the story. Return plumbing fought the loops. |

**Open:** [`07-implementation-eval.html`](./07-implementation-eval.html) · asset [`graphics/implementation-eval.svg`](./graphics/implementation-eval.svg)

## What these files are

| File | Role |
| --- | --- |
| `index.html` | Gallery |
| `01-install.html` … `04-quality-loops.html` | Clickable mockups |
| `05-main-graphic.html` | Hero graphic v1 (single closed loop) |
| `06-loops-in-loops.html` | Hero graphic v2 (nested loops + evals + outside signals) |
| `07-implementation-eval.html` | Architecture board restyled to live paper tokens |
| `graphics/value-quality-loop.svg` | Standalone loop asset (v1) |
| `graphics/loops-in-loops.svg` | Nested loops asset (v2) |
| `graphics/implementation-eval.svg` | Nested PDLC/SDLC/TDD + eval gate (paper) |
| `mock.css` | Shared tokens (IBM Plex, teal, existing dark palette + one light variant) |
| `images/` | Viewport and full-page captures of each mock |

No production routes, tests or copy constants were changed. If a direction is chosen, the next step is a copy + UI change in `web/src/landing/copy.ts` and `HomeLanding`, with TDD on the copy catalog first.
