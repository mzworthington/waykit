import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildCliAgentPrompt } from './cli-agent.js';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('kit knowledge live routing hints', () => {
  it('routes opening the host-subagent SOP to get_sop subagent-launch, not get_entity doc:subagents', () => {
    const prompt = fs.readFileSync(path.join(kitRoot, 'evals/edd/kit_knowledge_prompt.md'), 'utf8');
    assert.match(prompt, /^- `get_sop`[^\n]*subagent-launch/m);
    assert.match(prompt, /^- `get_entity`[^\n]*Not SOP/m);
    assert.match(
      prompt,
      /Launching a host subagent[^\n]*`get_sop` `subagent-launch`[^\n]*not `get_entity`/i
    );
    assert.doesNotMatch(prompt, /doc:subagents/);

    const getSop = JSON.parse(
      fs.readFileSync(path.join(kitRoot, 'evals/edd/tools/get_sop.json'), 'utf8')
    ) as { description: string };
    assert.match(getSop.description, /subagent-launch/);
    assert.match(getSop.description, /launching a host subagent/i);
    assert.match(getSop.description, /SOP body|SOP file/i);
    assert.match(getSop.description, /open a kit SOP/i);

    const getEntity = JSON.parse(
      fs.readFileSync(path.join(kitRoot, 'evals/edd/tools/get_entity.json'), 'utf8')
    ) as { description: string };
    assert.match(getEntity.description, /Metadata only|Ontology metadata only/i);
    assert.match(getEntity.description, /get_sop/);
    assert.match(getEntity.description, /host subagent/i);
    assert.match(getEntity.description, /do not use this to open SOP|never .*open (a )?kit SOP/i);
    assert.doesNotMatch(getEntity.description, /doc:subagents|docs\/subagents/);

    const handshake = fs.readFileSync(path.join(kitRoot, 'AGENTS.md'), 'utf8');
    assert.match(handshake, /`get_sop` `subagent-launch`/);
    assert.doesNotMatch(handshake, /Subagent vs skill \| \[docs\/subagents/);

    const template = fs.readFileSync(path.join(kitRoot, 'templates/project-AGENTS.md'), 'utf8');
    assert.match(template, /`get_sop` `subagent-launch`/);

    const cliPrompt = buildCliAgentPrompt({
      systemPrompt: 's',
      messages: [{ role: 'user', content: 'Open the kit SOP for launching a host subagent.' }],
      tools: [{ name: 'get_sop' }, { name: 'get_entity' }]
    });
    assert.match(cliPrompt, /get_sop name=subagent-launch/);
    assert.match(cliPrompt, /never get_entity/i);
  });

  it('opens conventional-commits for where pull request titles are documented, not search_kit', () => {
    const prompt = fs.readFileSync(path.join(kitRoot, 'evals/edd/kit_knowledge_prompt.md'), 'utf8');
    assert.match(
      prompt,
      /title pull requests[^\n]*`get_sop` `conventional-commits`[^\n]*not `search_kit`/i
    );

    const getSop = JSON.parse(
      fs.readFileSync(path.join(kitRoot, 'evals/edd/tools/get_sop.json'), 'utf8')
    ) as { description: string };
    assert.match(getSop.description, /name=conventional-commits instead of search_kit/);

    const searchKit = JSON.parse(
      fs.readFileSync(path.join(kitRoot, 'evals/edd/tools/search_kit.json'), 'utf8')
    ) as { description: string };
    assert.match(searchKit.description, /name=conventional-commits instead of search_kit/);

    const server = fs.readFileSync(
      path.join(kitRoot, 'mcps/servers/kit-knowledge/src/server.ts'),
      'utf8'
    );
    assert.match(server, /name=conventional-commits instead of search_kit/);

    const cliPrompt = buildCliAgentPrompt({
      systemPrompt: prompt,
      messages: [
        { role: 'user', content: 'Where do we document how to title pull requests in this kit?' }
      ],
      tools: [{ name: 'get_sop' }, { name: 'search_kit' }]
    });
    assert.match(cliPrompt, /get_sop name=conventional-commits \(not search_kit\)/);
  });
});
