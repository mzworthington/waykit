import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { scriptedDriver } from './agent-client.js';
import {
  CLOUD_CATALOG_STOP_CONTENT,
  cloudCatalogShouldStop
} from './scripted_cloud_catalog.js';

const loopTools = [
  { name: 'execute', description: 'List RUM sites' },
  { name: 'search', description: 'Find Cloudflare API paths' },
  { name: 'query_worker_observability', description: 'Worker logs' }
];

describe('cloudCatalogShouldStop', () => {
  it('stops when a Cloud session is missing the dashboard catalog', () => {
    assert.equal(
      cloudCatalogShouldStop(
        'This is a Cloud Agent session. The Cursor dashboard catalog is missing GitHub and Linear. List RUM sites.'
      ),
      true
    );
  });

  it('stops when a local profile is present but the session is still Cloud', () => {
    assert.equal(
      cloudCatalogShouldStop(
        'This is a Cloud Agent session. wk mcp --install already ran and the local profile is present. List RUM sites.'
      ),
      true
    );
  });

  it('does not stop a kit SOP lookup', () => {
    assert.equal(
      cloudCatalogShouldStop('Open the kit SOP for Cloud Agent dashboard MCP servers.'),
      false
    );
  });

  it('does not stop a local RUM list with no Cloud session', () => {
    assert.equal(cloudCatalogShouldStop('List our Cloudflare Web Analytics / RUM sites.'), false);
  });
});

describe('scriptedDriver cloud catalog', () => {
  it('does not call loop tools when the Cloud catalog is missing', async () => {
    const response = await scriptedDriver({
      model: 'scripted',
      systemPrompt: 'Cloud catalog contract',
      messages: [
        {
          role: 'user',
          content:
            'This is a Cloud Agent session. The dashboard catalog is missing GitHub, Linear, PostHog, Cloudflare Observability, and SonarQube. List RUM sites and file Linear issues.'
        }
      ],
      tools: loopTools,
      mocks: new Map()
    });
    assert.deepEqual(response.tool_calls, []);
    assert.match(response.content, /BLOCKED/);
    assert.match(response.content, /dashboard/);
    assert.equal(response.content, CLOUD_CATALOG_STOP_CONTENT);
  });

  it('still stops in Cloud when a local profile is present', async () => {
    const response = await scriptedDriver({
      model: 'scripted',
      systemPrompt: 'Cloud catalog contract',
      messages: [
        {
          role: 'user',
          content:
            'This is a Cloud Agent session. wk mcp --install already ran and the local profile is present in ~/.cursor/mcp.json. List our Cloudflare Web Analytics / RUM sites and dashboard counts.'
        }
      ],
      tools: loopTools,
      mocks: new Map()
    });
    assert.deepEqual(response.tool_calls, []);
    assert.match(response.content, /BLOCKED/);
    assert.match(response.content, /local host files/);
  });

  it('still lists RUM sites when the session is not Cloud', async () => {
    const response = await scriptedDriver({
      model: 'scripted',
      systemPrompt: 'Cloudflare ops',
      messages: [{ role: 'user', content: 'List our Cloudflare Web Analytics / RUM sites.' }],
      tools: loopTools,
      mocks: new Map()
    });
    assert.equal(response.tool_calls[0]?.name, 'execute');
  });
});
