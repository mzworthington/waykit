# Audiences

Calibrate jargon, proof, and CTAs. Do not invent a persona. If the reader is obvious from the product, skip this file.

## Practitioner (default)

Developers, operators, and people who will run the thing.

- Jargon they use is fine (`idempotent`, `eval`, `port`). Define kit-specific terms once.
- Proof they trust: a command, a failing test, a constraint, a short mechanism.
- CTA: something they can do now (`pnpm wk eval ci`, "Read the EDD guide").
- Distrust: magic, "seamless", executive adjectives, fear-mongering.

## Technical buyer

Staff+ engineers, architects, security reviewers who will say no.

- Lead with boundaries, failure modes, and what you will not do.
- Proof: architecture (Mermaid, not ASCII), threat notes, how it fails closed.
- CTA: design review, architecture note, or a scoped trial, not a vague demo.

## Economic buyer

Someone who funds the work (founder, CFO, budget holder). They may not share the practitioner glossary.

- Lead with the job replaced and the constraint (time, risk, headcount), not the mechanism.
- Translate jargon; do not baby-talk. One analogy maximum.
- Proof: a named outcome or a clearly marked `[METRIC: …]`. Never invent ROI.
- CTA: a decision (pilot scope, pricing conversation), not "Learn more".

## Mixed surfaces

Landing pages often serve practitioner first in this kit. If a page must serve two readers, put the practitioner job in the hero and the economic constraint in a later, clearly labeled block. Do not blend both into one slogan.
