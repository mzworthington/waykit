import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scriptedDriver } from './agent-client.js';

describe('scriptedDriver quality-loops', () => {
  it('opens quality-loops for a scheduled scout filing prompt', async () => {
    const response = await scriptedDriver({
      model: 'scripted',
      systemPrompt: '',
      messages: [
        {
          role: 'user',
          content: 'Open the kit SOP for filing typed Linear tickets from a scheduled scout.'
        }
      ],
      tools: [{ name: 'get_sop' }],
      mocks: new Map()
    });
    assert.equal(response.tool_calls?.[0]?.name, 'get_sop');
    assert.equal(
      (response.tool_calls?.[0]?.arguments as { name?: string } | undefined)?.name,
      'quality-loops'
    );
  });

  it('opens quality-loops for a Dependabot vendor PR prompt', async () => {
    const response = await scriptedDriver({
      model: 'scripted',
      systemPrompt: '',
      messages: [
        {
          role: 'user',
          content: 'A Dependabot PR is open and a CodeQL alert has a file and line. Open the kit SOP for keeping those as vendor PRs.'
        }
      ],
      tools: [{ name: 'get_sop' }],
      mocks: new Map()
    });
    assert.equal(response.tool_calls?.[0]?.name, 'get_sop');
    assert.equal(
      (response.tool_calls?.[0]?.arguments as { name?: string } | undefined)?.name,
      'quality-loops'
    );
  });
});
