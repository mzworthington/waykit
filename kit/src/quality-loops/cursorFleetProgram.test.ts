import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { planCursorAutomations, WORKSPACE_REPOS } from './cursorFleet.js';
import { workflowLogicalNames } from '../../../infra/cursor-automations/program.js';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('pulumi cursor automation program', () => {
  it('declares one workflow resource for every fleet plan entry', () => {
    const plan = planCursorAutomations(WORKSPACE_REPOS, kitRoot);
    assert.deepEqual(
      workflowLogicalNames(kitRoot),
      plan.map((item) => item.id)
    );
  });
});
