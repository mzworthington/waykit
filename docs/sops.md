# Standard operating procedures

Agent-facing procedures. Do not duplicate them in `/docs`; link here when a guide needs the steps.

| SOP | Use when |
|-----|----------|
| [Eval-driven development (alpha)](/SOPs/eval-driven-development) | Writing or gating agent evals |
| [EDD production telemetry](/SOPs/edd-production-telemetry) | Turning live misses into cases |
| [Behavior catalog and XFN](/SOPs/behavior-catalog-and-xfn) | Inventorying tests before a change |
| [Context budget](/SOPs/context-budget) | Always-on files are too large |
| [MCP library](/SOPs/mcp-library) | Composing one MCP profile |
| [Hypothesis-driven development](/SOPs/hypothesis-driven-development) | Product bets, experiments, feature flags, kill criteria |
| [Hypothesis-driven debug](/SOPs/hypothesis-driven-debug) | A failure needs RCA, not more logging |
| [API contracts](/SOPs/api-contracts) | Published HTTP or event contracts |
| [DB migration](/SOPs/db-migration) | Expand/contract schema changes |
| [Release](/SOPs/release) | Shipping with a conventional title |
| [Conventional commits](/SOPs/conventional-commits) | Commit message output (ticket id when in play); stay on main, uncommitted |
| [Linear ticket execution](/SOPs/linear-ticket-workflow) | Claim In Progress, assign host agent, commit message with id |
| [Host subagent launch](/SOPs/subagent-launch) | Parent uses `wk agents launch-prompt`; handover is the contract |
| [TDD Guard hooks](/SOPs/tdd-guard) | Cursor/Claude red-before-green (`wk tdd-guard`) |
| [External skills](/SOPs/external-skills) | Pinning upstream skills |
| [Complexity hotspots](/SOPs/complexity-hotspots) | Pruning a hot path, or a git crime-scene report → Linear after a human gate |
| [Cloudflare analytics ops](/SOPs/cloudflare-analytics-ops) | RUM / beacon diagnosis |
| [PostHog product analytics](/SOPs/posthog-product-analytics) | Cookieless SDK, privacy notice, official MCP |
| [Product signal intake](/SOPs/product-signal-intake) | Two-session PostHog findings → human gate → Linear |

Operator narrative: [What Waykit gives you](/docs/kit).
