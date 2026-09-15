import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  decideVendorLoop,
  vendorAlertFingerprint,
  type VendorLoopInput,
  type VendorSeverity,
  type VendorSource
} from './vendor_pr.js';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function catalog(): { sop: string; prompt: string } {
  return {
    sop: fs.readFileSync(path.join(kitRoot, 'SOPs/quality-loops.md'), 'utf8'),
    prompt: fs.readFileSync(path.join(kitRoot, 'templates/quality-loops.md'), 'utf8')
  };
}

function alert(
  overrides: Partial<Extract<VendorLoopInput, { kind: 'alert' }>> & {
    alertNumber: number;
    severity: VendorSeverity;
    source?: VendorSource;
  }
): VendorLoopInput {
  return {
    kind: 'alert',
    source: 'codeql',
    repo: 'waykit',
    ...overrides
  };
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
    assert.deepEqual(
      decideVendorLoop(
        alert({
          alertNumber: 17,
          severity: 'high',
          file: 'kit/src/cli.ts',
          line: 42,
          inScope: true,
          existingVendorPr: 88
        })
      ),
      { action: 'update-pr', pr: 88, fingerprint: 'codeql:waykit:17', autoMerge: false }
    );
  });

  it('opens one draft PR keyed to the alert number and a duplicate tick updates that PR', () => {
    const scoped = {
      source: 'dependabot' as const,
      alertNumber: 9,
      severity: 'critical' as const,
      file: 'package.json',
      line: 12,
      inScope: true
    };
    const first = decideVendorLoop(alert(scoped));
    const again = decideVendorLoop(alert({ ...scoped, existingVendorPr: 101 }));
    assert.equal(first.action, 'open-draft-pr');
    if (first.action !== 'open-draft-pr') return;
    assert.equal(first.fingerprint, vendorAlertFingerprint('dependabot', 'waykit', 9));
    assert.equal(first.autoMerge, false);
    assert.equal(again.action, 'update-pr');
    if (again.action !== 'update-pr') return;
    assert.equal(again.pr, 101);
    assert.equal(again.fingerprint, first.fingerprint);
  });

  it('comments why and does not churn code when the finding is not a scoped high or critical fix', () => {
    const cases: Array<{
      input: Parameters<typeof alert>[0];
      reason: 'noisy' | 'informational' | 'product-decision' | 'out-of-scope' | 'unclear-location';
    }> = [
      { input: { alertNumber: 3, severity: 'high', file: 'web/src/page.ts', line: 8, noisy: true }, reason: 'noisy' },
      { input: { alertNumber: 4, severity: 'informational', file: 'web/src/page.ts', line: 8 }, reason: 'informational' },
      {
        input: {
          source: 'dependabot',
          alertNumber: 5,
          severity: 'critical',
          file: 'package.json',
          line: 1,
          needsProductDecision: true
        },
        reason: 'product-decision'
      },
      { input: { alertNumber: 8, severity: 'high', file: 'kit/src/cli.ts', line: 10, inScope: false }, reason: 'out-of-scope' },
      { input: { alertNumber: 6, severity: 'high' }, reason: 'unclear-location' }
    ];
    for (const row of cases) {
      assert.deepEqual(decideVendorLoop(alert(row.input)), {
        action: 'comment',
        reason: row.reason,
        churnCode: false
      });
    }
  });
});

describe('vendor PR catalog (SOP and Automation prompt)', () => {
  it('keeps vendor PRs on hygiene, alert-number keys, and comments without churn', () => {
    const { sop, prompt } = catalog();
    const dependabot = sop.split('\n').find((line) => line.includes('Dependabot'));
    assert.ok(dependabot, 'SOP must name Dependabot');
    assert.match(dependabot, /Vendor PR/i);
    assert.match(sop, /merge-ready/i);
    assert.match(sop, /lockfile/);
    assert.match(sop, /alert number/);
    assert.match(sop, /dependabot\|codeql:<repo>:<n>/);
    assert.match(sop, /Noisy/);
    assert.match(sop, /comment why/);
    assert.match(sop, /Do not churn code/);
    assert.match(sop, /gpio-build-monitor/);
    assert.match(sop, /ingest/);
    assert.match(sop, /does not write product code/);
    assert.match(sop, /No auto-merge/);
    assert.match(prompt, /Dependabot PR merge-ready/);
    assert.match(prompt, /Do not replace the lockfile change/);
    assert.match(prompt, /keyed to that alert number/);
    assert.match(prompt, /duplicate tick updates the same PR/);
    assert.match(prompt, /Noisy or product-decision findings: comment why and do not churn code/);
    assert.match(prompt, /No auto-merge/);
    assert.match(prompt, /Do not rewrite Actions pins from tags to SHAs/);
  });
});
