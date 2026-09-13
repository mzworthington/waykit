import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { classifyRepo, communityRelPaths, planRepoDoctor } from './hygiene.js';
import { evaluateOwnership } from './ownership.js';

describe('classifyRepo', () => {
  it('prefers kit layout, then template, then pulumi-only, then docs site', () => {
    assert.equal(classifyRepo({ hasKitLayout: true }), 'kit');
    assert.equal(classifyRepo({ hasTemplateName: true }), 'template');
    assert.equal(classifyRepo({ hasPulumiWithoutApp: true }), 'dns');
    assert.equal(classifyRepo({ hasDocsSiteWithoutApp: true }), 'site');
    assert.equal(classifyRepo({}), 'product');
  });
});

describe('communityRelPaths', () => {
  it('requires CODEOWNERS only for the kit class', () => {
    assert.ok(communityRelPaths('kit').includes('.github/CODEOWNERS'));
    assert.equal(communityRelPaths('product').includes('.github/CODEOWNERS'), false);
    for (const rel of [
      'README.md',
      'LICENSE',
      'CONTRIBUTING.md',
      'SECURITY.md',
      'AGENTS.md',
      '.github/pull_request_template.md',
      '.github/ISSUE_TEMPLATE/config.yml',
      '.github/ISSUE_TEMPLATE/bug_report.yml',
      '.github/ISSUE_TEMPLATE/feature_request.yml',
      '.github/dependabot.yml',
      '.github/workflows/codeql.yml'
    ]) {
      assert.ok(communityRelPaths('product').includes(rel), rel);
    }
  });
});

describe('planRepoDoctor', () => {
  const owned = evaluateOwnership({
    nameWithOwner: 'mzworthington/app',
    ownerLogin: 'mzworthington',
    isFork: false,
    isArchived: false,
    viewerPermission: 'ADMIN'
  });

  it('reports missing community files and never overwrites existing ones', () => {
    const plan = planRepoDoctor({
      repoClass: 'product',
      ownership: owned,
      existingRelPaths: new Set(['README.md', 'LICENSE']),
      write: true,
      installHook: false
    });
    assert.equal(plan.ok, false);
    assert.equal(plan.writeBlocked, false);
    assert.equal(plan.writes.find((w) => w.relPath === 'README.md'), undefined);
    assert.equal(plan.writes.find((w) => w.relPath === 'LICENSE'), undefined);
    assert.ok(plan.writes.some((w) => w.relPath === 'CONTRIBUTING.md'));
    assert.ok(plan.findings.some((f) => f.relPath === 'README.md' && f.status === 'ok'));
    assert.ok(plan.findings.some((f) => f.relPath === 'CONTRIBUTING.md' && f.status === 'missing'));
  });

  it('blocks writes and hooks on forks', () => {
    const fork = evaluateOwnership({
      nameWithOwner: 'other/fork',
      ownerLogin: 'other',
      isFork: true,
      isArchived: false,
      viewerPermission: 'ADMIN'
    });
    const plan = planRepoDoctor({
      repoClass: 'product',
      ownership: fork,
      existingRelPaths: new Set(),
      write: true,
      installHook: true
    });
    assert.equal(plan.writeBlocked, true);
    assert.equal(plan.writes.length, 0);
    assert.equal(plan.installHooks, false);
    assert.equal(plan.ok, true);
    assert.equal(plan.skippedReason, 'fork');
  });

  it('installs hooks only when writing an owned repo', () => {
    const checkOnly = planRepoDoctor({
      repoClass: 'kit',
      ownership: owned,
      existingRelPaths: new Set(communityRelPaths('kit')),
      write: false,
      installHook: true
    });
    assert.equal(checkOnly.installHooks, false);
    assert.equal(checkOnly.ok, true);

    const writeHooks = planRepoDoctor({
      repoClass: 'kit',
      ownership: owned,
      existingRelPaths: new Set(communityRelPaths('kit')),
      write: true,
      installHook: true
    });
    assert.equal(writeHooks.installHooks, true);
  });

  it('scores missing files on a local not-admin checkout and still skips them in fleet mode', () => {
    const notAdmin = evaluateOwnership({
      nameWithOwner: 'acme/app',
      ownerLogin: 'acme',
      isFork: false,
      isArchived: false,
      viewerPermission: 'WRITE'
    });
    const local = planRepoDoctor({
      repoClass: 'product',
      ownership: notAdmin,
      existingRelPaths: new Set(['README.md']),
      write: true,
      installHook: true,
      mode: 'local'
    });
    assert.equal(local.skippedReason, undefined);
    assert.equal(local.writeBlocked, true);
    assert.ok(local.findings.some((f) => f.relPath === 'CONTRIBUTING.md' && f.status === 'missing'));

    const fleet = planRepoDoctor({
      repoClass: 'product',
      ownership: notAdmin,
      existingRelPaths: new Set(['README.md']),
      write: true,
      installHook: true,
      mode: 'fleet'
    });
    assert.equal(fleet.skippedReason, 'not-admin');
    assert.equal(fleet.findings.length, 0);
  });
});

describe('kit checkout community files', () => {
  it('has every kit-class community path on disk', () => {
    const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    for (const rel of communityRelPaths('kit')) {
      assert.ok(fs.existsSync(path.join(kitRoot, rel)), rel);
    }
  });
});
