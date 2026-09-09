# Demo: a miss becomes a failing eval

Walkthrough of `demo-edge` from the [demo suite](/evals/edd/demo.yaml). Case → red → report → green → CI gate. Scripted driver; no API key.

## 1. Case

JSONL case that should call the tool. User asks for the payment database. Expect `read_architecture_yaml` with `payment-api`, not a chatty guess.

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

## 2. Red

Red: routing assert fails. Fresh context, mocked tool. The model answered in prose instead of calling the tool.

```
$ wk eval run --suite evals/edd/demo.yaml --model scripted

FAIL demo-edge  tool_selection
  expected: read_architecture_yaml
  actual:   (no tool)
  note:     conversational reply guessed "PostgreSQL"

Routing accuracy: below threshold
```

## 3. Report

`wk eval report --format md` writes the failure trace into the PR, not a vibes summary.

```
### Test ID: demo-edge
Prompt: "What is the database for the payment system?"
Expected: read_architecture_yaml
Actual:   None (conversational)
Diagnosis: Tool selection failure. Model refused the tool and hallucinated.
Suggested fix: System prompt must never guess architecture; always use C4 tools.
```

## 4. Green

Update the system prompt / tool description. Same case. Same mocks. Pass when routing sticks.

```
# system_prompt.md (excerpt)
Never invent components or databases.
If the user asks about architecture, call read_architecture_yaml.

$ wk eval run --suite evals/edd/demo.yaml --model scripted
PASS demo-edge  tool_selection + argument_correctness
Routing accuracy: 100% (6/6)
```

## 5. Gate

CI uses the same scripted driver offline. Live models are optional for nightly depth.

```
$ wk eval ci --suite evals/edd/demo.yaml --threshold-routing 95 --out out/reports
PASS routing_accuracy 100% >= 95
PASS schema_match 100%
wrote out/reports/eval-report.md

# Optional closed loop after a prod miss
$ wk eval dataset from-trace --trace path/to/trace.json --out evals/edd/prod.jsonl
```
