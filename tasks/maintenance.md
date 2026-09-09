---
title: Codebase Maintenance Schedule
kind: task
frequency: weekly
triggers:
  - maintenance
  - dependency audit
  - housekeeping
---
# Codebase Maintenance Schedule

Run this routine checklist weekly to audit codebase health, security vulnerabilities, and dependency drift.

- [ ] **Dependency Audit**
  - Run package vulnerability check: `pnpm audit` / `npm audit` / `dotnet list package --vulnerable`.
  - Check for outdated dependencies: `pnpm outdated`.
- [ ] **Static Code Analysis**
  - Run linter checks: `pnpm lint` / `mvn checkstyle:check`.
  - Look for dead code / unused exports: `npx knip` or IDE analysis.
- [ ] **Behavior catalog & XFN health**
  - Run unit/slice suites and any CI XFN jobs (Playwright, axe, security regression, k6/Gatling/NBomber).
  - Prefer risk-based catalog health over raw coverage % alone: critical journeys and apply-matrix suites green; no skipped XFN qualities without rationale in recent handovers.
  - If the project tracks coverage, note drift but do not treat coverage % as a substitute for the XFN matrix.
- [ ] **Test Coverage Verification** (optional complement)
  - Execute test suite with coverage logging enabled when the project has an established threshold.
  - Investigate large drops, but fix missing catalog/XFN cases first.
- [ ] **Secrets & Config Audit**
  - Check repository status to ensure no local `.env` files or secrets are tracked in git history.
  - Audit `.env.example` configurations to verify all newly added application variables are documented.
- [ ] **MCP library health**
  - Confirm `mcps/catalog.json` ids match folders under `mcps/servers/`.
  - Re-compose the default profile (`wk mcp default`) and ensure no secrets were committed into fragments.
  - Drop or disable unused servers from profiles so agents keep a small tool surface.
