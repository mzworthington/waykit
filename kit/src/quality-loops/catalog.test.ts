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
      promptHeading: 'File from a failed required check',
      cron: undefined,
      maxItemsPerRun: 1,
      skipUnless: undefined
    });
  });

  it('rejects a mapping that is missing automations', () => {
    assert.throws(() => parseQualityLoopCatalog('dashboard: {}\n'), /automations/);
  });

  it('reads cron, max_items_per_run, skip_unless, and dashboard spending as the run cap', () => {
    const catalog = parseQualityLoopCatalog(`
dashboard:
  automations: https://cursor.com/automations
  agents: https://cursor.com/agents
  integrations: https://cursor.com/dashboard/integrations
  spending: https://cursor.com/dashboard?tab=spending
  mcp: [GitHub]
prompt_prefix_heading: Cloud catalog missing (any loop)
automations:
  - id: failed-check
    name: File from a failed required check
    trigger: GitHub CI completed
    repo: single
    mcp: [GitHub]
    opens_pr: false
    prompt_heading: File from a failed required check
    cron: null
    max_items_per_run: 1
    skip_unless: the triggering required check is red
  - id: hygiene
    name: Hygiene
    trigger: Schedule
    repo: none
    mcp: [Linear]
    opens_pr: false
    prompt_heading: Hygiene
    cron: "0 10 * * *"
    max_items_per_run: 1
`);
    assert.equal(catalog.dashboard.spending, 'https://cursor.com/dashboard?tab=spending');
    assert.equal(catalog.automations[0]?.cron, undefined);
    assert.equal(catalog.automations[0]?.maxItemsPerRun, 1);
    assert.equal(catalog.automations[0]?.skipUnless, 'the triggering required check is red');
    assert.equal(catalog.automations[1]?.cron, '0 10 * * *');
    assert.equal(catalog.automations[1]?.maxItemsPerRun, 1);
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

  it('caps spend with a dashboard spending URL, cron on scheduled loops, and skip_unless on event loops', () => {
    const catalog = loadQualityLoopCatalog(kitRoot);
    assert.equal(catalog.dashboard.spending, 'https://cursor.com/dashboard?tab=spending');
    for (const item of catalog.automations) {
      assert.equal(item.maxItemsPerRun, 1, item.id);
      const scheduled = item.trigger === 'Schedule';
      if (scheduled) {
        assert.match(item.cron ?? '', /^\S+ \S+ \S+ \S+ \S+$/, item.id);
      } else {
        assert.equal(item.cron, undefined, item.id);
        assert.ok(item.skipUnless && item.skipUnless.length > 0, item.id);
      }
    }
    assert.equal(catalog.automations.find((item) => item.id === 'failed-check')?.skipUnless, 'the triggering required check is red');
    assert.equal(catalog.automations.find((item) => item.id === 'vendor-pr')?.skipUnless, 'the pull request is Dependabot or CodeQL');
    assert.equal(catalog.automations.find((item) => item.id === 'work-picker')?.cron, '0 8 * * 1');
  });

  it('defaults scheduled loops to once a week on Monday 08:00 UTC', () => {
    const catalog = loadQualityLoopCatalog(kitRoot);
    const weekly = '0 8 * * 1';
    for (const item of catalog.automations) {
      if (item.trigger !== 'Schedule') continue;
      assert.equal(item.cron, weekly, item.id);
    }
  });
});
