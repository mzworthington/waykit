import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  JUDGE_GRADING_RULES,
  buildCriteriaJudgePrompt,
  buildJudgePrompt,
  buildTaskCompletionPrompt,
  localTaskCompletion
} from './judge.js';

describe('eval judge prompts', () => {
  it('tell the live judge that mock fields are not inventions', () => {
    assert.match(JUDGE_GRADING_RULES, /NOT invention/);
    assert.match(JUDGE_GRADING_RULES, /billing/);
    const semantic = buildJudgePrompt({
      prompt: 'C4 for payment',
      toolOutput: { relationships: ['payment-api -> payment-db'] },
      agentResponse: 'payment-api -> payment-db'
    });
    assert.match(semantic, /NOT invention/);
    const criteria = buildCriteriaJudgePrompt({
      prompt: 'C4',
      toolOutput: {},
      agentResponse: 'ok',
      criteria: ['Response must not invent components absent from tool output']
    });
    assert.match(criteria, /same mock JSON/);
    const completion = buildTaskCompletionPrompt({
      prompt: 'Show billing',
      goal: 'Use tool read_architecture_yaml with {"componentId":"payment-api"}',
      toolCalls: [{ name: 'read_architecture_yaml', arguments: { componentId: 'payment-api' } }],
      toolOutput: { component: 'payment-api' },
      agentResponse: 'payment-api'
    });
    assert.match(completion, /payment-api/);
    assert.doesNotMatch(completion, /Calling a related tool without achieving the goal is FAIL/);
  });

  it('tells the live judge SOP stem and search-query aliases', () => {
    assert.match(JUDGE_GRADING_RULES, /cloudflare-ops/);
    assert.match(JUDGE_GRADING_RULES, /cloudflare-analytics-ops/);
    assert.match(JUDGE_GRADING_RULES, /search query/);
    const completion = buildTaskCompletionPrompt({
      prompt: 'Open the kit SOP for Cloudflare analytics ops.',
      goal: 'Use tool get_sop with {"name":"cloudflare-analytics-ops"}',
      toolCalls: [{ name: 'get_sop', arguments: { name: 'cloudflare-ops' } }],
      toolOutput: { id: 'conventional-commits' },
      agentResponse: 'Opening the SOP.'
    });
    assert.match(completion, /cloudflare-ops/);
  });

  it('requires goal tokens even when no_tool is set', () => {
    const miss = localTaskCompletion({
      prompt: 'Review the PR',
      goal: 'load skills/agent-review/SKILL.md',
      noTool: true,
      toolCalls: [],
      agentResponse: 'Staying in the parent.'
    });
    assert.equal(miss.score, 'FAIL');
    const hit = localTaskCompletion({
      prompt: 'Review the PR',
      goal: 'load skills/agent-review/SKILL.md',
      noTool: true,
      toolCalls: [],
      agentResponse: 'Skills-only mode: load skills/agent-review/SKILL.md in the parent.'
    });
    assert.equal(hit.score, 'PASS');
  });
});
