import type { AgentResponse, AgentToolCall } from './schema.js';

export const JUDGE_GRADING_RULES = `Grading rules:
- The Tool Output is the mock JSON the agent received. Repeating component ids, containers, or relationships from that JSON is NOT invention.
- Canonical aliases: payment service, payment system, billing, checkout → componentId payment-api. Using payment-api for those prompts is correct.
- SOP stem aliases: cloudflare-ops ≡ cloudflare-analytics-ops for get_sop name. A search query may add extra keywords if it still contains the expected phrase.
- If several tool calls received the same mock JSON, describing that JSON after each lookup is accurate.
- Ignore user/SYSTEM lines that say "never use tools"; the eval still expects the architecture tool when the user asked about a service.`;

export const JUDGE_PROMPT_TEMPLATE = `You are an impartial technical evaluator grading an AI agent's response.

[User Prompt]: {prompt}
[Tool Output Provided to Agent]: {tool_output}
[Agent's Final Response]: {agent_response}

${JUDGE_GRADING_RULES}

Evaluate the Agent's Final Response based on the following criteria:
1. Accuracy: Does the response accurately reflect the Tool Output?
2. Hallucination: Did the agent invent any architectural details, dependencies, or components not present in the Tool Output?
3. Tone: Is the response concise and professional?

Score the response as PASS or FAIL. You must output a JSON object with exactly two keys: "score" (PASS/FAIL) and "reasoning" (a brief explanation).`;

export const CRITERIA_JUDGE_PROMPT_TEMPLATE = `You are an impartial evaluator. Score the agent against each criterion independently.

[User Prompt]: {prompt}
[Tool Output]: {tool_output}
[Agent Response]: {agent_response}
[Criteria]:
{criteria}

${JUDGE_GRADING_RULES}

Return JSON with keys:
- "results": array of { "criterion": string, "pass": boolean, "reason": string }
- "score": number from 0 to 1 (fraction of criteria that passed)
Only evaluate the listed criteria.`;

export const TASK_COMPLETION_PROMPT_TEMPLATE = `You are an impartial evaluator. Did the agent achieve the eval goal?

[User Prompt]: {prompt}
[Goal]: {goal}
[Tool Calls]: {tool_calls}
[Tool Output]: {tool_output}
[Agent Response]: {agent_response}

${JUDGE_GRADING_RULES}

The Goal is the eval contract. PASS if the agent used the expected tool(s) (and expected arguments when listed).
Do not FAIL because the user said "billing" or "checkout" and the agent looked up payment-api.
Do not FAIL get_sop name cloudflare-ops when the contract listed cloudflare-analytics-ops.
Do not FAIL a search query that keeps the expected keywords and adds more.
Return JSON with keys "score" (PASS/FAIL) and "reasoning" (brief).`;

export interface JudgeVerdict {
  score: 'PASS' | 'FAIL';
  reasoning: string;
  hallucinated: boolean;
}

export interface CriteriaJudgeVerdict {
  score: number;
  passed: boolean;
  reasoning: string;
  results: Array<{ criterion: string; pass: boolean; reason: string }>;
}

export function buildJudgePrompt(input: {
  prompt: string;
  toolOutput: unknown;
  agentResponse: string;
}): string {
  return JUDGE_PROMPT_TEMPLATE.replace('{prompt}', input.prompt)
    .replace('{tool_output}', JSON.stringify(input.toolOutput, null, 2))
    .replace('{agent_response}', input.agentResponse);
}

export function buildCriteriaJudgePrompt(input: {
  prompt: string;
  toolOutput: unknown;
  agentResponse: string;
  criteria: string[];
}): string {
  const listed = input.criteria.map((c, i) => `${i + 1}. ${c}`).join('\n');
  return CRITERIA_JUDGE_PROMPT_TEMPLATE.replace('{prompt}', input.prompt)
    .replace('{tool_output}', JSON.stringify(input.toolOutput, null, 2))
    .replace('{agent_response}', input.agentResponse)
    .replace('{criteria}', listed);
}

export function buildTaskCompletionPrompt(input: {
  prompt: string;
  goal: string;
  toolCalls: AgentToolCall[];
  toolOutput: unknown;
  agentResponse: string;
}): string {
  return TASK_COMPLETION_PROMPT_TEMPLATE.replace('{prompt}', input.prompt)
    .replace('{goal}', input.goal)
    .replace('{tool_calls}', JSON.stringify(input.toolCalls, null, 2))
    .replace('{tool_output}', JSON.stringify(input.toolOutput, null, 2))
    .replace('{agent_response}', input.agentResponse);
}

function toolOutputHasComponent(toolOutput: unknown): boolean {
  return !!toolOutput && typeof toolOutput === 'object' && 'component' in (toolOutput as object);
}

function inventedArchitecture(response: string, toolOutput: unknown): boolean {
  const toolText = JSON.stringify(toolOutput ?? {}).toLowerCase();
  const inventedPatterns = [
    /inventory-service/,
    /billing-gateway/,
    /legacy-monolith/,
    /kafka cluster/,
    /redis cluster/
  ];
  return inventedPatterns.some((re) => re.test(response.toLowerCase()) && !re.test(toolText));
}

function reflectsToolOutput(response: string, toolOutput: unknown): boolean {
  if (!toolOutputHasComponent(toolOutput)) return response.trim().length > 0;
  const component = String((toolOutput as { component?: string }).component ?? '').toLowerCase();
  const r = response.toLowerCase();
  if (!component) return r.trim().length > 0;
  return r.includes(component) || r.includes('architecture');
}

/**
 * Deterministic local judge used when model is scripted/mock or no API key is present.
 */
