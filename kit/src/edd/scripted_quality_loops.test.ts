import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scriptedDriver } from './agent-client.js';

async function getSopFor(content: string) {
  return scriptedDriver({
    model: 'scripted',
    systemPrompt: '',
    messages: [{ role: 'user', content }],
    tools: [{ name: 'get_sop' }],
    mocks: new Map()
  });
}

describe('scriptedDriver quality-loops', () => {
  it('opens quality-loops for scout filing and Dependabot vendor PR prompts', async () => {
    for (const content of [
      'Open the kit SOP for filing typed Linear tickets from a scheduled scout.',
      'A Dependabot PR is open and a CodeQL alert has a file and line. Open the kit SOP for keeping those as vendor PRs.'
    ]) {
      const response = await getSopFor(content);
      assert.equal(response.tool_calls?.[0]?.name, 'get_sop');
      assert.equal(
        (response.tool_calls?.[0]?.arguments as { name?: string } | undefined)?.name,
        'quality-loops'
      );
    }
  });
});
