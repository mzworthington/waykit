export type CiFailureClass =
  | 'flake'
  | 'config-drift'
  | 'tool-missing'
  | 'auth'
  | 'product-bug'
  | 'unknown';

export interface CiClassification {
  class: CiFailureClass;
  reason: string;
  next: string;
}

const PATTERNS: Array<{
  class: CiFailureClass;
  test: (log: string) => boolean;
  reason: string;
  next: string;
}> = [
  {
    class: 'config-drift',
    test: (log) => /ERR_PNPM_BROKEN_LOCKFILE|duplicated mapping key/.test(log),
    reason:
      'pnpm-lock.yaml has duplicate mapping keys, usually from merging overlapping Dependabot lockfile PRs.',
    next: 'Do not retry as a registry flake. Regenerate pnpm-lock.yaml from current package.json and land remaining bumps in one lockfile rewrite.'
  },
  {
    class: 'config-drift',
    test: (log) => /ERR_PNPM_NO_PKG_MANIFEST|No package\.json found in \//.test(log),
    reason:
      'pnpm install ran at the repository root while package.json lives in a nested workspace (often app/).',
    next: 'Do not wrap this in a 504 retry. Pass working-directory to pnpm/setup (job defaults.run.working-directory does not apply to uses:). Prefer that over deprecated package-json-file.'
  },
  {
    class: 'flake',
    test: (log) =>
      /504 Gateway Timeout|HTTP\/2 504|ECONNRESET|ETIMEDOUT/.test(log) &&
      /Downloading pnpm|registry\.npmjs\.org\/@pnpm\//.test(log),
    reason: 'Transient npm registry failure while downloading the pnpm binary.',
    next: 'Retry the pnpm binary download once. Do not retry unrelated install/cwd errors as if they were 504s.'
  },
  {
    class: 'config-drift',
    test: (log) =>
      /non-fast-forward/.test(log) &&
      /chore\(changelog\)|CHANGELOG\.md/.test(log),
    reason:
      'Promote committed CHANGELOG.md on a stale main tip; a sibling run or re-run already advanced the branch.',
    next: 'Retry the push once after fetching latest main. Do not --force. Use bin/release.sh commit-changelog.'
  },
  {
    class: 'auth',
    test: (log) =>
      /Resource not accessible|403 Forbidden|permission denied|secrets? (is|are) not available/i.test(
        log
      ),
    reason: 'The job lacked permission or a required secret.',
    next: 'Fix token/environment permissions. Do not change product code.'
  },
  {
    class: 'tool-missing',
    test: (log) => /command not found|No such file or directory/.test(log),
    reason: 'A required CLI or binary is missing on the runner.',
    next: 'Install the tool in the workflow (or document the blocker). Do not treat as a product regression.'
  },
  {
    class: 'product-bug',
    test: (log) =>
      /AssertionError|FAIL {2}|Error: Test failed|expected .* to (be|equal)/i.test(log),
    reason: 'A test assertion failed after setup succeeded.',
    next: 'Reproduce the failing test locally. Do not start with workflow retries.'
  }
];

export function classifyCiLog(log: string): CiClassification {
  for (const pattern of PATTERNS) {
    if (pattern.test(log)) {
      return { class: pattern.class, reason: pattern.reason, next: pattern.next };
    }
  }
  return {
    class: 'unknown',
    reason: 'No known failure signature in the log excerpt.',
    next: 'Read the failing step; classify as flake | config-drift | tool-missing | auth | product-bug before editing.'
  };
}

export function formatCiClassification(result: CiClassification): string {
  return [
    '== Classification ==',
    `class: ${result.class}`,
    `reason: ${result.reason}`,
    `next: ${result.next}`
  ].join('\n');
}
