import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { planCursorAutomations, WORKSPACE_REPOS } from './cursorFleet.js';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('cursor automation fleet', () => {
  it('schedules Sunday paydown and covers every workspace repo', () => {
    const plan = planCursorAutomations(WORKSPACE_REPOS, kitRoot);
    const sonar = plan.find((item) => item.id === 'sonar-finding');
    const hygiene = plan.find((item) => item.id === 'hygiene');
    assert.equal(sonar?.cron, '0 8 * * 0');
    assert.equal(sonar?.opensPr, false);
    assert.deepEqual(sonar?.mcpServers, ['SonarQube', 'Linear']);
    assert.equal(hygiene?.cron, '0 9 * * 0');
    assert.equal(hygiene?.opensPr, false);
    assert.match(sonar?.prompt ?? '', /at most 1 item/);
    assert.match(sonar?.prompt ?? '', /Security for vuln or hotspot/);

    for (const repo of WORKSPACE_REPOS) {
      const picker = plan.find((item) => item.id === `work-picker-${repo.name}`);
      const vendor = plan.find((item) => item.id === `vendor-pr-${repo.name}`);
      assert.equal(picker?.cron, '0 10 * * 0');
      assert.equal(picker?.gitRepo, `github.com/${repo.slug}`);
      assert.equal(picker?.opensPr, true);
      assert.deepEqual(vendor?.pullRequestRepos, [repo.slug]);
      assert.equal(vendor?.cron, undefined);
      assert.equal(vendor?.opensPr, true);
    }

    assert.deepEqual(
      WORKSPACE_REPOS.map((repo) => repo.slug),
      [
        'mzworthington/archlens',
        'mzworthington/RoMini',
        'mzworthington/waykit',
        'mzworthington/steerco',
        'mzworthington/mzworthington',
        'mzworthington/react-cloudflare-template',
        'mzworthington/edge-dns',
        'mzworthington/gpio-build-monitor',
        'mzworthington/dotfiles'
      ]
    );
  });
});
