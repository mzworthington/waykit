# Before / after: one routing miss

Product proof for the [demo suite](../demo.yaml). Same user prompt, two outcomes.

## Prompt

> What is the database for the payment system?

## Before (eyeballing the chat)

| | |
| :--- | :--- |
| **Agent reply** | "I don't have access to your database, but typically payment systems use PostgreSQL…" |
| **Tool call** | None |
| **What you ship** | A confident hallucination |
| **How you notice** | A human scrolls the transcript, or a customer does |

No case file. No assert. No merge gate. The miss evaporates when the chat scrolls away.

## After (EDD case + CI gate)

JSONL case (`demo-edge` in [demo.jsonl](../demo.jsonl)):

```json
{
  "id": "demo-edge",
  "prompt": "What is the database for the payment system?",
  "expect": {
    "tool": "read_architecture_yaml",
    "arguments_contains": { "componentId": "payment-api" }
  }
}
```

| | |
| :--- | :--- |
| **Expected** | Call `read_architecture_yaml` with `payment-api` |
| **Red** | `FAIL demo-edge tool_selection`: conversational reply, no tool |
| **Green** | Prompt/schema tightened; case passes on the scripted driver |
| **Gate** | `wk eval ci --suite evals/edd/demo.yaml --threshold-routing 95` blocks the PR under 95% |

```bash
wk eval run --suite evals/edd/demo.yaml --model scripted
wk eval ci --suite evals/edd/demo.yaml --threshold-routing 95 --out out/reports
wk eval report --format md --out out/reports
```

Walk the same story in the browser: [waykit.dev/docs/edd](https://waykit.dev/docs/edd).
