import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workflowPath = path.join(kitRoot, '.github/workflows/edd-live.yml');

describe('nightly live-model EDD workflow', () => {
  it('runs cursor-agent with CURSOR_API_KEY from GitHub secrets', () => {
    const yml = fs.readFileSync(workflowPath, 'utf8');
    assert.match(yml, /secrets\.CURSOR_API_KEY/);
    assert.match(yml, /cursor\.com\/install/);
    assert.match(yml, /--style cli/);
    assert.match(yml, /--cli cursor-agent/);
  });

  it('schedules live cursor-agent evals once a week', () => {
    const yml = fs.readFileSync(workflowPath, 'utf8');
    assert.match(yml, /cron:\s*'0 3 \* \* [0-6]'/);
    assert.doesNotMatch(yml, /cron:\s*'0 3 \* \* \*'/);
  });
});
