/**
 * Version-scoped GitHub Release notes from git-cliff JSON.
 * CHANGELOG.md stays date-grouped via bin/changelog-render.mjs; this path groups by
 * conventional-commit type for a single tag range and never emits [unreleased].
 */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { kitRootFrom } from '../shared/paths.js';
import { trustedBin, trustedSpawnEnv } from '../shared/trusted_bin.js';

export type CliffCommit = {
  message: string;
  raw_message?: string;
  scope?: string | null;
  breaking?: boolean;
  group?: string;
};

export type CliffRelease = {
  version?: string | null;
  commits?: CliffCommit[];
};

const GROUP_RANK = new Map([
  ['🚀 Features', 0],
  ['🐛 Bug Fixes', 1],
  ['⚙️ Refactoring & Performance', 2],
  ['🧰 Maintenance & Dependencies', 3],
  ['📚 Documentation', 4],
  ['🧪 Testing', 5],
  ['🎨 Styling', 6],
  ['◀️ Revert', 7],
  ['💼 Other', 8],
]);

export const SKIP_MESSAGE = /^(chore\(release\)|chore\(changelog\)|chore\(derived\)):/i;

export function stripHtmlComments(input: string): string {
  let result = '';
  let i = 0;
  while (i < input.length) {
    const open = input.indexOf('<!--', i);
    if (open === -1) {
      result += input.slice(i);
      break;
    }
    result += input.slice(i, open);
    const close = input.indexOf('-->', open + 4);
    if (close === -1) {
      result += input.slice(open);
      break;
    }
    i = close + 3;
  }
  return result;
}

export function stripGroupTags(group: string): string {
  return stripHtmlComments(group).trim();
}

export function formatBullet(commit: CliffCommit): string {
  const scope = commit.scope ? `*(${commit.scope})* ` : '';
  const breaking = commit.breaking ? '[**breaking**] ' : '';
  const message = commit.message.charAt(0).toUpperCase() + commit.message.slice(1);
  return `- ${scope}${breaking}${message}`;
}

/**
 * Build git-cliff RANGE argument.
 * First release (empty since): until-ref alone (caller should resolve to a SHA;
 * bare tags like `v1.0.0` fail cliff's OID parser).
 * Subsequent: since..until.
 */
export function cliffCommitRange(since: string | undefined, until = 'HEAD'): string {
  const end = until.trim() || 'HEAD';
  if (since && since.trim()) return `${since.trim()}..${end}`;
  return end;
}

function gitRevParse(ref: string, root: string): string {
  return execFileSync(trustedBin('git'), ['rev-parse', `${ref}^{commit}`], {
    cwd: root,
    encoding: 'utf8',
    env: trustedSpawnEnv()
  }).trim();
}

/**
 * Resolve symbolic refs/tags to SHAs so git-cliff accepts the range.
 * First release uses the tip SHA alone (all history reachable from until).
 */
export function resolveCliffRange(
  since: string | undefined,
  until = 'HEAD',
  options: { root?: string } = {},
): string {
  const root =
    options.root ?? kitRootFrom(import.meta.url);
  const endSha = gitRevParse(until.trim() || 'HEAD', root);
  if (since && since.trim()) {
    const startSha = gitRevParse(since.trim(), root);
    return `${startSha}..${endSha}`;
  }
  return endSha;
}

/**
 * Render grouped markdown body for one release (no version heading, no [unreleased]).
 */
export function renderReleaseNotes(releases: CliffRelease[]): string {
  /** @type {Map<string, { bullets: string[], messages: Set<string> }>} */
  const byGroup = new Map<string, { bullets: string[]; messages: Set<string> }>();

  for (const release of releases) {
    for (const commit of release.commits ?? []) {
      const raw = commit.raw_message ?? commit.message ?? '';
      if (SKIP_MESSAGE.test(raw)) continue;

      const group = stripGroupTags(commit.group ?? '💼 Other');
      const bullet = formatBullet(commit);

      if (!byGroup.has(group)) byGroup.set(group, { bullets: [], messages: new Set() });
      const bucket = byGroup.get(group)!;
      if (bucket.messages.has(commit.message)) continue;
      bucket.messages.add(commit.message);
      bucket.bullets.push(bullet);
    }
  }

  const lines: string[] = [];
  const groups = [...byGroup.entries()].sort(
    ([a], [b]) => (GROUP_RANK.get(a) ?? 99) - (GROUP_RANK.get(b) ?? 99),
  );

  for (const [group, { bullets }] of groups) {
    lines.push(`### ${group}`, '');
    lines.push(...bullets, '');
  }

  const body = lines.join('\n').trimEnd();
  if (body.toLowerCase().includes('[unreleased]')) {
    throw new Error('release notes must not contain [unreleased]');
  }
  return body;
}

export function loadCliffJson(
  range: string,
  options: { root?: string; cliffBin?: string; cliffConfig?: string } = {},
): CliffRelease[] {
  const root =
    options.root ?? kitRootFrom(import.meta.url);
  const cliffBin = options.cliffBin ?? join(root, 'node_modules/.bin/git-cliff');
  const cliffConfig = options.cliffConfig ?? join(root, 'cliff.toml');
  const raw = execFileSync(cliffBin, ['-c', cliffConfig, '-x', '--', range], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
  });
  return JSON.parse(raw) as CliffRelease[];
}

export function renderNotesForRange(
  since: string | undefined,
  until = 'HEAD',
  options: { root?: string; cliffBin?: string; cliffConfig?: string } = {},
): string {
  const range = resolveCliffRange(since, until, { root: options.root });
  const releases = loadCliffJson(range, options);
  return renderReleaseNotes(releases);
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

export function main(argv: string[] = process.argv.slice(2)): void {
  const since = argv[0] ?? '';
  const until = argv[1] ?? 'HEAD';
  const body = renderNotesForRange(since || undefined, until);
  process.stdout.write(body ? `${body}\n` : '\n');
}

if (isMainModule()) {
  main();
}
