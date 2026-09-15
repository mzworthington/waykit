import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { decideVendorLoop, vendorAlertFingerprint } from './vendor_pr.js';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function readKit(rel: string): string {
  return fs.readFileSync(path.join(kitRoot, rel), 'utf8');
}

describe('vendor PR loop (Dependabot / CodeQL)', () => {
  it('keeps an open Dependabot PR on hygiene and does not rewrite the lockfile', () => {
    assert.deepEqual(decideVendorLoop({ kind: 'dependabot-pr' }), {
      action: 'hygiene',
      rewriteLockfile: false,
      autoMerge: false
    });
  });

  it('updates the existing vendor PR for a high alert with a clear file and line', () => {
    const decision = decideVendorLoop({
      kind: 'alert',
      source: 'codeql',
      repo: 'waykit',
      alertNumber: 17,
      severity: 'high',
      file: 'kit/src/cli.ts',
      line: 42,
      inScope: true,
      existingVendorPr: 88
    });
    assert.deepEqual(decision, {
      action: 'update-pr',
      pr: 88,
      fingerprint: 'codeql:waykit:17',
      autoMerge: false
    });
  });

  it('opens one draft PR keyed to the alert number and a duplicate tick updates that PR', () => {
    const first = decideVendorLoop({
      kind: 'alert',
      source: 'dependabot',
      repo: 'waykit',
      alertNumber: 9,
      severity: 'critical',
      file: 'package.json',
      line: 12,
      inScope: true
    });
    const again = decideVendorLoop({
      kind: 'alert',
      source: 'dependabot',
      repo: 'waykit',
      alertNumber: 9,
      severity: 'critical',
      file: 'package.json',
      line: 12,
      inScope: true,
      existingVendorPr: 101
    });
    assert.equal(first.action, 'open-draft-pr');
    if (first.action !== 'open-draft-pr') return;
    assert.equal(first.fingerprint, vendorAlertFingerprint('dependabot', 'waykit', 9));
    assert.equal(first.autoMerge, false);
    assert.equal(again.action, 'update-pr');
    if (again.action !== 'update-pr') return;
    assert.equal(again.pr, 101);
    assert.equal(again.fingerprint, first.fingerprint);
  });

  it('comments why and does not churn code for noisy, informational, or product-decision findings', () => {
    assert.deepEqual(
      decideVendorLoop({
        kind: 'alert',
        source: 'codeql',
        repo: 'waykit',
        alertNumber: 3,
        severity: 'high',
        file: 'web/src/page.ts',
        line: 8,
        noisy: true
      }),
      { action: 'comment', reason: 'noisy', churnCode: false }
    );
    assert.deepEqual(
      decideVendorLoop({
        kind: 'alert',
        source: 'codeql',
        repo: 'waykit',
        alertNumber: 4,
        severity: 'informational',
        file: 'web/src/page.ts',
        line: 8
      }),
      { action: 'comment', reason: 'informational', churnCode: false }
    );
    assert.deepEqual(
      decideVendorLoop({
        kind: 'alert',
        source: 'dependabot',
        repo: 'waykit',
        alertNumber: 5,
        severity: 'critical',
        file: 'package.json',
        line: 1,
        needsProductDecision: true
      }),
      { action: 'comment', reason: 'product-decision', churnCode: false }
    );
  });

  it('comments when a high alert is out of scope', () => {
    assert.deepEqual(
      decideVendorLoop({
        kind: 'alert',
        source: 'codeql',
        repo: 'waykit',
        alertNumber: 8,
        severity: 'high',
        file: 'kit/src/cli.ts',
        line: 10,
        inScope: false
      }),
      { action: 'comment', reason: 'out-of-scope', churnCode: false }
    );
  });

  it('comments when a high or critical alert has no clear file and line', () => {
    assert.deepEqual(
      decideVendorLoop({
        kind: 'alert',
        source: 'codeql',
        repo: 'waykit',
        alertNumber: 6,
        severity: 'high'
      }),
      { action: 'comment', reason: 'unclear-location', churnCode: false }
    );
  });
});

describe('vendor PR catalog (SOP and Automation prompt)', () => {
  it('keeps Dependabot on vendor hygiene and forbids a helpful lockfile rewrite', () => {
    const sop = readKit('SOPs/quality-loops.md');
    const prompt = readKit('templates/quality-loops.md');
    const dependabot = sop.split('\n').find((line) => line.includes('Dependabot'));
    assert.ok(dependabot, 'SOP must name Dependabot');
    assert.match(dependabot, /Vendor PR/i);
    assert.match(sop, /merge-ready/i);
    assert.match(sop, /lockfile/);
    assert.match(prompt, /Dependabot PR merge-ready/);
    assert.match(prompt, /Do not replace the lockfile change/);
  });

  it('keys a high or critical alert to one draft PR and updates the same PR on a duplicate tick', () => {
    const sop = readKit('SOPs/quality-loops.md');
    const prompt = readKit('templates/quality-loops.md');
    assert.match(sop, /alert number/);
    assert.match(sop, /dependabot\|codeql:<repo>:<n>/);
    assert.match(prompt, /keyed to that alert number/);
    assert.match(prompt, /duplicate tick updates the same PR/);
  });

  it('comments on noisy or product-decision findings and does not churn code', () => {
    const sop = readKit('SOPs/quality-loops.md');
    const prompt = readKit('templates/quality-loops.md');
    assert.match(sop, /Noisy/);
    assert.match(sop, /comment why/);
    assert.match(sop, /Do not churn code/);
    assert.match(prompt, /Noisy or product-decision findings: comment why and do not churn code/);
  });

  it('keeps gpio-build-monitor as an ingest-only bus and skips SHA pins and auto-merge', () => {
    const sop = readKit('SOPs/quality-loops.md');
    const prompt = readKit('templates/quality-loops.md');
    assert.match(sop, /gpio-build-monitor/);
    assert.match(sop, /ingest/);
    assert.match(sop, /does not write product code/);
    assert.match(sop, /No auto-merge/);
    assert.match(prompt, /No auto-merge/);
    assert.match(prompt, /Do not rewrite Actions pins from tags to SHAs/);
  });
});
