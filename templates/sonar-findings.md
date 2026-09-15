# SonarQube findings

Phase handover for [sonarqube-findings](../SOPs/sonarqube-findings.md). Fill after `wk mcp sonar`. Apply `fix` rows in this session when the user asked to fix. Never create Linear issues from this table unless the operator asks after restore `wk mcp default`.

| Field | Value |
|-------|-------|
| **Project** | `<project-name>` |
| **Sonar project** | key only — no tokens |
| **Date** | YYYY-MM-DD |
| **Status** | intake \| applying \| done \| blocked |

## Rows

| Key / rule | Location | Type | Disposition (`fix` / `skip` / `ask`) | Next agent | Notes |
|------------|----------|------|--------------------------------------|------------|-------|
| | | | | | |

Next agent: `agent-debug`, `agent-tdd`, `agent-prune`, parent (security playbook), or skip.

## Policy skips this pass

List GitHub Actions SHA-pin (and any other SOP skip) rows that were not implemented. Keep `uses: owner/action@vN`.

## Coverage

Mark done or n/a (reason). No tokens.

| Query | Done |
|-------|------|
| Issues (bug / vuln / smell) | |
| Security hotspots | |
| Quality gate | |

## Session notes

- Profile: `wk mcp sonar`
- Restore: `wk mcp default` when done
- Missing Sonar tools: BLOCKED; do not invent issue lists
- Do not add `agent-sonarqube`
- Do not add `NOSONAR` for policy skips
