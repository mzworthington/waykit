import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  extractPromptSections,
  loadQualityLoopCatalog,
  parseQualityLoopCatalog,
  QUALITY_LOOP_CATALOG_REL
} from './catalog.js';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

const SAMPLE = `
dashboard:
  automations: https://cursor.com/automations
  agents: https://cursor.com/agents
  integrations: https://cursor.com/dashboard/integrations
  mcp:
    - GitHub
    - Linear
    - PostHog
    - Cloudflare Observability
    - SonarQube
prompt_prefix_heading: Cloud catalog missing (any loop)
automations:
  - id: failed-check
    name: File from a failed required check
    trigger: GitHub CI completed
    repo: single
    mcp: [GitHub, Linear]
    opens_pr: false
    prompt_heading: File from a failed required check
`;

describe('parseQualityLoopCatalog', () => {
  it('reads dashboard MCP names, prefix heading, and one Automation per source', () => {
    const catalog = parseQualityLoopCatalog(SAMPLE);
    assert.deepEqual(catalog.dashboard.mcp, [
      'GitHub',
      'Linear',
      'PostHog',
      'Cloudflare Observability',
      'SonarQube'
    ]);
    assert.equal(catalog.dashboard.automations, 'https://cursor.com/automations');
    assert.equal(catalog.promptPrefixHeading, 'Cloud catalog missing (any loop)');
    assert.equal(catalog.automations.length, 1);
    assert.deepEqual(catalog.automations[0], {
      id: 'failed-check',
      name: 'File from a failed required check',
      trigger: 'GitHub CI completed',
      repo: 'single',
      mcp: ['GitHub', 'Linear'],
      opensPr: false,
      promptHeading: 'File from a failed required check'
    });
  });

  it('rejects a mapping that is missing automations', () => {
    assert.throws(() => parseQualityLoopCatalog('dashboard: {}\n'), /automations/);
  });
});

describe('extractPromptSections', () => {
  it('maps ## headings to the following text fence', () => {
    const sections = extractPromptSections(`# Title

## Cloud catalog missing (any loop)

\`\`\`text
Stop BLOCKED.
\`\`\`

## File from a failed required check

\`\`\`text
File one Bug.
\`\`\`
`);
    assert.equal(sections.get('Cloud catalog missing (any loop)'), 'Stop BLOCKED.');
    assert.equal(sections.get('File from a failed required check'), 'File one Bug.');
  });
});

describe('kit quality-loop catalog', () => {
  it('loads eight Automations whose prompt headings exist in templates/quality-loops.md', () => {
    const catalog = loadQualityLoopCatalog(kitRoot);
    const prompts = fs.readFileSync(path.join(kitRoot, 'templates/quality-loops.md'), 'utf8');
    const sections = extractPromptSections(prompts);
    assert.equal(catalog.automations.length, 8);
    assert.ok(sections.get(catalog.promptPrefixHeading));
    for (const item of catalog.automations) {
      assert.ok(sections.get(item.promptHeading), item.promptHeading);
    }
    assert.deepEqual(
      catalog.automations.map((item) => item.id),
      [
        'failed-check',
        'scheduled-scout',
        'lighthouse-drop',
        'rum-break',
        'sonar-finding',
        'vendor-pr',
        'hygiene',
        'work-picker'
      ]
    );
    assert.equal(catalog.automations.find((item) => item.id === 'work-picker')?.opensPr, true);
    assert.equal(catalog.automations.find((item) => item.id === 'failed-check')?.opensPr, false);
    assert.ok(fs.existsSync(path.join(kitRoot, QUALITY_LOOP_CATALOG_REL)));
  });
});
