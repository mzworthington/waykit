# Debug tooling map

Read when choosing how to gather evidence. Procedure stays in [SOPs/hypothesis-driven-debug.md](../../../SOPs/hypothesis-driven-debug.md).

| Need | Tool |
|------|------|
| Init board | `kit debug-board` |
| Failed Actions logs | `kit debug-ci` ([gh](https://cli.github.com/)) |
| Prior cloud-agent context | `cursor-cloud` MCP: `list-cloud-agents` → `batch-fetch-details` (transcripts via subagents) |
| Instrumented deep dive | Cursor **debug** subagent / Debug mode (hypothesis + runtime logs) |
| UI verify | computerUse / browser / RecordScreen - required for visual bugs |
| Domain regression | Vitest/Jest/etc. in the owning package |
