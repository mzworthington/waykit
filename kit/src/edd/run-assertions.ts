import path from 'path';
import { pathToFileURL } from 'node:url';
import { evaluateArgumentCorrectness, parseToolArguments } from './argument-correctness.js';
import { evaluateMcpUse } from './mcp-use.js';
import { loadMetricPlugin } from './metric-plugin.js';
import { evaluatePlanAdherence, evaluateStepEfficiency, resolveMaxSteps } from './plan-metrics.js';
import { resolveToolOutput } from './resolve-tool-output.js';
import type { JudgeBackend, JudgeCompletionPort } from './judge-provider.js';
import { runCriteriaJudge, runLlmJudge, runTaskCompletionJudge } from './run-judges.js';
import type { AgentResponse, EvalCase, EvalConfig, EvalMetric } from './schema.js';
import { buildTrajectory, type TrajectoryStep } from './trajectory.js';

export interface AssertionResult {
  passed: boolean;
  failures: string[];
  hallucinated?: boolean;
  routingOk?: boolean;
  schemaOk?: boolean;
  trajectory: TrajectoryStep[];
  stepFailures: Map<number, string>;
}

export interface RunAssertionsInput {
  response: AgentResponse;
  metrics: EvalMetric[];
  testCase: EvalCase;
  config: EvalConfig;
  availableTools: string[];
  suiteYamlPath: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  judgeBackend?: JudgeBackend;
  complete?: JudgeCompletionPort;
}

function resolvePath(baseFile: string, maybeRelative: string): string {
  if (path.isAbsolute(maybeRelative)) return maybeRelative;
  return path.resolve(path.dirname(baseFile), maybeRelative);
}

function assertObjectArgs(
  parsed: Record<string, unknown>,
  label: string,
  strict: boolean
): string[] {
  if (!strict) return [];
  const failures: string[] = [];
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    failures.push(`${label} arguments must be a JSON object`);
    return failures;
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      failures.push(`${label} expected ${key} to be a JSON primitive or array, got object`);
    }
  }
  return failures;
}

