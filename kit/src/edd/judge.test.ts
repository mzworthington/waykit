import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  JUDGE_GRADING_RULES,
  buildCriteriaJudgePrompt,
  buildJudgePrompt,
  buildTaskCompletionPrompt,
  gradeSkillsOnlyCompletion,
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

  it('tells the live judge execute wrappers and spec.paths search filters are aliases', () => {
    assert.match(JUDGE_GRADING_RULES, /cloudflare\.request/);
    assert.match(JUDGE_GRADING_RULES, /spec\.paths/);
    const completion = buildTaskCompletionPrompt({
      prompt: 'List our Cloudflare Web Analytics / RUM sites.',
      goal: 'Use tool execute',
      toolCalls: [
        {
          name: 'execute',
          arguments: {
            code: 'return await cloudflare.request({ method: "GET", path: `/accounts/${accountId}/rum/site_info/list` });'
          }
        }
      ],
      toolOutput: { result: [{ host: 'waykit.dev' }] },
      agentResponse: 'waykit.dev'
    });
    assert.match(completion, /return await/);
    assert.match(completion, /async \(\) =>/);
  });

  it('grades a live skills-only review on the skill path and no launch', () => {
    const base = {
      goal: 'load skills/agent-review/SKILL.md',
      toolCalls: [] as { name: string; arguments: Record<string, unknown> }[]
    };
    const named = gradeSkillsOnlyCompletion({
      ...base,
      agentResponse: 'Skills-only: load skills/agent-review/SKILL.md in the parent.'
    });
    assert.equal(named.score, 'PASS');
    const installed = gradeSkillsOnlyCompletion({
      ...base,
      agentResponse: 'Read ~/.agents/skills/agent-review/SKILL.md and stay in the parent.'
    });
    assert.equal(installed.score, 'PASS');
    const missing = gradeSkillsOnlyCompletion({
      ...base,
      agentResponse: 'I will review the PR in the parent.'
    });
    assert.equal(missing.score, 'FAIL');
    assert.match(missing.reasoning, /skills\/agent-review\/SKILL\.md/);
    const launched = gradeSkillsOnlyCompletion({
      ...base,
      toolCalls: [{ name: 'launch_specialist', arguments: { specialist: 'agent-review' } }],
      agentResponse: 'Launching after naming skills/agent-review/SKILL.md.'
    });
    assert.equal(launched.score, 'FAIL');
    assert.match(launched.reasoning, /launch adapter/);
  });

  it('fails a live stay-in-parent case that names a specialist skill', () => {
    const weather = gradeSkillsOnlyCompletion({
      goal: 'stay in the parent',
      toolCalls: [],
      agentResponse: 'Next playbook: skills/agent-review/SKILL.md'
    });
    assert.equal(weather.score, 'FAIL');
    assert.match(weather.reasoning, /next playbook/);
    const typo = gradeSkillsOnlyCompletion({
      goal: 'stay in the parent',
      toolCalls: [],
      agentResponse: 'Staying in the parent for a tiny typo.'
    });
    assert.equal(typo.score, 'PASS');
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
