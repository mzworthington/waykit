import assert from 'node:assert/strict';
import { execFileSync, spawnSync, type SpawnSyncReturns } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const releaseSh = path.join(kitRoot, 'bin/release.sh');
const ciYml = path.join(kitRoot, '.github/workflows/ci.yml');
const fixtures: string[] = [];

after(() => {
  for (const dir of fixtures) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function initPair(): { origin: string; work: string } {
  const root = mkdtempSync(path.join(tmpdir(), 'alk-changelog-'));
  fixtures.push(root);
  const origin = path.join(root, 'origin.git');
  const work = path.join(root, 'work');

  execFileSync('git', ['init', '--bare', '-b', 'main', origin], { encoding: 'utf8' });
  execFileSync('git', ['clone', origin, work], { encoding: 'utf8' });
  git(work, 'checkout', '-B', 'main');
  git(work, 'config', 'user.email', 'test@example.com');
  git(work, 'config', 'user.name', 'Changelog Test');
  writeFileSync(path.join(work, 'CHANGELOG.md'), '# Changelog\n\nold\n');
  git(work, 'add', 'CHANGELOG.md');
  git(work, 'commit', '-m', 'feat: seed');
  git(work, 'push', '-u', 'origin', 'main');
  return { origin, work };
}

function runCommitChangelog(
  cwd: string,
  env: NodeJS.ProcessEnv = {},
  changelogBody = '# Changelog\n\nnew\n'
): SpawnSyncReturns<string> {
  const desired = path.join(cwd, 'desired-changelog.md');
  const render = path.join(cwd, 'render-changelog.sh');
  writeFileSync(desired, changelogBody);
  writeFileSync(render, `#!/bin/bash\ncp "${desired}" CHANGELOG.md\n`);
  execFileSync('chmod', ['+x', render]);
  return spawnSync('bash', [releaseSh, 'commit-changelog'], {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      CI: 'true',
      HUSKY: '0',
      GITHUB_REF_NAME: 'main',
      CHANGELOG_CMD: render,
      RELEASE_ROOT: cwd,
      ...env,
    },
  });
}

describe('Promote changelog push (ci.yml)', () => {
  it('commits changelog through release.sh so a stale main tip can retry', () => {
    const yml = readFileSync(ciYml, 'utf8');
    assert.match(yml, /bin\/release\.sh commit-changelog/);
    assert.doesNotMatch(yml, /git push origin HEAD\s*$/m);
    assert.doesNotMatch(yml, /git push[^\n]*--force/);
  });
});

describe('bin/release.sh commit-changelog', () => {
  it('refuses --force and documents a single retry', () => {
    const src = readFileSync(releaseSh, 'utf8');
    assert.match(src, /commit-changelog/);
    assert.match(src, /retrying once|Retrying once/i);
    assert.doesNotMatch(src, /git push[^\n]*--force/);
  });

  it('no-ops when the regenerated changelog already matches origin/main', () => {
    const { work } = initPair();
    const before = git(work, 'rev-parse', 'HEAD').trim();
    const result = runCommitChangelog(work, {}, '# Changelog\n\nold\n');
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /already up to date/i);
    assert.equal(git(work, 'rev-parse', 'HEAD').trim(), before);
    assert.equal(git(work, 'rev-parse', 'origin/main').trim(), before);
  });

  it('commits and pushes when CHANGELOG.md changed', () => {
    const { work } = initPair();
    const result = runCommitChangelog(work);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const subject = git(work, 'log', '-1', '--format=%s', 'origin/main').trim();
    assert.equal(subject, 'chore(changelog): regenerate from conventional commits');
    assert.equal(
      readFileSync(path.join(work, 'CHANGELOG.md'), 'utf8'),
      '# Changelog\n\nnew\n'
    );
  });

  it('succeeds when origin already advanced with the same changelog (re-run after sibling Promote)', () => {
    const { origin, work } = initPair();
    const sibling = path.join(path.dirname(work), 'sibling');
    execFileSync('git', ['clone', origin, sibling], { encoding: 'utf8' });
    git(sibling, 'config', 'user.email', 'bot@example.com');
    git(sibling, 'config', 'user.name', 'github-actions[bot]');
    writeFileSync(path.join(sibling, 'CHANGELOG.md'), '# Changelog\n\nnew\n');
    git(sibling, 'add', 'CHANGELOG.md');
    git(sibling, 'commit', '-m', 'chore(changelog): regenerate from conventional commits');
    git(sibling, 'push', 'origin', 'main');

    // Stale checkout at the feat SHA with a regenerated working tree (Actions re-run).
    git(work, 'reset', '--hard', 'HEAD');
    const result = runCommitChangelog(work);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(result.stdout, /already up to date/i);
    assert.equal(git(work, 'rev-parse', 'HEAD').trim(), git(work, 'rev-parse', 'origin/main').trim());
    assert.equal(git(origin, 'rev-list', '--count', 'main').trim(), '2');
  });

  it('retries once when the first push is rejected because main advanced', () => {
    const { origin, work } = initPair();
    const sibling = path.join(path.dirname(work), 'sibling');
    execFileSync('git', ['clone', origin, sibling], { encoding: 'utf8' });
    git(sibling, 'config', 'user.email', 'bot@example.com');
    git(sibling, 'config', 'user.name', 'github-actions[bot]');

    const raced = path.join(path.dirname(work), 'raced-changelog.md');
    writeFileSync(raced, '# Changelog\n\nraced\n');
    const hook = path.join(work, '.git/hooks/pre-push');
    writeFileSync(
      hook,
      `#!/bin/bash
set -euo pipefail
marker="$(dirname "$0")/push-rejected"
if [[ ! -f "$marker" ]]; then
  touch "$marker"
  git -C '${sibling}' pull --ff-only
  cp '${raced}' '${sibling}/CHANGELOG.md'
  git -C '${sibling}' add CHANGELOG.md
  git -C '${sibling}' commit -m 'feat: land while promote pushes'
  git --git-dir='${origin}' fetch '${sibling}' '+refs/heads/main:refs/heads/main'
  echo 'simulated non-fast-forward' >&2
  exit 1
fi
`
    );
    execFileSync('chmod', ['+x', hook]);

    const result = runCommitChangelog(work);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    assert.match(`${result.stdout}\n${result.stderr}`, /retrying once/i);
    const log = git(work, 'log', '--format=%s', 'origin/main');
    assert.match(log, /chore\(changelog\): regenerate from conventional commits/);
    assert.match(log, /feat: land while promote pushes/);
    assert.equal(
      readFileSync(path.join(work, 'CHANGELOG.md'), 'utf8'),
      '# Changelog\n\nnew\n'
    );
  });

  it('refuses to run outside CI without an explicit override', () => {
    const { work } = initPair();
    const result = runCommitChangelog(work, { CI: '', FORCE_CHANGELOG_PUSH: '' });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /CI|FORCE_CHANGELOG_PUSH/);
  });
});
