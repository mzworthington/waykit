import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { measureContextBudget } from './measure_context_budget.js';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function write(root: string, rel: string, contents: string): void {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents, 'utf8');
}

describe('measureContextBudget', () => {
  it('keeps the kit handshake always-on surface under the default target', () => {
    const result = measureContextBudget(kitRoot);
    assert.equal(
      result.ok,
      true,
      `always-on ${result.alwaysOnChars} exceeds ${result.targetChars}`
    );
  });

  it('passes when always-on files are under the target', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-ctx-'));
    write(root, 'AGENTS.md', 'thin\n');
    write(root, 'templates/project-AGENTS.md', 'handshake\n');
    write(root, '.cursorrules', 'rules\n');
    write(root, 'CLAUDE.md', 'pointer\n');
    const result = measureContextBudget(root, 8000);
    assert.equal(result.ok, true);
    assert.equal(result.alwaysOnChars, 'thin\n'.length + 'handshake\n'.length);
    assert.equal(result.breakdown.cursorRules, 'rules\n'.length);
    assert.equal(result.breakdown.claude, 'pointer\n'.length);
  });

  it('fails when always-on surface exceeds the target', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-ctx-'));
    write(root, 'AGENTS.md', 'x'.repeat(100));
    write(root, 'templates/project-AGENTS.md', '');
    write(root, '.cursorrules', '');
    write(root, 'CLAUDE.md', '');
    const result = measureContextBudget(root, 50);
    assert.equal(result.ok, false);
    assert.equal(result.alwaysOnChars, 100);
  });

  it('counts missing files as zero and keeps philosophy off the always-on total', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-ctx-'));
    write(root, 'CODING_PHILOSOPHY.md', 'x'.repeat(500));
    write(
      root,
      'skills/agent-tdd/SKILL.md',
      '---\nname: agent-tdd\ndescription: a skill description here\n---\n# body\n'
    );
    const result = measureContextBudget(root, 8000);
    assert.equal(result.ok, true);
    assert.equal(result.alwaysOnChars, 0);
    assert.equal(result.breakdown.philosophy, 500);
    assert.ok(result.breakdown.skillDescriptions > 0);
  });
});
