# SonarQube findings

Phase handover for [sonarqube-findings](../SOPs/sonarqube-findings.md). Fill after `wk mcp sonar`. Apply `fix` rows in this session when the user asked to fix. A quality-loops scout files `fix` rows only after restore `wk mcp default`. Do not create Linear issues while the sonar profile is on. Do not open a PR.

| Field | Value |
|-------|-------|
| **Project** | `<project-name>` |
| **Sonar project** | key only — no tokens |
| **Date** | YYYY-MM-DD |
| **Status** | intake \| applying \| filing \| done \| blocked |

## Rows

| Key / rule | Location | Type | Disposition (`fix` / `skip` / `ask`) | Work type | Next agent | Notes |
|------------|----------|------|--------------------------------------|-----------|------------|-------|
| | | | | Bug / Security / Improvement / — | | |

Work type when filing: BUG → Bug; VULNERABILITY or confirmed hotspot → Security; maintainability `fix` → Improvement. Next agent: `agent-debug`, `agent-tdd`, `agent-prune`, parent (security playbook), or skip.

## Policy skips this pass

List GitHub Actions SHA-pin (and any other SOP skip) rows that were not implemented. Keep `uses: owner/action@vN`. No ticket. No `NOSONAR`.

## Coverage

Mark done or n/a (reason). No tokens.

| Query | Done |
|-------|------|
| Issues (bug / vuln / smell) | |
| Security hotspots | |
| Quality gate | |

## Session notes

- Profile: `wk mcp sonar`
- Restore: `wk mcp default` before Linear create
- Missing Sonar tools: BLOCKED; do not invent issue lists
- Do not add `agent-sonarqube`
- Do not add `NOSONAR` for policy skips
- Scout file: one ticket per `fix` row; skip rows stay off the board
