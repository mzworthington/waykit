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

  it('opens quality-loops for a Dependabot vendor PR prompt', async () => {
    assert.equal(
      await getSopName(
        'A Dependabot PR is open and a CodeQL alert has a file and line. Open the kit SOP for keeping those as vendor PRs.'
      ),
      'quality-loops'
    );
  });

  it('opens quality-loops for a Cloudflare RUM break filing prompt', async () => {
    const response = await scriptedDriver({
      model: 'scripted',
      systemPrompt: '',
      messages: [
        {
          role: 'user',
          content: 'Open the kit SOP for filing a Linear ticket from a Cloudflare RUM break.'
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

  it('opens coding-agent-observability for a SigNoz token-cost prompt', async () => {
    assert.equal(
      await getSopName(
        'Open the kit SOP for coding-agent token usage, cost, and traces in SigNoz.'
      ),
      'coding-agent-observability'
    );
  });

  it('opens coding-agent-observability for Claude Code OTLP, not PostHog', async () => {
    assert.equal(
      await getSopName(
        'Point Claude Code and Copilot OTLP at local SigNoz and query token cost. Do not use PostHog.'
      ),
      'coding-agent-observability'
    );
  });

  it('opens coding-agent-observability for Cloud Agent SigNoz Cloud traces', async () => {
    assert.equal(
      await getSopName(
        'Point Cursor Cloud Agents at SigNoz Cloud ingest and query traces. Do not use localhost or PostHog.'
      ),
      'coding-agent-observability'
    );
  });

  it('opens sonarqube-findings for a Sonar ticket-file prompt', async () => {
    const response = await scriptedDriver({
      model: 'scripted',
      systemPrompt: '',
      messages: [
        {
          role: 'user',
          content:
            'File a Linear ticket from a SonarQube BUG finding after restore default. Do not open a PR.'
        }
      ],
      tools: [{ name: 'get_sop' }],
      mocks: new Map()
    });
    assert.equal(response.tool_calls?.[0]?.name, 'get_sop');
    assert.equal(
      (response.tool_calls?.[0]?.arguments as { name?: string } | undefined)?.name,
      'sonarqube-findings'
    );
  });

  it('opens quality-loops for a backlog hygiene prompt', async () => {
    const response = await scriptedDriver({
      model: 'scripted',
      systemPrompt: '',
      messages: [
        {
          role: 'user',
          content:
            'Open the kit SOP for a Linear backlog hygiene pass that groups, rewrites INVEST, and marks duplicates.'
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

  it('opens quality-loops for a wk loops setup prompt', async () => {
    assert.equal(
      await getSopName(
        'How do I check which quality-loop Cursor Automations I have, and set them all up with wk loops?'
      ),
      'quality-loops'
    );
  });
});
