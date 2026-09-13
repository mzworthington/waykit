import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { applyDoctorPlan } from './apply.js';
import { planRepoDoctor } from './hygiene.js';
import { evaluateOwnership } from './ownership.js';
import { stripAnsi } from '../cli/outcome.js';
import { printDoctorResult, runDoctor } from './run.js';
import type { GitHubPort } from './github.js';
import type { RepoView } from './ownership.js';

function communityKit(root: string): void {
  const community = path.join(root, 'templates', 'community');
  fs.mkdirSync(path.join(community, '.github', 'ISSUE_TEMPLATE'), { recursive: true });
  fs.mkdirSync(path.join(root, 'templates'), { recursive: true });
  fs.writeFileSync(path.join(root, 'templates', 'project-AGENTS.md'), 'handshake {{PROJECT}}\n', 'utf8');
  fs.writeFileSync(path.join(community, 'LICENSE.mit'), 'MIT {{YEAR}} {{COPYRIGHT_HOLDER}}\n', 'utf8');
  fs.writeFileSync(path.join(community, 'LICENSE.unlicense'), 'Unlicense\n', 'utf8');
  fs.writeFileSync(path.join(community, 'CONTRIBUTING.md'), 'contributing {{PROJECT}}\n', 'utf8');
  fs.writeFileSync(path.join(community, 'SECURITY.md'), 'security {{REPO}}\n', 'utf8');
  fs.writeFileSync(path.join(community, 'README.md'), '# {{PROJECT}}\n', 'utf8');
  fs.writeFileSync(path.join(community, '.github', 'pull_request_template.md'), 'pr\n', 'utf8');
  fs.writeFileSync(path.join(community, '.github', 'ISSUE_TEMPLATE', 'config.yml'), 'config\n', 'utf8');
  fs.writeFileSync(path.join(community, '.github', 'ISSUE_TEMPLATE', 'bug_report.yml'), 'bug\n', 'utf8');
  fs.writeFileSync(path.join(community, '.github', 'ISSUE_TEMPLATE', 'feature_request.yml'), 'feat\n', 'utf8');
  fs.writeFileSync(path.join(community, '.github', 'dependabot.yml'), 'dependabot\n', 'utf8');
  fs.mkdirSync(path.join(community, '.github', 'workflows'), { recursive: true });
  fs.writeFileSync(path.join(community, '.github', 'workflows', 'codeql.yml'), 'codeql\n', 'utf8');
}

describe('applyDoctorPlan', () => {
  it('writes missing community files and does not overwrite README or LICENSE', () => {
    const kit = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-doctor-src-'));
    communityKit(kit);
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-doctor-app-'));
    fs.writeFileSync(path.join(target, 'README.md'), '# keep-readme\n', 'utf8');
    fs.writeFileSync(path.join(target, 'LICENSE'), 'keep-license\n', 'utf8');
    const owned = evaluateOwnership({
      nameWithOwner: 'me/app',
      ownerLogin: 'me',
      isFork: false,
      isArchived: false,
      viewerPermission: 'ADMIN'
    });
    const plan = planRepoDoctor({
      repoClass: 'product',
      ownership: owned,
      existingRelPaths: new Set(['README.md', 'LICENSE']),
      write: true,
      installHook: false
    });
    const result = applyDoctorPlan(plan, {
      targetDir: target,
      kitRepoDir: kit,
      vars: {
        PROJECT: 'app',
        YEAR: '2026',
        COPYRIGHT_HOLDER: 'Pat',
        REPO: 'me/app',
        GITHUB_LOGIN: 'me'
      }
    });
    assert.equal(fs.readFileSync(path.join(target, 'README.md'), 'utf8'), '# keep-readme\n');
    assert.equal(fs.readFileSync(path.join(target, 'LICENSE'), 'utf8'), 'keep-license\n');
    assert.ok(result.written.includes('CONTRIBUTING.md'));
    assert.match(fs.readFileSync(path.join(target, 'CONTRIBUTING.md'), 'utf8'), /contributing app/);
    assert.match(fs.readFileSync(path.join(target, 'SECURITY.md'), 'utf8'), /me\/app/);
  });
});

