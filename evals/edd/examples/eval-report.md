# Agent Eval Report: Architecture Routing
**Date:** 2026-08-30
**Model:** `claude-3-5-sonnet-latest`
**Overall Pass Rate:** 95.0% (38/40)

## Performance Metrics
* **Total Tokens:** 14,205 (approx. $0.04)
* **Average Latency:** 840ms
* **Routing Accuracy:** 95.0%
* **Schema Adherence:** 100.0%

## Failure Traces

### Test ID: `route-08`
**Tags:** `edge-case`, `routing`
* **Prompt:** "What is the database for the payment system?"
* **Expected Tool:** `read_architecture_yaml`
* **Actual Tool:** *None (Conversational Response)*
* **LLM Output:** "I don't have access to your database, but typically payment systems use PostgreSQL..."
* **Diagnosis:** Tool Selection Failure. The model refused to use the tool and hallucinated a generic answer.
* **Suggested Fix:** Add a constraint to the system prompt instructing the agent to never guess architectural details and to always use the provided C4 tools.

### Test ID: `schema-03`
**Tags:** `extraction`, `schema`
* **Prompt:** "Check the architecture for the auth service and the payment api."
* **Expected Arguments:** `{"componentId": "auth-service"}`
* **Actual Arguments:** `{"componentId": ["auth-service", "payment-api"]}`
* **Diagnosis:** Schema Violation. The tool only accepts a string, but the model attempted to pass an array to handle the multi-intent prompt.
* **Suggested Fix:** Update the tool description to explicitly state that it can only be called for one component at a time, or update the tool's backend logic to accept arrays.

---

This file is the **canonical example** of `wk eval report --format md --out out/reports` output
(`out/reports/eval-report.md`, mirrored as `edd-report.md`). Live runs regenerate the same structure from suite results.
