# Evaluation Framework (`evals/`)

Kit evaluates two layers: **skill routing** (which specialist activates) and **agent tool use** (EDD alpha: how an agent calls tools in the harness). Use EDD when you change prompts, MCP schemas, or routing.

1. **Eval-Driven Development (`evals/edd/`):** YAML + JSONL harness for tool routing, schema match, LLM-as-a-judge, CI gates (`wk eval run|watch|report|ci|shadow|dataset|miss-rate`). Guide: [docs/edd.md](../docs/edd.md) · Suites: [edd/README.md](./edd/README.md).
2. **Co-located skill evals (`skills/<skill>/evals/eval.json`):** Single-skill output assertions next to `SKILL.md`.
3. **Centralized routing suites (`evals/suites/*.json`):** Cross-skill routing matrix, lifecycle roles, stack profiles (`wk eval`).

Together they guard: correct skill activation, architectural conformance, no prompt drift, and agent tool reliability above CI thresholds.

`pnpm wk validate` also requires every `agent-*` skill to appear in `evals/suites/routing-matrix.json` and `lifecycle-roles.json`, and every `lang-*` / `framework-*` / `profile-*` skill to appear in `stack-profiles.json`. Co-located `skills/*/evals/eval.json` files are not a substitute for those cross-skill suites.

---

## Directory Structure

```text
.
├── evals/
│   ├── README.md                  # Hybrid architecture overview
│   ├── schema.json                # JSON Schema for skill-trigger suites
│   ├── edd/                       # Eval-Driven Development (YAML + JSONL)
│   │   ├── README.md
│   │   ├── architecture_routing.yaml
│   │   └── … 
│   └── suites/
│       ├── lifecycle-roles.json   # Kit-wide test cases for agent-* specialist roles
│       ├── stack-profiles.json    # Kit-wide test cases for lang-* and framework-* profiles
│       └── routing-matrix.json    # Cross-role routing classification accuracy tests
└── skills/
    ├── agent-spec/
    │   ├── SKILL.md
    │   └── evals/
    │       └── eval.json          # Co-located unit eval benchmark
    ...
```

---

## Test Case Structure

Every eval test case is defined in JSON adhering to `evals/schema.json`:

```json
{
  "suite": "agent-spec-co-located",
  "description": "Co-located evaluation benchmark for agent-spec BDD specification skill",
  "version": "1.0.0",
  "test_cases": [
    {
      "id": "EVAL-SPEC-001",
      "name": "BDD Requirement Specification",
      "description": "Verifies feature requests generate Gherkin scenarios with ubiquitous language without implementation code.",
      "target_skill": "agent-spec",
      "prompt": "Create acceptance criteria for adding multi-tenant workspace sharing.",
      "context": {
        "active_phase": "spec"
      },
      "assertions": {
        "required_triggers": ["acceptance criteria", "specification"],
        "required_patterns": ["Scenario:", "Given ", "When ", "Then "],
        "forbidden_patterns": ["```typescript", "import {", "ASCII art"],
        "required_output_sections": ["Bounded Contexts", "Gherkin Acceptance Scenarios", "Cross-Functional Criteria"]
      }
    }
  ]
}
```

---

## Running Validation

Validate schema compliance, syntax, and skill reference integrity across both centralized suites and co-located skill evals:

```bash
pnpm wk validate
```

Ensure skill folder layout rules remain valid:

```bash
pnpm wk verify
```

Run the CLI unit tests (`wk /src/**/*.test.ts`) and the scripted routing CI gate (YAML/JSONL under `evals/edd/`):

```bash
pnpm test
pnpm wk eval ci --suite evals/edd/architecture_routing.yaml --threshold-routing 95 --model scripted --out out/reports
pnpm wk eval ci --suite evals/edd/kit_knowledge.yaml --threshold-routing 95 --model scripted --out out/reports
pnpm wk eval ci --suite evals/edd/cloudflare_ops.yaml --threshold-routing 95 --model scripted --out out/reports
```

`wk eval ci` with the scripted driver runs architecture routing, model routing, kit-knowledge MCP, Cloudflare ops, safety, self-correction, and terminal-fallback suites in `wk check`. That path is what Cursor and Copilot users run; no provider API key. Live paraphrases live behind the `requires-live` tag and [`.github/workflows/edd-live.yml`](../.github/workflows/edd-live.yml). Key order and IDE vs HTTP driver: [docs/edd.md](../docs/edd.md#cursor-copilot-and-api-keys).