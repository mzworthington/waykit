import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { cursorWorkflowArgs, planCursorAutomations, WORKSPACE_REPOS } from './cursorFleet.js';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('cursor workflow provider args', () => {
  it('maps a draft-PR repo loop to a pull-request trigger and withholds PR opens on filing loops', () => {
    const plan = planCursorAutomations(WORKSPACE_REPOS, kitRoot);
    const vendor = plan.find((item) => item.id === 'vendor-pr-archlens');
    const sonar = plan.find((item) => item.id === 'sonar-finding');
    assert.ok(vendor);
    assert.ok(sonar);

    const vendorArgs = cursorWorkflowArgs(vendor);
    assert.deepEqual(vendorArgs.triggers, [
      { gitPullRequest: { repos: ['mzworthington/archlens'], prAction: 'opened' } }
    ]);
    assert.deepEqual(vendorArgs.actions, [{ mcp: { server: 'GitHub' } }, { gitPr: {} }]);
    assert.equal(vendorArgs.disabledDefaultTools, undefined);

    const sonarArgs = cursorWorkflowArgs(sonar);
    assert.deepEqual(sonarArgs.triggers, [{ cron: { schedule: '0 8 * * 0' } }]);
    assert.deepEqual(sonarArgs.disabledDefaultTools, ['open_git_pr']);
    assert.equal(sonarArgs.gitRepo, undefined);
  });
});
