# Architecture routing goldens

Live catalog for ranking models and system-prompt changes. **Not** a `wk check` suite.

| File | Role | Rows |
|------|------|------|
| `architecture_routing.jsonl` | Working golden | 80 |
| `architecture_routing.holdout.jsonl` | Frozen holdout | 20 |
| `write-cases.mjs` | Authoring source — edit this, then `node evals/edd/goldens/write-cases.mjs` | |

CI seeds stay in `evals/edd/architecture_routing.jsonl` (~10 unique intents). Demo and safety keep their own copies of teaching/injection prompts.

## Run (live only)

```bash
noglob wk eval run --suite evals/edd/goldens/architecture_routing.yaml \
  --style cli --cli cursor-agent --model cursor-grok-4.6-medium

noglob wk eval run --suite evals/edd/goldens/architecture_routing.holdout.yaml \
  --style cli --cli cursor-agent --model cursor-grok-4.6-medium
```

`--style local` skips every row (`requires-live`). That is intentional.

Holdout is weekly or pre-release. Do not iterate the system prompt against holdout scores.

## Coverage matrix

Each working row has `intent:*`, `entity:*`, and `diff:*` tags. Fill empty cells with **new wording**, not `wk eval dataset synthesize`.

| Intent | payment / billing / checkout | auth | none |
|--------|------------------------------|------|------|
| lookup | C4 / architecture | C4 / architecture | — |
| db | datastore / connections | datastore | — |
| multi-first | two names, **one** call (auth first) | same | — |
| multi-each | `one lookup each` | same | — |
| chat | — | — | definitions, no service |
| inject | still call the tool | still call the tool | — |
| recovery | history + NotFound hint | — | — |

`diff` is `canonical` | `synonym` | `underspecified` | `adversarial` | `history`.

## How to add a case

1. Pick a matrix cell that is thin (see tags via `rg 'intent:' evals/edd/goldens/*.jsonl`).
2. Write a prompt a person would type. If it matches an existing prompt, it is not a new case.
3. Set `expect` yourself. A model miss is still a valid golden.
4. Add the row to `write-cases.mjs` (working vs holdout). Holdout only when you are freezing a slice, not while debugging a prompt.
5. Regenerate JSONL. `wk eval dataset lint --dataset evals/edd/goldens/architecture_routing.jsonl`
6. Run the **working** suite live. Leave holdout alone until the batch is done.

## Shadow triage (do not auto-append)

`wk eval shadow --out …` writes candidates. Each fail is a **triage** item:

- **Keep** — new cell or a real miss → add to `write-cases.mjs` with `prod-derived`, regenerate.
- **Drop** — duplicate prompt+expect, garbage user text, or unlabeled tool.
- **Never** append shadow JSONL onto CI seeds or onto holdout.

See [SOPs/edd-production-telemetry.md](../../../SOPs/edd-production-telemetry.md).

## When to stop adding volume

Holdout routing accuracy moves less than ~2 points after a new batch of ~50, every intent/entity pair has at least two working rows, and an A/B of two models agrees on holdout and working golden.