describe('runDoctor --owned', () => {
  it('checks local clones and never writes unmatched remotes', () => {
    const kit = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-doctor-src-'));
    communityKit(kit);
    const scan = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-doctor-scan-'));
    const clone = path.join(scan, 'app');
    fs.mkdirSync(clone, { recursive: true });
    fs.writeFileSync(path.join(clone, 'README.md'), '# app\n', 'utf8');

    const appView: RepoView = {
      nameWithOwner: 'me/app',
      ownerLogin: 'me',
      isFork: false,
      isArchived: false,
      viewerPermission: 'ADMIN'
    };
    const otherView: RepoView = {
      nameWithOwner: 'me/other',
      ownerLogin: 'me',
      isFork: false,
      isArchived: false,
      viewerPermission: 'ADMIN'
    };
    const github: GitHubPort = {
      currentUser: () => 'me',
      viewFromCwd: () => undefined,
      listSources: () => [appView, otherView],
      remoteFileExists: (name, rel) => name === 'me/other' && rel === 'README.md'
    };

    const result = runDoctor({
      targetDir: scan,
      write: true,
      owned: true,
      scanDir: scan,
      repoClass: 'product',
      installHook: false,
      login: 'me',
      kitRepoDir: kit,
      github,
      copyrightHolder: 'Pat',
      year: '2026',
      listWorktrees: () => [clone],
      resolveOrigin: (dir) => (dir === clone ? 'me/app' : undefined)
    });
    const local = result.reports.find((r) => r.label === 'me/app');
    const remote = result.reports.find((r) => r.label === 'me/other');
    assert.ok(local);
    assert.equal(local.remoteOnly, false);
    assert.ok(local.written.includes('CONTRIBUTING.md'));
    assert.ok(remote);
    assert.equal(remote.remoteOnly, true);
    assert.equal(remote.written.length, 0);
    assert.equal(remote.plan.writeBlocked, true);
  });
});

describe('printDoctorResult', () => {
  it('hints wk align on non-kit reports', () => {
    const lines: string[] = [];
    printDoctorResult(
      {
        ok: true,
        error: undefined,
        reports: [
          {
            label: 'me/site',
            targetDir: '/tmp/site',
            written: [],
            remoteOnly: false,
            plan: {
              repoClass: 'site',
              ownership: evaluateOwnership({
                nameWithOwner: 'me/site',
                ownerLogin: 'me',
                isFork: false,
                isArchived: false,
                viewerPermission: 'ADMIN'
              }),
              ok: true,
              writeBlocked: false,
              skippedReason: undefined,
              findings: [{ relPath: 'README.md', status: 'ok' }],
              writes: [],
              installHooks: false
            }
          }
        ]
      },
      (msg) => lines.push(msg)
    );
    const text = stripAnsi(lines.join('\n'));
    assert.match(text, /wk align/);
    assert.match(text, /ok    doctor/);
    assert.equal(/handshake is aligned/i.test(text), false);
  });

  it('does not hint align for kit-only reports', () => {
    const lines: string[] = [];
    printDoctorResult(
      {
        ok: true,
        error: undefined,
        reports: [
          {
            label: 'me/waykit',
            targetDir: '/tmp/kit',
            written: [],
            remoteOnly: false,
            plan: {
              repoClass: 'kit',
              ownership: evaluateOwnership({
                nameWithOwner: 'me/waykit',
                ownerLogin: 'me',
                isFork: false,
                isArchived: false,
                viewerPermission: 'ADMIN'
              }),
              ok: true,
              writeBlocked: false,
              skippedReason: undefined,
              findings: [{ relPath: 'README.md', status: 'ok' }],
              writes: [],
              installHooks: false
            }
          }
        ]
      },
      (msg) => lines.push(msg)
    );
    assert.equal(/wk align/.test(lines.join('\n')), false);
  });
});
