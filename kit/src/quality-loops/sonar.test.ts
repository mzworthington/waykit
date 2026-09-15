import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(kitRoot, rel), 'utf8');
}

describe('sonar scout filing', () => {
  const sop = read('SOPs/sonarqube-findings.md');
  const handover = read('templates/sonar-findings.md');
  const prompt = read('templates/quality-loops.md');

  it('files one typed ticket for fix rows after restore default and does not open a PR', () => {
    const file = sop.split('## Scout file')[1] ?? '';
    assert.match(file, /Restore `wk mcp default` first/);
    assert.match(file, /one\*\* ticket|file \*\*one\*\* ticket/i);
    assert.match(file, /\|\s*BUG\s*\|\s*Bug\s*\|/);
    assert.match(file, /VULNERABILITY or confirmed SECURITY_HOTSPOT\s*\|\s*Security/);
    assert.match(file, /Maintainability CODE_SMELL.*\|\s*Improvement/);
    assert.match(file, /Do \*\*not\*\* open a PR/);
    assert.match(sop, /Do not create issues while the sonar profile is on/);
    assert.match(prompt, /Bug for BUG/);
    assert.match(prompt, /Security for vuln or hotspot/);
    assert.match(prompt, /Improvement for maintainability/);
    assert.match(prompt, /Do not open a PR/);
    assert.match(handover, /after restore `wk mcp default`/);
    assert.match(handover, /Do not open a PR/);
  });

  it('skips policy rows including Actions version-tag pins without a ticket or NOSONAR', () => {
    assert.match(sop, /Do not add `NOSONAR`/);
    assert.match(sop, /Actions pinned by version tag, not SHA/);
    assert.match(sop, /no ticket, no `NOSONAR`/);
    assert.match(sop, /@vN/);
    assert.match(sop, /Do not rewrite to a 40-char SHA/);
    assert.match(handover, /No ticket\. No `NOSONAR`/);
    assert.match(prompt, /Actions pinned by version tag/);
    assert.match(prompt, /no ticket, no NOSONAR/);
  });

  it('restores default before Linear create and does not file on the sonar profile', () => {
    assert.match(sop, /before\*\* any Linear create/);
    assert.match(sop, /Do not create issues while the sonar profile is on/);
    assert.match(prompt, /restore wk mcp default, then file one ticket/);
    assert.match(prompt, /Do not create issues while the sonar profile is on/);
    assert.match(handover, /Do not create Linear issues while the sonar profile is on/);
  });
});
