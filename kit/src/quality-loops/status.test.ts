import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { loadQualityLoopCatalog, parseQualityLoopCatalog } from './catalog.js';
import { parseLoopsOverlay, printLoopsStatus, reportLoopsStatus } from './status.js';
import { stripAnsi } from '../cli/outcome.js';
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
    assert.match(report.summary, /missing \.cursor\/waykit-loops pack/);
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

describe('printLoopsStatus', () => {
  it('leads a missing pack with a bare next command, not a buried run phrase', () => {
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wk-loops-print-'));
    const report = reportLoopsStatus({
      catalog: parseQualityLoopCatalog(SAMPLE),
      targetDir
    });
    const lines: string[] = [];
    printLoopsStatus(report, (msg) => lines.push(msg), (msg) => lines.push(msg));
    const text = stripAnsi(lines.join('\n'));
    assert.match(text, /^Quality-loop Automations/m);
    assert.match(text, /missing \.cursor\/waykit-loops/i);
    assert.match(text, /^next:$/m);
    assert.match(text, /^ {2}wk loops setup --write$/m);
    assert.doesNotMatch(text, /\brun wk loops setup --write\b/);
    assert.doesNotMatch(text, /^ {2}miss {2}/m);
    assert.match(text, /fail {2}loops {2}/);
  });

  it('prints cron, one-item cap, and the dashboard spending URL', () => {
    const catalog = loadQualityLoopCatalog(kitRoot);
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wk-loops-spend-'));
    fs.mkdirSync(path.join(targetDir, '.cursor', 'waykit-loops'), { recursive: true });
    const report = reportLoopsStatus({ catalog, targetDir });
    const lines: string[] = [];
    printLoopsStatus(report, (msg) => lines.push(msg), (msg) => lines.push(msg));
    const text = stripAnsi(lines.join('\n'));
    assert.match(report.mcpHint, /cursor.com\/dashboard\?tab=spending/);
    assert.match(report.mcpHint, /no per-Automation token cap/i);
    assert.equal(report.rows.find((row) => row.id === 'work-picker')?.cron, '0 8 * * 1');
    assert.equal(report.rows.find((row) => row.id === 'failed-check')?.maxItemsPerRun, 1);
    assert.match(text, /work-picker {2}Schedule 0 8 \* \* 1/);
    assert.match(text, /failed-check {2}GitHub CI completed · cap 1/);
  });
});
