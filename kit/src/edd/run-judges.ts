import {
  buildCriteriaJudgePrompt,
  buildJudgePrompt,
  buildTaskCompletionPrompt,
  localCriteriaJudge,
  localJudge,
  localTaskCompletion,
  type CriteriaJudgeVerdict,
  type JudgeVerdict
} from './judge.js';
import {
  openAiCompatibleJudgeCompletion,
  resolveJudgeApiKey,
  resolveJudgeBackend,
  type JudgeBackend,
  type JudgeCompletionPort
} from './judge-provider.js';
import type { AgentToolCall } from './schema.js';

export interface JudgeRuntimeOptions {
  model: string;
  baseUrl?: string;
  apiKey?: string;
  /** Explicit backend; inferred when omitted. */
  backend?: JudgeBackend;
  /** Defaults to the OpenAI-compatible HTTP adapter when backend is http. */
  complete?: JudgeCompletionPort;
}

function passFailScore(parsed: Record<string, unknown>): 'PASS' | 'FAIL' {
  return String(parsed.score ?? 'FAIL').toUpperCase() === 'PASS' ? 'PASS' : 'FAIL';
}

function shouldUseHeuristic(options: {
  model: string;
  apiKey?: string;
  baseUrl?: string;
  backend?: JudgeBackend;
  complete?: JudgeCompletionPort;
}): boolean {
  if (options.complete) return false;
  return (options.backend ?? resolveJudgeBackend(options)) === 'heuristic';
}

async function completeJudgeJson(
  options: JudgeRuntimeOptions,
  prompt: string
): Promise<Record<string, unknown>> {
  const backend = options.backend ?? resolveJudgeBackend(options);
  const apiKey = resolveJudgeApiKey(options.apiKey, options.baseUrl, backend);
  const complete = options.complete ?? openAiCompatibleJudgeCompletion;
  if (complete === openAiCompatibleJudgeCompletion && !apiKey && !options.baseUrl) {
    return {};
  }
  return complete({
    model: options.model,
    baseUrl: options.baseUrl,
    apiKey,
    prompt
  });
}

/** Application use-case: accuracy / hallucination judge (local or remote). */
export async function runLlmJudge(input: {
  prompt: string;
  toolOutput: unknown;
  agentResponse: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  backend?: JudgeBackend;
  complete?: JudgeCompletionPort;
}): Promise<JudgeVerdict> {
  if (shouldUseHeuristic(input)) {
    return localJudge(input);
  }

  const parsed = await completeJudgeJson(input, buildJudgePrompt(input));
  const score = passFailScore(parsed);
  return {
    score,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    hallucinated: score === 'FAIL'
  };
}

/** Application use-case: criteria judge with threshold (local or remote). */
export async function runCriteriaJudge(input: {
  prompt: string;
  toolOutput: unknown;
  agentResponse: string;
  toolCalls?: AgentToolCall[];
  criteria: string[];
  threshold?: number;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  backend?: JudgeBackend;
  complete?: JudgeCompletionPort;
}): Promise<CriteriaJudgeVerdict> {
  const threshold = input.threshold ?? 1;
  if (!input.criteria.length) {
    return {
      score: 0,
      passed: false,
      reasoning: 'criteria_judge metric missing criteria',
      results: []
    };
  }

  if (shouldUseHeuristic(input)) {
    return localCriteriaJudge(input);
  }

  const parsed = await completeJudgeJson(input, buildCriteriaJudgePrompt(input));
  const rawResults = Array.isArray(parsed.results) ? parsed.results : [];
  const results = input.criteria.map((criterion, i) => {
    const row = rawResults[i] as { pass?: boolean; reason?: string; criterion?: string } | undefined;
    return {
      criterion,
      pass: row?.pass === true,
      reason: typeof row?.reason === 'string' ? row.reason : row?.pass ? 'ok' : 'failed'
    };
  });
  const passedCount = results.filter((r) => r.pass).length;
  const score =
    typeof parsed.score === 'number' && Number.isFinite(parsed.score)
      ? Math.min(1, Math.max(0, parsed.score))
      : results.length === 0
        ? 0
        : passedCount / results.length;
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

/** Application use-case: task completion (local or remote). */
export async function runTaskCompletionJudge(input: {
  prompt: string;
  goal?: string;
  expectTool?: string;
  expectTools?: string[];
  expectArguments?: Record<string, unknown>;
  noTool?: boolean;
  toolCalls: AgentToolCall[];
  toolOutput: unknown;
  agentResponse: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
  backend?: JudgeBackend;
  complete?: JudgeCompletionPort;
}): Promise<JudgeVerdict> {
  if (input.noTool) {
    return localTaskCompletion(input);
  }
  if (shouldUseHeuristic(input)) {
    return localTaskCompletion(input);
  }

  const argsHint = input.expectArguments
    ? ` with arguments containing ${JSON.stringify(input.expectArguments)}`
    : '';
  const goal =
    input.goal ??
    (input.noTool
      ? 'Answer without calling tools'
      : input.expectTools?.length
        ? `Complete tool plan: ${input.expectTools.join(' -> ')}`
        : input.expectTool
          ? `Use tool ${input.expectTool}${argsHint}. Aliases billing/checkout/payment → payment-api; get_sop cloudflare-ops ≡ cloudflare-analytics-ops; search query may add extra keywords; execute code may wrap the same cloudflare.request as async IIFE or return-await; search code may be a spec.paths filter with the same rum/site_info tokens.`
          : input.prompt);

  const parsed = await completeJudgeJson(
    input,
    buildTaskCompletionPrompt({
      prompt: input.prompt,
      goal,
      toolCalls: input.toolCalls,
      toolOutput: input.toolOutput,
      agentResponse: input.agentResponse
    })
  );
  const score = passFailScore(parsed);
  return {
    score,
    reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : '',
    hallucinated: false
  };
}
