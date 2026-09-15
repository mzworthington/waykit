import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scriptedDriver } from './agent-client.js';

async function getSopName(prompt: string): Promise<string | undefined> {
  const response = await scriptedDriver({
    model: 'scripted',
    systemPrompt: '',
    messages: [{ role: 'user', content: prompt }],
    tools: [{ name: 'get_sop' }],
    mocks: new Map()
  });
  assert.equal(response.tool_calls?.[0]?.name, 'get_sop');
  return (response.tool_calls?.[0]?.arguments as { name?: string } | undefined)?.name;
}

describe('scriptedDriver quality-loops', () => {
  it('opens quality-loops for a scheduled scout filing prompt', async () => {
    assert.equal(
      await getSopName('Open the kit SOP for filing typed Linear tickets from a scheduled scout.'),
      'quality-loops'
    );
  });

  it('opens quality-loops for a Lighthouse drop filing prompt', async () => {
    assert.equal(
      await getSopName(
        'Open the kit SOP for filing a Linear ticket from a Lighthouse drop versus last main.'
      ),
      'quality-loops'
    );
  });
});
