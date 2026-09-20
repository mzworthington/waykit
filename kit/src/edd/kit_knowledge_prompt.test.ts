import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('kit knowledge live routing hints', () => {
  it('routes opening the host-subagent SOP to get_sop subagent-launch, not get_entity doc:subagents', () => {
    const prompt = fs.readFileSync(path.join(kitRoot, 'evals/edd/kit_knowledge_prompt.md'), 'utf8');
    assert.match(prompt, /^- `get_sop`[^\n]*subagent-launch/m);
    assert.match(prompt, /^- `get_entity`[^\n]*Not SOP/m);
    assert.doesNotMatch(prompt, /doc:subagents/);

    const getSop = JSON.parse(
      fs.readFileSync(path.join(kitRoot, 'evals/edd/tools/get_sop.json'), 'utf8')
    ) as { description: string };
    assert.match(getSop.description, /subagent-launch/);
    assert.match(getSop.description, /SOP body|SOP file/i);
    assert.match(getSop.description, /open a kit SOP/i);

    const getEntity = JSON.parse(
      fs.readFileSync(path.join(kitRoot, 'evals/edd/tools/get_entity.json'), 'utf8')
    ) as { description: string };
    assert.match(getEntity.description, /Metadata only|Ontology metadata only/i);
    assert.match(getEntity.description, /get_sop/);
    assert.doesNotMatch(getEntity.description, /doc:subagents|docs\/subagents/);
  });
});
