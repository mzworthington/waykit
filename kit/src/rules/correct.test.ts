import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { applyCorrection, finishSession, recordRule } from './correct.js';

describe('applyCorrection', () => {
  it('applies the highest enforcer that can hold the correction', () => {
    const applied = applyCorrection({
      rule: 'domain does not import adapters',
      scope: 'kit',
      available: ['test', 'type', 'structure']
    });

    assert.equal(applied.enforcer, 'structure');
    assert.equal(applied.learningDoc, false);
    assert.equal(applied.adr, false);
  });

  it('records a rule-table row that names the rule and what enforces it', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-rules-'));
    const applied = applyCorrection({
      rule: 'name the port command',
      scope: 'kit',
      available: ['check']
    });

    const file = recordRule(applied, { kitRoot: root, repoDir: root });
    const table = fs.readFileSync(file, 'utf8');

    assert.match(table, /name the port command/);
    assert.match(table, /check/);
  });

  it('stores a kit rule in the kit and a project quirk in that repo', () => {
    const kitRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-rules-kit-'));
    const repoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-rules-repo-'));
    const kitRule = applyCorrection({
      rule: 'kit owns the pin',
      scope: 'kit',
      available: ['check']
    });
    const quirk = applyCorrection({
      rule: 'this app uses stone',
      scope: 'project',
      available: ['test']
    });

    const kitFile = recordRule(kitRule, { kitRoot, repoDir });
    const repoFile = recordRule(quirk, { kitRoot, repoDir });

    assert.equal(kitFile, path.join(kitRoot, 'rules.md'));
    assert.equal(repoFile, path.join(repoDir, 'rules.md'));
    assert.match(fs.readFileSync(kitFile, 'utf8'), /kit owns the pin/);
    assert.match(fs.readFileSync(repoFile, 'utf8'), /this app uses stone/);
    assert.equal(fs.readFileSync(kitFile, 'utf8').includes('this app uses stone'), false);
  });

  it('does not add a learning doc or an ADR when nobody corrected a judgment call', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-rules-close-'));
    const applied = applyCorrection({
      rule: 'pin pnpm',
      scope: 'project',
      available: ['check']
    });

    finishSession(repo, [applied]);

    assert.equal(fs.existsSync(path.join(repo, 'lessons')), false);
    assert.equal(fs.existsSync(path.join(repo, 'docs', 'ADRs')), false);
  });

  it('records a lesson and an ADR only when the correction is a judgment call', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-rules-judgment-'));
    const applied = applyCorrection({
      rule: 'anemic models stay a judgment',
      scope: 'kit',
      available: ['judgment']
    });

    finishSession(repo, [applied]);

    assert.match(fs.readFileSync(path.join(repo, 'lessons', 'judgment.md'), 'utf8'), /anemic models stay a judgment/);
    assert.match(fs.readFileSync(path.join(repo, 'docs', 'ADRs', '0001-judgment.md'), 'utf8'), /anemic models stay a judgment/);
  });
});
