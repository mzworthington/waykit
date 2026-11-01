# AI and template tells

Use during the audit pass and whenever cleaning AI-generated copy. A pattern on this list is not always wrong. The test: does the line *perform* intelligence, or *deliver* it?

Waykit-owned prose also follows [CODING_PHILOSOPHY.md](../../../CODING_PHILOSOPHY.md) §8 (no em dashes; no default Oxford comma; lead with the point).

## When a banned-looking pattern is fine

| Pattern | Fine when |
|---------|-----------|
| Short parallel clauses | The items are real and distinct, not padded to three |
| "Unlock" as a literal product verb | The UI actually unlocks a resource |
| Urgency | A real deadline, expiry, or incident exists |
| Emoji | The design system uses them as icons, not as section titles |
| Second-person "you" | Marketing and UI; not API reference bodies |
| Heat / opinion | It names a concrete failure (no asserts, no CI gate), then explains how |
| Serial (Oxford) comma | Keep it when the last two items would otherwise read as one ("I'd like to thank my parents, Ayn Rand and God" vs the comma that splits them) |
| `, and` in a sentence | Fine as a clause join ("If the import fails, and the user retries…"). That is not a serial list |

## Tier 1 (almost always cut)

- **Significance inflation:** "marks a pivotal moment", "changes everything", "in today's fast-paced world"
- **Negative parallelism:** "It's not just X, it's Y"; "This isn't X. It's Y."
- **Copula avoidance:** "serves as", "boasts", "stands as a testament"
- **Signposting:** "Let's dive in", "Let's unpack", "Without further ado"
- **Manufactured drama:** "You're losing money every day you don't…"; false urgency
- **Hollow LinkedIn:** "We're thrilled to announce", "Exciting news!", engagement-bait questions
- **Slogan stacks:** three interchangeable taglines in title, H1, and support line
- **Fake systems chrome:** "KIT MESH · ONLINE", "SYSTEM READY", ALL-CAPS status theater
- **Gradient-speak:** a headline that still works if you swap the product name

## Tier 2 (usually cut; keep if the product uses the word literally)

- Buzzwords: revolutionary, disruptive, game-changer, cutting-edge, next-generation, seamless, robust, best-in-class, world-class, synergy, leverage (verb), unlock (metaphor), supercharge, empower, elevate
- "Sensible default" as authority padding
- "Vibes" as a crutch in every paragraph
- Rule-of-three padding (three adjectives, three promises, none specific)
- Habitual serial (Oxford) comma: "X, Y, and Z" as the default list rhythm. Prefer "X, Y and Z"
- Two-item comma: "A, and B" when "A and B" is the pair
- Em-dash overuse in kit-owned prose (product UI may match the project's punctuation)
- Copula-adjacent: "enables you to", "allows users to" when a verb would do
- Emoji as headings

## Waykit-specific tells

| Tell | Prefer |
|------|--------|
| *"Ship X you can prove"* | One concrete job or failure mode |
| *"sensible default"* as a badge | Drop it, or name the actual default |
| *"KIT MESH · ONLINE"* | *"Kit map"* |
| Lab-coat / harness cosplay | Outcome ("A harness you can run in CI") |
| *"Why EDD?"* / *"Explore →"* | *"How EDD works"* / *"Read the EDD guide →"* |
| Repeating the same tagline in title, H1, body, and footer | Say it once; elsewhere add new information |

## Audit sweep

1. Read once for Tier 1. Fix each hit.
2. Read again for hollow claims that violate specificity. Fix or flag `[METRIC: …]` / `[PROOF: …]`.
3. If a long draft had several Tier 1 hits, rewrite the structure; do not spot-patch.
4. If you calibrated to a voice sample, confirm the cleaned copy still sounds like that person.
5. On touched prose only, drop habitual Oxford commas. Do not run a workspace-wide `, and` replace: skip code, generated files, commit subjects and lists that need the comma for clarity.
