import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import type { GitHubPort } from '../doctor/github.js';
import type { RepoView } from '../doctor/ownership.js';
import { stripAnsi } from '../cli/outcome.js';
import { printAlignOwnedResult, runAlignOwned } from './align_owned.js';

function write(root: string, rel: string, contents: string): void {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents, 'utf8');
}

const THIN = `# Agent Handshake

Standards live in ~/.agents.

Start from ~/.agents.AGENTS.md. **Do not** bulk-read philosophy, SOPs, or skills up front.
`.replace('~/.agents.AGENTS', '~/.agents/AGENTS');

function kitWithTemplates(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-align-owned-kit-'));
  const templates = path.join(root, 'templates');
  fs.mkdirSync(templates);
  fs.writeFileSync(path.join(templates, 'project-AGENTS.md'), THIN, 'utf8');
  fs.writeFileSync(path.join(templates, 'host-pointer.md'), '# shared-host-pointer\n', 'utf8');
  return root;
}

function alignedConsumer(dir: string): void {
  write(dir, 'AGENTS.md', THIN);
  write(dir, 'GEMINI.md', 'p\n');
  write(dir, 'CLAUDE.md', 'p\n');
  write(dir, '.windsurfrules', 'p\n');
  write(dir, '.cursorrules', 'p\n');
  write(dir, path.join('.github', 'copilot-instructions.md'), 'p\n');
  write(dir, path.join('.githooks', 'commit-msg'), 'ok\n');
  write(dir, '.mcp.json', JSON.stringify({ mcpServers: { 'kit-knowledge': { command: 'node' } } }));
}

function kitClone(dir: string): void {
  write(dir, path.join('bin', 'kit.ts'), '// kit\n');
  fs.mkdirSync(path.join(dir, 'skills'), { recursive: true });
  write(dir, 'AGENTS.md', 'Standards live in ~/.agents. Read CODING_PHILOSOPHY.md before phase work.\n');
}

function owned(name: string): RepoView {
  return {
    nameWithOwner: name,
    ownerLogin: name.split('/')[0] ?? 'me',
    isFork: false,
    isArchived: false,
    viewerPermission: 'ADMIN'
  };
}

describe('runAlignOwned', () => {
  it('requires gh login for --owned', () => {
    const github: GitHubPort = {
      currentUser: () => undefined,
      viewFromCwd: () => undefined,
      listSources: () => [],
      remoteFileExists: () => false
    };
    const result = runAlignOwned({
      targetDir: '/tmp',
      write: false,
      scanDir: '/tmp',
      login: undefined,
      kitRepoDir: kitWithTemplates(),
      github
    });
    assert.equal(result.ok, false);
    assert.match(result.error ?? '', /gh CLI/);
  });

  it('skips the kit clone, skips uncloned sources, and fails a drifted consumer', () => {
    const kit = kitWithTemplates();
    const scan = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-align-scan-'));
    const site = path.join(scan, 'site');
    const waykit = path.join(scan, 'waykit');
    const drifted = path.join(scan, 'drift');
    fs.mkdirSync(site);
    fs.mkdirSync(waykit);
    fs.mkdirSync(drifted);
    alignedConsumer(site);
    kitClone(waykit);

    const github: GitHubPort = {
      currentUser: () => 'me',
      viewFromCwd: () => undefined,
      listSources: () => [owned('me/site'), owned('me/waykit'), owned('me/drift'), owned('me/remote')],
      remoteFileExists: () => false
    };

    const result = runAlignOwned({
      targetDir: scan,
      write: false,
      scanDir: scan,
      login: 'me',
      kitRepoDir: kit,
      github,
      listWorktrees: () => [site, waykit, drifted],
      resolveOrigin: (dir) => {
        if (dir === site) return 'me/site';
        if (dir === waykit) return 'me/waykit';
        if (dir === drifted) return 'me/drift';
        return undefined;
      }
    });

    assert.equal(result.ok, false);
    const byLabel = Object.fromEntries(result.reports.map((r) => [r.label, r]));
    assert.equal(byLabel['me/site']?.kind, 'aligned');
    assert.equal(byLabel['me/site']?.ok, true);
    assert.equal(byLabel['me/waykit']?.kind, 'skip');
    assert.equal(byLabel['me/waykit']?.skipReason, 'kit');
    assert.equal(byLabel['me/drift']?.kind, 'aligned');
    assert.equal(byLabel['me/drift']?.ok, false);
    assert.equal(byLabel['me/remote']?.kind, 'skip');
    assert.equal(byLabel['me/remote']?.skipReason, 'not-cloned');
  });

  it('skips forks with the same ownership gate as doctor', () => {
    const kit = kitWithTemplates();
    const github: GitHubPort = {
      currentUser: () => 'me',
      viewFromCwd: () => undefined,
      listSources: () => [
        {
          nameWithOwner: 'me/fork',
          ownerLogin: 'me',
          isFork: true,
          isArchived: false,
          viewerPermission: 'ADMIN'
        }
      ],
      remoteFileExists: () => false
    };
    const result = runAlignOwned({
      targetDir: '/tmp',
      write: false,
      scanDir: '/tmp',
      login: 'me',
      kitRepoDir: kit,
      github,
      listWorktrees: () => [],
      resolveOrigin: () => undefined
    });
    assert.equal(result.ok, true);
    assert.equal(result.reports[0]?.kind, 'skip');
    assert.equal(result.reports[0]?.skipReason, 'fork');
  });
});

describe('printAlignOwnedResult', () => {
  it('prints a human-readable table and fail when a consumer misses', () => {
    const lines: string[] = [];
    const errors: string[] = [];
    printAlignOwnedResult(
      {
        ok: false,
        error: undefined,
        reports: [
          { label: 'me/waykit', kind: 'skip', skipReason: 'kit', targetDir: '/dev/waykit', ok: true, align: undefined },
          {
            label: 'me/site',
            kind: 'aligned',
            skipReason: undefined,
            targetDir: '/dev/site',
            ok: false,
            align: {
              ok: false,
              targetDir: '/dev/site',
              findings: [{ id: 'agents', label: 'AGENTS.md present', status: 'fail', detail: 'missing' }],
              written: []
            }
          }
        ]
      },
      (msg) => lines.push(msg),
      (msg) => errors.push(msg)
    );
    const text = [...lines, ...errors].join('\n');
    assert.match(text, /me\/waykit \(kit\)/);
    assert.match(text, /skip \(kit\)/);
    assert.match(text, /me\/site/);
    assert.match(text, /fail\s+AGENTS.md present/);
    assert.match(stripAnsi(errors.join('\n')), /fail  align/);
  });
});