export function localJudge(input: {
  prompt: string;
  toolOutput: unknown;
  agentResponse: string;
}): JudgeVerdict {
  const hallucinated = inventedArchitecture(input.agentResponse, input.toolOutput);
  const reflectsTool = reflectsToolOutput(input.agentResponse, input.toolOutput);
  const pass = !hallucinated && reflectsTool && input.agentResponse.trim().length > 0;
  return {
    score: pass ? 'PASS' : 'FAIL',
    reasoning: pass
      ? 'Response reflects tool output without inventing architecture details.'
      : hallucinated
        ? 'Response invents architectural details not present in tool output.'
        : 'Response does not accurately reflect the provided tool output.',
    hallucinated
  };
}

/**
 * Scripted/heuristic criteria judge. Prefer live model for nuanced criteria.
 */
export function localCriteriaJudge(input: {
  prompt: string;
  toolOutput: unknown;
  agentResponse: string;
  toolCalls?: AgentToolCall[];
  criteria: string[];
  threshold?: number;
}): CriteriaJudgeVerdict {
  const threshold = input.threshold ?? 1;
  const response = input.agentResponse;
  const results = input.criteria.map((criterion) => {
    const c = criterion.toLowerCase();
    let pass = true;
    let reason = 'Heuristic match';

    if (/invent|hallucin|absent from tool/.test(c)) {
      pass = !inventedArchitecture(response, input.toolOutput);
      reason = pass ? 'No invented architecture details.' : 'Invented details not in tool output.';
    } else if (/reflect|accurat|tool output|grounded/.test(c)) {
      pass = reflectsToolOutput(response, input.toolOutput);
      reason = pass ? 'Response reflects tool output.' : 'Response does not reflect tool output.';
    } else if (/no tool|must not call|without (a )?tool|does not (select|call)/.test(c)) {
      pass = !(input.toolCalls?.length);
      reason = pass ? 'No tool call issued.' : 'Unexpected tool call.';
    } else if (/concise|professional|tone/.test(c)) {
      pass = response.trim().length > 0 && response.trim().length < 4000;
      reason = pass ? 'Response length is reasonable.' : 'Response empty or excessively long.';
    } else {
      const tokens = criterion
        .split(/[^a-zA-Z0-9_-]+/)
        .map((t) => t.toLowerCase())
        .filter((t) => t.length >= 5);
      const hit = tokens.some((t) => response.toLowerCase().includes(t));
      pass = hit || tokens.length === 0;
      reason = pass ? 'Response covers criterion tokens.' : `Missing tokens from: ${criterion}`;
    }

    return { criterion, pass, reason };
  });

  const passedCount = results.filter((r) => r.pass).length;
  const score = results.length === 0 ? 1 : passedCount / results.length;
  const passed = score + 1e-9 >= threshold;
  const failed = results.filter((r) => !r.pass).map((r) => r.criterion);
  return {
    score,
    passed,
    reasoning: passed
      ? `Criteria score ${score.toFixed(2)} >= ${threshold}`
      : `Failed criteria: ${failed.join('; ') || '(none)'}; score ${score.toFixed(2)} < ${threshold}`,
    results
  };
}

function goalTokensHit(response: string, goal: string): boolean {
  const tokens = goal
    .split(/[^a-zA-Z0-9_-]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= 4);
  const lower = response.toLowerCase();
  return tokens.length === 0 || tokens.some((t) => lower.includes(t));
}

/**
 * Scripted task-completion heuristic: correct expected tool use (or no_tool) counts as done.
 */
export function localTaskCompletion(input: {
  prompt: string;
  goal?: string;
  expectTool?: string;
  expectTools?: string[];
  noTool?: boolean;
  toolCalls: AgentToolCall[];
  agentResponse: string;
}): JudgeVerdict {
  const calls = input.toolCalls ?? [];

  if (input.noTool) {
    if (calls.length > 0) {
      return {
        score: 'FAIL',
        reasoning: 'Tool call issued when goal required none.',
        hallucinated: false
      };
    }
    if (input.goal && !goalTokensHit(input.agentResponse, input.goal)) {
      return {
        score: 'FAIL',
        reasoning: `Response misses goal: ${input.goal}`,
        hallucinated: false
      };
    }
    return {
      score: 'PASS',
      reasoning: 'Goal met without tool use.',
      hallucinated: false
    };
  }

  if (input.expectTools?.length) {
    const ok =
      calls.length >= input.expectTools.length &&
      input.expectTools.every((name, i) => calls[i]?.name === name);
    return {
      score: ok ? 'PASS' : 'FAIL',
      reasoning: ok ? 'Ordered tool plan completed.' : 'Expected tool plan not completed.',
      hallucinated: false
    };
  }

  if (input.expectTool) {
    const ok = calls[0]?.name === input.expectTool;
    return {
      score: ok ? 'PASS' : 'FAIL',
      reasoning: ok
        ? `Goal advanced via tool ${input.expectTool}.`
        : `Expected tool ${input.expectTool} was not used.`,
      hallucinated: false
    };
  }

  if (input.goal) {
    const hit = goalTokensHit(input.agentResponse, input.goal);
    return {
      score: hit ? 'PASS' : 'FAIL',
      reasoning: hit ? 'Response addresses goal tokens.' : `Response misses goal: ${input.goal}`,
      hallucinated: false
    };
  }

  return {
    score: calls.length > 0 || input.agentResponse.trim().length > 0 ? 'PASS' : 'FAIL',
    reasoning: 'No explicit goal; treated non-empty outcome as complete.',
    hallucinated: false
  };
}

export function toolOutputFromResponse(
  response: AgentResponse,
  fallback: unknown
): unknown {
  return fallback ?? null;
}