/** Application use-case: run all suite metrics for one case. */
export async function runCaseAssertions(input: RunAssertionsInput): Promise<AssertionResult> {
  const { response, metrics, testCase, config } = input;
  const failures: string[] = [];
  let hallucinated: boolean | undefined;
  let routingOk: boolean | undefined;
  let schemaOk: boolean | undefined;
  const stepFailures = new Map<number, string>();
  const calls = response.tool_calls ?? [];
  const judgeTasks: Array<Promise<void>> = [];

  for (const metric of metrics) {
    if (metric.type === 'tool_selection') {
      if (testCase.expect?.no_tool) {
        const selected = calls[0]?.name;
        routingOk = !selected;
        if (selected) failures.push(`routing: expected no tool, got ${selected}`);
        continue;
      }

      if (testCase.expect?.tools?.length) {
        const expected = testCase.expect.tools;
        routingOk = true;
        if (calls.length < expected.length) {
          routingOk = false;
          failures.push(`routing: expected ${expected.length} tool call(s), got ${calls.length}`);
        }
        for (let i = 0; i < expected.length; i++) {
          const got = calls[i]?.name;
          if (got !== expected[i]!.name) {
            routingOk = false;
            failures.push(`routing: call[${i}] expected ${expected[i]!.name}, got ${got ?? '(none)'}`);
          }
        }
        continue;
      }

      const selected = calls[0]?.name;
      const expected = testCase.expect?.tool ?? metric.expected;
      if (!expected) {
        failures.push('routing: tool_selection metric missing expected tool');
        routingOk = false;
        continue;
      }
      routingOk = selected === expected;
      if (!routingOk) {
        failures.push(`routing: expected tool ${expected}, got ${selected ?? '(none)'}`);
      }
    }

    if (metric.type === 'schema_match') {
      if (testCase.expect?.no_tool) {
        schemaOk = true;
        continue;
      }

      if (testCase.expect?.tools?.length) {
        let ok = true;
        for (let i = 0; i < testCase.expect.tools.length; i++) {
          const call = calls[i];
          if (!call) {
            failures.push(`schema: missing tool call at index ${i}`);
            ok = false;
            continue;
          }
          const parsed = parseToolArguments(call.arguments);
          if (!parsed) {
            failures.push(`schema: call[${i}] arguments are not valid JSON`);
            ok = false;
            continue;
          }
          const shape = assertObjectArgs(parsed, `schema: call[${i}]`, metric.strict !== false);
          if (shape.length) {
            failures.push(...shape);
            ok = false;
          }
        }
        schemaOk = ok;
        continue;
      }

      const call = calls[0];
      if (!call) {
        failures.push('schema: no tool call to validate');
        schemaOk = false;
        continue;
      }
      const parsed = parseToolArguments(call.arguments);
      if (!parsed) {
        failures.push('schema: tool arguments are not valid JSON');
        schemaOk = false;
        continue;
      }
      const shape = assertObjectArgs(parsed, 'schema:', metric.strict !== false);
      failures.push(...shape);
      schemaOk = shape.length === 0;
    }

    if (metric.type === 'self_correction') {
      const parsed = calls[0] ? parseToolArguments(calls[0].arguments) : null;
      const hintOk =
        parsed &&
        (parsed.componentId === 'payment-api' ||
          parsed.component === 'payment-api' ||
          JSON.stringify(parsed).includes('payment-api'));
      if (!hintOk) {
        failures.push('self_correction: agent did not update parameters from error hint');
      }
    }

    if (metric.type === 'terminal_fallback') {
      const maxRetries = metric.max_retries ?? 2;
      if (!response.haltedAutonomousExecution) {
        failures.push('terminal_fallback: agent did not halt after consecutive failures');
      }
      if (calls.length) {
        failures.push('terminal_fallback: agent continued issuing tool calls after breaker');
      }
      if (response.consecutiveToolFailures < maxRetries && !response.haltedAutonomousExecution) {
        failures.push(`terminal_fallback: expected >= ${maxRetries} consecutive failures`);
      }
    }

    if (metric.type === 'argument_correctness') {
      failures.push(...evaluateArgumentCorrectness({ testCase, toolCalls: calls }));
    }

    if (metric.type === 'mcp_use') {
      const available = metric.allowed_tools?.length ? metric.allowed_tools : input.availableTools;
      failures.push(
        ...evaluateMcpUse({
          toolCalls: calls,
          availableTools: available,
          expectTool: testCase.expect?.tool,
          expectTools: testCase.expect?.tools?.map((t) => t.name),
          noTool: testCase.expect?.no_tool === true
        })
      );
    }

    if (metric.type === 'plan_adherence') {
      const expectedPlan =
        testCase.expect?.tools?.map((t) => t.name) ??
        (testCase.expect?.tool ? [testCase.expect.tool] : []);
      if (!expectedPlan.length || testCase.expect?.no_tool) continue;
      const result = evaluatePlanAdherence({ toolCalls: calls, expectedPlan });
      for (const [idx, msg] of result.stepFailures) stepFailures.set(idx, msg);
      failures.push(...result.failures);
    }

    if (metric.type === 'step_efficiency') {
      failures.push(
        ...evaluateStepEfficiency({
          toolCalls: calls,
          maxSteps: resolveMaxSteps({
            maxSteps: metric.max_steps,
            expectToolsLength: testCase.expect?.tools?.length,
            noTool: testCase.expect?.no_tool === true
          }),
          haltedAutonomousExecution: response.haltedAutonomousExecution
        })
      );
    }

    if (metric.type === 'task_completion') {
      judgeTasks.push(
        (async () => {
          try {
            const verdict = await runTaskCompletionJudge({
              prompt: testCase.prompt,
              goal: testCase.expect?.goal ?? metric.expected,
              expectTool: testCase.expect?.tool,
              expectTools: testCase.expect?.tools?.map((t) => t.name),
              expectArguments: testCase.expect?.arguments_contains,
              noTool: testCase.expect?.no_tool === true,
              toolCalls: calls,
              toolOutput: resolveToolOutput(testCase, config, calls[0]?.name),
              agentResponse: response.content,
              model: input.model,
              apiKey: input.apiKey,
              baseUrl: input.baseUrl,
              backend: input.judgeBackend,
              complete: input.complete
            });
            if (verdict.score !== 'PASS') {
              failures.push(`completion: ${verdict.reasoning || 'task_completion failed'}`);
            }
          } catch (err) {
            failures.push(`judge: ${err instanceof Error ? err.message : String(err)}`);
          }
        })()
      );
    }

    if (metric.type === 'criteria_judge') {
      if (testCase.expect?.no_tool) continue;
      judgeTasks.push(
        (async () => {
          try {
            const verdict = await runCriteriaJudge({
              prompt: testCase.prompt,
              toolOutput: resolveToolOutput(testCase, config, calls[0]?.name),
              agentResponse: response.content,
              toolCalls: response.tool_calls,
              criteria: metric.criteria ?? [],
              threshold: metric.threshold,
              model: input.model,
              apiKey: input.apiKey,
              baseUrl: input.baseUrl,
              backend: input.judgeBackend,
              complete: input.complete
            });
            if (!verdict.passed) {
              const failed = verdict.results.filter((r) => !r.pass);
              const detail =
                failed.length > 0
                  ? failed.map((r) => `${r.criterion} (${r.reason})`).join('; ')
                  : verdict.reasoning;
              failures.push(`criteria: ${detail}`);
            }
          } catch (err) {
            failures.push(`judge: ${err instanceof Error ? err.message : String(err)}`);
          }
        })()
      );
    }

    if (metric.type === 'llm_as_judge') {
      if (testCase.expect?.no_tool) continue;
      judgeTasks.push(
        (async () => {
          try {
            const verdict = await runLlmJudge({
              prompt: testCase.prompt,
              toolOutput: resolveToolOutput(testCase, config, calls[0]?.name),
              agentResponse: response.content,
              model: input.model,
              apiKey: input.apiKey,
              baseUrl: input.baseUrl,
              backend: input.judgeBackend,
              complete: input.complete
            });
            hallucinated = verdict.hallucinated;
            if (verdict.score !== 'PASS') {
              failures.push(`semantic: ${verdict.reasoning || 'llm_as_judge failed'}`);
            }
          } catch (err) {
            failures.push(`judge: ${err instanceof Error ? err.message : String(err)}`);
          }
        })()
      );
    }

    if (metric.type === 'plugin') {
      if (!metric.module) {
        failures.push('plugin: metric missing module path');
        continue;
      }
      const modulePath = resolvePath(input.suiteYamlPath, metric.module);
      try {
        const plugin = await loadMetricPlugin(pathToFileURL(modulePath).href);
        const trajectoryPreview = buildTrajectory({
          toolCalls: calls,
          content: response.content,
          haltedAutonomousExecution: response.haltedAutonomousExecution,
          stepFailures
        });
        const result = await plugin({
          testCase,
          response,
          trajectory: trajectoryPreview,
          availableTools: input.availableTools
        });
        if (!result.pass) {
          failures.push(`plugin: ${result.reason || 'plugin metric failed'}`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        failures.push(`plugin: ${msg}`);
      }
    }
  }

  await Promise.all(judgeTasks);

  const trajectory = buildTrajectory({
    toolCalls: calls,
    content: response.content,
    haltedAutonomousExecution: response.haltedAutonomousExecution,
    stepFailures
  });

  return {
    passed: failures.length === 0,
    failures,
    hallucinated,
    routingOk,
    schemaOk,
    trajectory,
    stepFailures
  };
}
