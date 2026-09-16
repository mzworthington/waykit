import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { loadQualityLoopCatalog, parseQualityLoopCatalog } from './catalog.js';
import { parseLoopsOverlay, reportLoopsStatus } from './status.js';
import { fileURLToPath } from 'node:url';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const SAMPLE = `
dashboard:
  automations: https://cursor.com/automations
  agents: https://cursor.com/agents
  integrations: https://cursor.com/dashboard/integrations
  mcp:
    - GitHub
    - Linear
prompt_prefix_heading: Cloud catalog missing (any loop)
automations:
  - id: failed-check
    name: File from a failed required check
    trigger: GitHub CI completed
    repo: single
    mcp: [GitHub, Linear]
    opens_pr: false
    prompt_heading: File from a failed required check
  - id: hygiene
    name: Hygiene
    trigger: Schedule
    repo: none
    mcp: [Linear]
    opens_pr: false
    prompt_heading: Hygiene
`;

describe('parseLoopsOverlay', () => {
  it('reads recorded Cursor automation UUIDs and ignores blanks', () => {
    const overlay = parseLoopsOverlay(`
project: archlens
automations:
  failed-check: 6e0d261c-86a2-4383-89f0-9162c1c10662
  hygiene:
`);
    assert.equal(overlay.project, 'archlens');
    assert.equal(overlay.automations.get('failed-check'), '6e0d261c-86a2-4383-89f0-9162c1c10662');
    assert.equal(overlay.automations.has('hygiene'), false);
  });
});

describe('reportLoopsStatus', () => {
  it('fails when the project pack is missing', () => {
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wk-loops-status-'));
    const report = reportLoopsStatus({
      catalog: parseQualityLoopCatalog(SAMPLE),
      targetDir
    });
    assert.equal(report.outcome, 'fail');
    assert.equal(report.packPresent, false);
    assert.match(report.summary, /wk loops setup --write/);
    assert.match(report.mcpHint, /cursor.com\/agents/);
    assert.match(report.mcpHint, /wk mcp --install/);
    assert.equal(report.rows.length, 2);
    assert.equal(report.rows[0]?.recordedId, undefined);
  });

  it('warns when the pack exists but IDs are not recorded', () => {
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wk-loops-status-'));
    fs.mkdirSync(path.join(targetDir, '.cursor', 'waykit-loops'), { recursive: true });
    const report = reportLoopsStatus({
      catalog: parseQualityLoopCatalog(SAMPLE),
      targetDir
    });
    assert.equal(report.outcome, 'warn');
    assert.equal(report.packPresent, true);
    assert.match(report.summary, /no recorded id/);
  });

  it('is ok when every Automation has a recorded id', () => {
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wk-loops-status-'));
    const pack = path.join(targetDir, '.cursor', 'waykit-loops');
    fs.mkdirSync(pack, { recursive: true });
    fs.writeFileSync(
      path.join(pack, 'overlay.yaml'),
      `project: demo
automations:
  failed-check: 6e0d261c-86a2-4383-89f0-9162c1c10662
  hygiene: 7e0d261c-86a2-4383-89f0-9162c1c10662
`
    );
    const report = reportLoopsStatus({
      catalog: parseQualityLoopCatalog(SAMPLE),
      targetDir
    });
    assert.equal(report.outcome, 'ok');
    assert.equal(report.rows.every((row) => row.recordedId), true);
  });

  it('loads the kit catalog for a real checkout', () => {
    const catalog = loadQualityLoopCatalog(kitRoot);
    const report = reportLoopsStatus({ catalog, targetDir: kitRoot });
    assert.equal(report.rows.length, 8);
    assert.match(report.mcpHint, /SonarQube/);
  });
});
