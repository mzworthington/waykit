import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { EvalRunner } from './runner.js';
import { loadDataset, productionTraceToJsonl } from './dataset.js';
import { detectRoutingDrift, shouldShadowEval } from './otel.js';
import { localJudge, localCriteriaJudge } from './judge.js';
import { generateReport, publishEvalReportToGithubSummary, renderGithubSummaryOverview } from './telemetry.js';
import { runCaseAssertions } from './run-assertions.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(here, '../../..');

function unavailableFetch(): typeof fetch {
  return async () => new Response('{"error":{"status":"UNAVAILABLE"}}', { status: 503 });
}

async function assertScriptedSuite(
  suiteRel: string,
  presentIds: readonly string[],
  skippedLiveIds: readonly string[] = []
): Promise<void> {
  const report = await new EvalRunner({ model: 'scripted' }).runSuite(path.join(repoDir, suiteRel));
  const failDetail = report.results.filter((r) => !r.passed).map((r) => `${r.id}: ${r.failures.join(',')}`).join(' | ');
  assert.equal(report.failed, 0, failDetail);
  const ids = new Set(report.results.map((r) => r.id));
  for (const id of presentIds) assert.ok(ids.has(id), id);
  for (const id of skippedLiveIds) assert.ok(!ids.has(id), id);
}

describe('EDD EvalRunner', () => {
  it('passes architecture routing suite with scripted model', async () => {
    const runner = new EvalRunner({
      model: 'scripted',
      systemPromptPath: path.join(repoDir, 'evals/edd/system_prompt.md')
    });
    const report = await runner.runSuite(path.join(repoDir, 'evals/edd/architecture_routing.yaml'));
    assert.equal(report.failed, 0, report.results.filter((r) => !r.passed).map((r) => r.failures.join(',')).join(' | '));
    assert.ok(report.routingAccuracy >= 95);
  });

  it('scores quality metrics with the local heuristic (same style as the agent)', async () => {
    const result = await runCaseAssertions({
      model: 'scripted',
      judgeBackend: 'heuristic',
      availableTools: ['read_architecture_yaml'],
      suiteYamlPath: path.join(repoDir, 'evals/edd/architecture_routing.yaml'),
      config: {
        name: 'Routing',
        dataset: 'x.jsonl',
        metrics: []
      },
      testCase: {
        id: 'route-01',
        prompt: 'Can you pull up the C4 model for the payment service?',
        expect: { tool: 'read_architecture_yaml' }
      },
      metrics: [
        { type: 'tool_selection', expected: 'read_architecture_yaml' },
        { type: 'task_completion' },
        { type: 'llm_as_judge' }
      ],
      response: {
        content: 'Architecture for payment-api loaded successfully.',
        tool_calls: [{ name: 'read_architecture_yaml', arguments: { componentId: 'payment-api' } }],
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        consecutiveToolFailures: 0,
        haltedAutonomousExecution: false
      }
    });
    assert.equal(result.passed, true, result.failures.join('; '));
    assert.equal(result.routingOk, true);
  });

  it('passes first-hour demo suite with scripted model', async () => {
    const runner = new EvalRunner({
      model: 'scripted',
      systemPromptPath: path.join(repoDir, 'evals/edd/system_prompt.md')
    });
    const report = await runner.runSuite(path.join(repoDir, 'evals/edd/demo.yaml'));
    assert.equal(report.failed, 0, report.results.filter((r) => !r.passed).map((r) => r.failures.join(',')).join(' | '));
    assert.ok(report.routingAccuracy >= 95);
    assert.ok(report.total >= 5);
  });

  it('passes self-correction suite', async () => {
    const runner = new EvalRunner({ model: 'scripted' });
    const report = await runner.runSuite(
      path.join(repoDir, 'evals/edd/architecture_self_correction.yaml')
    );
    assert.equal(report.failed, 0);
  });

  it('passes terminal fallback suite', async () => {
    const runner = new EvalRunner({ model: 'scripted' });
    const report = await runner.runSuite(path.join(repoDir, 'evals/edd/architecture_terminal.yaml'));
    assert.equal(report.failed, 0);
  });

  it('streams JSONL datasets', async () => {
    const cases = await loadDataset(path.join(repoDir, 'evals/edd/architecture_routing.jsonl'), [
      'routing'
    ]);
    assert.ok(cases.length >= 2);
    assert.ok(cases.every((c) => c.id && c.prompt));
  });

  it('converts production traces to JSONL', () => {
    const line = productionTraceToJsonl({
      id: 'prod-001',
      prompt: 'Show payment architecture',
      reason: 'circuit_breaker',
      history: [{ role: 'tool', content: '{"error":"Timeout"}' }]
    });
    const parsed = JSON.parse(line) as { tags: string[] };
    assert.ok(parsed.tags.includes('prod-derived'));
    assert.ok(parsed.tags.includes('circuit_breaker'));
  });

  it('detects routing drift', () => {
    const result = detectRoutingDrift({
      baseline: { version: '1.0', toolCounts: { read_architecture_yaml: 30, other: 70 } },
      current: { version: '1.1', toolCounts: { read_architecture_yaml: 2, other: 98 } },
      tool: 'read_architecture_yaml'
    });
    assert.equal(result.drifted, true);
  });

  it('samples shadow evals at ~5%', () => {
    let hits = 0;
    const n = 2000;
    let i = 0;
    const seq = Array.from({ length: n }, (_, idx) => idx / n);
    for (let k = 0; k < n; k++) {
      if (shouldShadowEval(0.05, () => seq[i++]!)) hits++;
    }
    assert.ok(hits >= 80 && hits <= 120, `hits=${hits}`);
  });

  it('local judge flags hallucinations', () => {
    const verdict = localJudge({
      prompt: 'Summarize architecture',
      toolOutput: { component: 'payment-api' },
      agentResponse: 'payment-api talks to the legacy-monolith and redis cluster'
    });
    assert.equal(verdict.score, 'FAIL');
    assert.equal(verdict.hallucinated, true);
  });

  it('writes markdown evaluation reports', async () => {
    const runner = new EvalRunner({ model: 'scripted' });
    const report = await runner.runSuite(path.join(repoDir, 'evals/edd/architecture_routing.yaml'));
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edd-report-'));
    const written = generateReport([report], { format: 'md', outDir: dir });
    assert.ok(written.some((p) => p.endsWith('edd-report.md')));
    assert.ok(written.some((p) => p.endsWith('eval-report.md')));
    const md = fs.readFileSync(path.join(dir, 'eval-report.md'), 'utf8');
    assert.match(md, /Agent Eval Report:/);
    assert.match(md, /Routing Accuracy/);
    assert.match(md, /Schema Adherence/);
    assert.match(md, /Failure Traces/);
  });

  it('publishes an overview table to a GitHub step summary file', async () => {
    const report = {
      suite: 'Architecture Routing',
      suitePath: '/tmp/suite.yaml',
      model: 'scripted',
      startedAt: '2026-08-31T00:00:00.000Z',
      finishedAt: '2026-08-31T00:00:01.000Z',
      total: 2,
      passed: 2,
      failed: 0,
      routingAccuracy: 100,
      schemaAdherence: 100,
      hallucinationRate: 0,
      totalTokens: 40,
      avgLatencyMs: 12,
      results: []
    };
    const overview = renderGithubSummaryOverview([report]);
    assert.match(overview, /EDD overview/);
    assert.match(overview, /Architecture Routing/);
    assert.match(overview, /100\.0%/);

    const summaryFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'gh-summary-')), 'summary.md');
    const published = publishEvalReportToGithubSummary([report], '# Agent Eval Report: demo\n', {
      GITHUB_STEP_SUMMARY: summaryFile
    });
    assert.equal(published, true);
    const body = fs.readFileSync(summaryFile, 'utf8');
    assert.match(body, /EDD overview/);
    assert.match(body, /Full eval report/);
    assert.match(body, /Agent Eval Report: demo/);
  });

  it('renders failure traces with diagnosis and suggested fix', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edd-fail-'));
    const written = generateReport(
      [
        {
          suite: 'Architecture Routing',
          suitePath: '/tmp/suite.yaml',
          model: 'claude-3-5-sonnet-latest',
          startedAt: '2026-08-30T00:00:00.000Z',
          finishedAt: '2026-08-30T00:01:00.000Z',
          total: 2,
          passed: 0,
          failed: 2,
          routingAccuracy: 0,
          schemaAdherence: 50,
          hallucinationRate: 0,
          totalTokens: 200,
          avgLatencyMs: 840,
          results: [
            {
              id: 'route-08',
              prompt: 'What is the database for the payment system?',
              passed: false,
              latencyMs: 800,
              tokens: 100,
              failures: ['routing: expected tool read_architecture_yaml, got (none)'],
              tags: ['edge-case', 'routing'],
              routingOk: false,
              trace: {
                diagnosis:
                  'Tool Selection Failure. The model refused to use the tool and hallucinated a generic answer.',
                suggestedFix:
                  'Add a constraint to the system prompt instructing the agent to never guess architectural details and to always use the provided C4 tools.',
                expectedTool: 'read_architecture_yaml',
                llmOutput:
                  "I don't have access to your database, but typically payment systems use PostgreSQL..."
              }
            },
            {
              id: 'schema-03',
              prompt: 'Check the architecture for the auth service and the payment api.',
              passed: false,
              latencyMs: 880,
              tokens: 100,
              failures: ['schema: expected componentId to be a string, got array'],
              tags: ['extraction', 'schema'],
              schemaOk: false,
              trace: {
                diagnosis:
                  'Schema Violation. The tool only accepts a string, but the model attempted to pass an array to handle the multi-intent prompt.',
                suggestedFix:
                  "Update the tool description to explicitly state that it can only be called for one component at a time, or update the tool's backend logic to accept arrays.",
                expectedArguments: '{"componentId":"auth-service"}',
                actualArguments: '{"componentId":["auth-service","payment-api"]}'
              }
            }
          ]
        }
      ],
      { format: 'md', outDir: dir }
    );
    const md = fs.readFileSync(written.find((p) => p.endsWith('eval-report.md'))!, 'utf8');
    assert.match(md, /Test ID: `route-08`/);
    assert.match(md, /Test ID: `schema-03`/);
    assert.match(md, /Tool Selection Failure/);
    assert.match(md, /Schema Violation/);
    assert.match(md, /Suggested Fix/);
  });

  it('emits per-case agent and judge progress', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-eval-progress-'));
    fs.writeFileSync(
      path.join(dir, 'cases.jsonl'),
      `${JSON.stringify({
        id: 'mini-01',
        prompt: 'lookup payment',
        tags: ['routing'],
        expect: { tool: 'read_architecture_yaml', arguments_contains: { componentId: 'payment-api' } }
      })}\n`,
      'utf8'
    );
    const suite = path.join(dir, 'suite.yaml');
    fs.writeFileSync(
      suite,
      `name: "Mini progress"
dataset: "cases.jsonl"
metrics:
  - type: "tool_selection"
  - type: "schema_match"
    strict: true
mocks:
  - tool: "read_architecture_yaml"
    response:
      status: "success"
      component: "payment-api"
`
    );

    const events: string[] = [];
    const runner = new EvalRunner({
      model: 'gemini-2.5-flash',
      apiKey: 'test-key',
      baseUrl: 'https://example.test/v1/',
      driver: async () => ({
        content: 'payment-api',
        tool_calls: [{ name: 'read_architecture_yaml', arguments: { componentId: 'payment-api' } }],
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
        routingConfidence: 1
      }),
      progress: {
        onSuiteStart(info) {
          events.push(`suite:${info.style}:${info.model}:${info.caseCount}:${info.baseUrl}`);
        },
        onCasePhase(info) {
          events.push(`phase:${info.phase}:${info.id}`);
        },
        onCaseDone(info) {
          events.push(`done:${info.id}:${info.passed}`);
        }
      }
    });

    const report = await runner.runSuite(suite);
    assert.equal(report.failed, 0, report.results[0]?.failures.join('; '));
    assert.deepEqual(events, [
      'suite:http:gemini-2.5-flash:1:https://example.test/v1/',
      'phase:agent:mini-01',
      'phase:judges:mini-01',
      'done:mini-01:true'
    ]);
  });

  it('skips requires-live cases when using the scripted driver', async () => {
    const all = await loadDataset(path.join(repoDir, 'evals/edd/architecture_routing.jsonl'));
    assert.ok(all.some((c) => c.tags?.includes('requires-live')));
    const runner = new EvalRunner({
      model: 'scripted',
      systemPromptPath: path.join(repoDir, 'evals/edd/system_prompt.md')
    });
    const report = await runner.runSuite(path.join(repoDir, 'evals/edd/architecture_routing.yaml'));
    assert.equal(report.failed, 0, report.results.filter((r) => !r.passed).map((r) => r.failures.join(',')).join(' | '));
    assert.ok(report.results.some((r) => r.id === 'inject-01'));
    assert.ok(!report.results.some((r) => r.id === 'schema-04'));
    assert.ok(!report.results.some((r) => (r.tags ?? []).includes('requires-live')));
  });

  it('runs requires-live cases when an injected agent driver is present', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edd-cli-agent-'));
    fs.writeFileSync(
      path.join(dir, 'cases.jsonl'),
      `${JSON.stringify({
        id: 'live-01',
        prompt: 'lookup payment',
        tags: ['requires-live'],
        expect: { tool: 'read_architecture_yaml' }
      })}\n`,
      'utf8'
    );
    const suite = path.join(dir, 'suite.yaml');
    fs.writeFileSync(
      suite,
      `name: "CliAgent"
dataset: "cases.jsonl"
metrics:
  - type: "tool_selection"
mocks:
  - tool: "read_architecture_yaml"
    response:
      status: "success"
      component: "payment-api"
`
    );
    const runner = new EvalRunner({
      model: 'cursor-grok-4.6-medium',
      style: 'cli',
      driver: async () => ({
        content: 'loaded',
        tool_calls: [{ name: 'read_architecture_yaml', arguments: { componentId: 'payment-api' } }],
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
      })
    });
    const report = await runner.runSuite(suite);
    assert.equal(report.total, 1);
    assert.equal(report.results[0]?.id, 'live-01');
    assert.equal(report.failed, 0, report.results[0]?.failures.join('; '));
  });

  it('excludes requires-live tags from loadDataset', async () => {
    const cases = await loadDataset(
      path.join(repoDir, 'evals/edd/architecture_routing.jsonl'),
      undefined,
      ['requires-live']
    );
    assert.ok(cases.every((c) => !(c.tags ?? []).includes('requires-live')));
    assert.ok(cases.some((c) => c.id === 'inject-01'));
  });

  it('asserts ordered expect.tools calls', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edd-tools-'));
    fs.writeFileSync(
      path.join(dir, 'cases.jsonl'),
      `${JSON.stringify({
        id: 'multi-01',
        prompt: 'lookup both',
        tags: ['routing'],
        expect: {
          tools: [
            { name: 'read_architecture_yaml', arguments_contains: { componentId: 'auth-service' } },
            { name: 'read_architecture_yaml', arguments_contains: { componentId: 'payment-api' } }
          ]
        }
      })}\n`
    );
    fs.writeFileSync(
      path.join(dir, 'suite.yaml'),
      `name: "Multi-tool"
dataset: "cases.jsonl"
metrics:
  - type: "tool_selection"
  - type: "schema_match"
    strict: true
  - type: "argument_correctness"
`    );
    const runner = new EvalRunner({
      model: 'scripted',
      driver: async () => ({
        content: 'Looked up both components.',
        tool_calls: [
          { name: 'read_architecture_yaml', arguments: { componentId: 'auth-service' } },
          { name: 'read_architecture_yaml', arguments: { componentId: 'payment-api' } }
        ],
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 }
      })
    });
    const report = await runner.runSuite(path.join(dir, 'suite.yaml'));
    assert.equal(report.failed, 0, report.results[0]?.failures.join(','));
    assert.equal(report.results[0]?.routingOk, true);
    assert.equal(report.results[0]?.schemaOk, true);
  });

  it('passes kit-knowledge suite with scripted model', async () => {
    const runner = new EvalRunner({ model: 'scripted' });
    const report = await runner.runSuite(path.join(repoDir, 'evals/edd/kit_knowledge.yaml'));
    assert.equal(report.failed, 0, report.results.filter((r) => !r.passed).map((r) => `${r.id}: ${r.failures.join(',')}`).join(' | '));
    assert.ok(report.results.some((r) => r.id === 'kit-handover-01'));
    assert.ok(report.results.some((r) => r.id === 'kit-sop-cf-01'));
    assert.ok(report.results.some((r) => r.id === 'kit-sop-intake-01'));
    assert.ok(report.results.some((r) => r.id === 'kit-sop-model-01'));
    assert.ok(report.results.some((r) => r.id === 'kit-sop-debug-ci-no-pkg-01'));
    assert.ok(!report.results.some((r) => r.id === 'kit-live-01'));
    assert.ok(!report.results.some((r) => r.id === 'kit-live-02'));
  });

  it('passes model-routing suite with scripted model', async () => {
    const runner = new EvalRunner({ model: 'scripted' });
    const report = await runner.runSuite(path.join(repoDir, 'evals/edd/model_routing.yaml'));
    assert.equal(report.failed, 0, report.results.filter((r) => !r.passed).map((r) => `${r.id}: ${r.failures.join(',')}`).join(' | '));
    assert.ok(report.results.some((r) => r.id === 'model-plan-01'));
    assert.ok(report.results.some((r) => r.id === 'model-implement-01'));
    assert.ok(report.results.some((r) => r.id === 'model-escalate-01'));
    assert.ok(!report.results.some((r) => r.id === 'model-live-01'));
  });

  it('passes cloudflare-ops suite with scripted model', async () => {
    await assertScriptedSuite('evals/edd/cloudflare_ops.yaml', ['cf-rum-01', 'cf-obs-01'], ['cf-live-01']);
  });

  it('passes posthog-intake suite with scripted model', async () => {
    await assertScriptedSuite(
      'evals/edd/posthog_intake.yaml',
      ['ph-intake-01', 'ph-intake-nofile-01', 'ph-file-01'],
      ['ph-live-01']
    );
  });

  it('loads a prod-derived circuit-breaker case', async () => {
    const cases = await loadDataset(path.join(repoDir, 'evals/edd/architecture_terminal.jsonl'), [
      'prod-derived'
    ]);
    assert.equal(cases.length, 1);
    assert.equal(cases[0]?.id, 'prod-cb-01');
    assert.equal(cases[0]?.expect?.no_tool, true);
  });

  it('round-trips the prod-trace example through productionTraceToJsonl', () => {
    const fixturePath = path.join(repoDir, 'evals/edd/examples/prod-trace.json');
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as {
      id: string;
      prompt: string;
      reason: 'circuit_breaker';
      history: unknown[];
      expect: { no_tool: boolean };
    };
    const line = productionTraceToJsonl({
      id: fixture.id,
      prompt: fixture.prompt,
      reason: fixture.reason,
      history: fixture.history as never,
      expect: fixture.expect
    });
    const parsed = JSON.parse(line) as { tags: string[]; expect?: { no_tool?: boolean } };
    assert.ok(parsed.tags.includes('prod-derived'));
    assert.ok(parsed.tags.includes('circuit_breaker'));
    assert.equal(parsed.expect?.no_tool, true);
  });

  it('fails argument_correctness when schema-valid args have wrong values', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edd-arg-'));
    fs.writeFileSync(
      path.join(dir, 'cases.jsonl'),
      `${JSON.stringify({
        id: 'arg-01',
        prompt: 'Show payment architecture',
        tags: ['routing'],
        expect: {
          tool: 'read_architecture_yaml',
          arguments_contains: { componentId: 'payment-api' }
        }
      })}\n`
    );
    fs.writeFileSync(
      path.join(dir, 'suite.yaml'),
      `name: "Argument correctness"
dataset: "cases.jsonl"
metrics:
  - type: "schema_match"
    strict: true
  - type: "argument_correctness"
`
    );
    const runner = new EvalRunner({
      model: 'scripted',
      driver: async () => ({
        content: 'Looked up billing.',
        tool_calls: [{ name: 'read_architecture_yaml', arguments: { componentId: 'billing-api' } }],
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 }
      })
    });
    const report = await runner.runSuite(path.join(dir, 'suite.yaml'));
    assert.equal(report.failed, 1);
    assert.equal(report.results[0]?.schemaOk, true);
    assert.ok(report.results[0]?.failures.some((f) => f.startsWith('argument:')));
  });

  it('passes argument_correctness when argument meaning matches', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edd-arg-ok-'));
    fs.writeFileSync(
      path.join(dir, 'cases.jsonl'),
      `${JSON.stringify({
        id: 'arg-02',
        prompt: 'Show payment architecture',
        expect: {
          tool: 'read_architecture_yaml',
          arguments_contains: { componentId: 'payment-api' }
        }
      })}\n`
    );
    fs.writeFileSync(
      path.join(dir, 'suite.yaml'),
      `name: "Argument ok"
dataset: "cases.jsonl"
metrics:
  - type: "argument_correctness"
`
    );
    const runner = new EvalRunner({
      model: 'scripted',
      driver: async () => ({
        content: 'payment-api architecture',
        tool_calls: [{ name: 'read_architecture_yaml', arguments: { componentId: 'payment-api' } }],
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 }
      })
    });
    const report = await runner.runSuite(path.join(dir, 'suite.yaml'));
    assert.equal(report.failed, 0, report.results[0]?.failures.join(','));
  });

  it('scores task_completion from expected tool outcome', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edd-task-'));
    fs.writeFileSync(
      path.join(dir, 'cases.jsonl'),
      `${JSON.stringify({
        id: 'task-01',
        prompt: 'Pull payment C4',
        expect: { tool: 'read_architecture_yaml', goal: 'Retrieve payment architecture' }
      })}\n${JSON.stringify({
        id: 'task-02',
        prompt: 'Pull payment C4',
        expect: { tool: 'read_architecture_yaml', goal: 'Retrieve payment architecture' }
      })}\n`
    );
    fs.writeFileSync(
      path.join(dir, 'suite.yaml'),
      `name: "Task completion"
dataset: "cases.jsonl"
metrics:
  - type: "task_completion"
`
    );
    let n = 0;
    const runner = new EvalRunner({
      model: 'scripted',
      driver: async () => {
        n += 1;
        if (n === 1) {
          return {
            content: 'Here is payment-api.',
            tool_calls: [{ name: 'read_architecture_yaml', arguments: { componentId: 'payment-api' } }],
            usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 }
          };
        }
        return {
          content: 'I asked a related system.',
          tool_calls: [{ name: 'search_kit', arguments: { query: 'payment' } }],
          usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 }
        };
      }
    });
    const report = await runner.runSuite(path.join(dir, 'suite.yaml'));
    assert.equal(report.results[0]?.passed, true, report.results[0]?.failures.join(','));
    assert.equal(report.results[1]?.passed, false);
    assert.ok(report.results[1]?.failures.some((f) => f.startsWith('completion:')));
  });

  it('scores criteria_judge with threshold and per-criterion reasons', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edd-crit-'));
    fs.writeFileSync(
      path.join(dir, 'cases.jsonl'),
      `${JSON.stringify({
        id: 'crit-01',
        prompt: 'Summarize architecture',
        tool_output: { component: 'payment-api' },
        expect: { tool: 'read_architecture_yaml' }
      })}\n`
    );
    fs.writeFileSync(
      path.join(dir, 'suite.yaml'),
      `name: "Criteria"
dataset: "cases.jsonl"
metrics:
  - type: "criteria_judge"
    threshold: 1.0
    criteria:
      - "Response must reflect the tool output"
      - "Response must not invent components absent from tool output"
`
    );
    const passRunner = new EvalRunner({
      model: 'scripted',
      driver: async () => ({
        content: 'payment-api talks to payment-db per architecture.',
        tool_calls: [{ name: 'read_architecture_yaml', arguments: { componentId: 'payment-api' } }],
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 }
      })
    });
    const passReport = await passRunner.runSuite(path.join(dir, 'suite.yaml'));
    assert.equal(passReport.failed, 0, passReport.results[0]?.failures.join(','));

    const failRunner = new EvalRunner({
      model: 'scripted',
      driver: async () => ({
        content: 'payment-api talks to the legacy-monolith and redis cluster',
        tool_calls: [{ name: 'read_architecture_yaml', arguments: { componentId: 'payment-api' } }],
        usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 }
      })
    });
    const failReport = await failRunner.runSuite(path.join(dir, 'suite.yaml'));
    assert.equal(failReport.failed, 1);
    assert.ok(failReport.results[0]?.failures.some((f) => f.startsWith('criteria:')));
    assert.ok(failReport.results[0]?.failures[0]?.includes('invent'));
  });

  it('localCriteriaJudge respects threshold below 1', () => {
    const verdict = localCriteriaJudge({
      prompt: 'x',
      toolOutput: { component: 'payment-api' },
      agentResponse: 'payment-api architecture looks fine',
      criteria: [
        'Response must reflect the tool output',
        'Response must not invent components absent from tool output'
      ],
      threshold: 0.5
    });
    assert.equal(verdict.passed, true);
    assert.ok(verdict.score >= 0.5);
  });

  it('records agent output and continues the suite when judges return 503', async () => {
    const prevAttempts = process.env.KIT_EVAL_RETRY_ATTEMPTS;
    const prevBackoff = process.env.KIT_EVAL_RETRY_BACKOFF_MS;
    process.env.KIT_EVAL_RETRY_ATTEMPTS = '2';
    process.env.KIT_EVAL_RETRY_BACKOFF_MS = '0';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = unavailableFetch();

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edd-judge-503-'));
    fs.writeFileSync(
      path.join(dir, 'cases.jsonl'),
      `${JSON.stringify({
        id: 'case-01',
        prompt: 'lookup payment',
        tags: ['routing'],
        expect: { tool: 'read_architecture_yaml', arguments_contains: { componentId: 'payment-api' } }
      })}\n${JSON.stringify({
        id: 'case-02',
        prompt: 'lookup payment again',
        tags: ['routing'],
        expect: { tool: 'read_architecture_yaml', arguments_contains: { componentId: 'payment-api' } }
      })}\n`
    );
    const suite = path.join(dir, 'suite.yaml');
    fs.writeFileSync(
      suite,
      `name: "Judge 503"
dataset: "cases.jsonl"
metrics:
  - type: "tool_selection"
  - type: "task_completion"
mocks:
  - tool: "read_architecture_yaml"
    response:
      status: "success"
      component: "payment-api"
`
    );

    try {
      const runner = new EvalRunner({
        model: 'gemini-3.7-flash',
        apiKey: 'test-key',
        baseUrl: 'https://example.test/v1/',
        driver: async () => ({
          content: 'payment-api',
          tool_calls: [{ name: 'read_architecture_yaml', arguments: { componentId: 'payment-api' } }],
          usage: { promptTokens: 1, completionTokens: 1, totalTokens: 7 },
          routingConfidence: 1
        })
      });
      const report = await runner.runSuite(suite);
      assert.equal(report.total, 2);
      assert.equal(report.failed, 2);
      assert.equal(report.results[0]?.tokens, 7);
      assert.equal(report.results[0]?.routingOk, true);
      assert.ok(report.results[0]?.failures.some((f) => f.includes('503')));
      assert.equal(report.results[1]?.id, 'case-02');
      assert.equal(report.results[1]?.tokens, 7);
    } finally {
      globalThis.fetch = originalFetch;
      if (prevAttempts === undefined) delete process.env.KIT_EVAL_RETRY_ATTEMPTS;
      else process.env.KIT_EVAL_RETRY_ATTEMPTS = prevAttempts;
      if (prevBackoff === undefined) delete process.env.KIT_EVAL_RETRY_BACKOFF_MS;
      else process.env.KIT_EVAL_RETRY_BACKOFF_MS = prevBackoff;
    }
  });

  it('continues the suite when the agent provider returns 503', async () => {
    const prevAttempts = process.env.KIT_EVAL_RETRY_ATTEMPTS;
    const prevBackoff = process.env.KIT_EVAL_RETRY_BACKOFF_MS;
    process.env.KIT_EVAL_RETRY_ATTEMPTS = '2';
    process.env.KIT_EVAL_RETRY_BACKOFF_MS = '0';
    const originalFetch = globalThis.fetch;
    globalThis.fetch = unavailableFetch();

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edd-agent-503-'));
    fs.writeFileSync(
      path.join(dir, 'cases.jsonl'),
      `${JSON.stringify({
        id: 'agent-01',
        prompt: 'lookup payment',
        tags: ['routing'],
        expect: { tool: 'read_architecture_yaml' }
      })}\n${JSON.stringify({
        id: 'agent-02',
        prompt: 'lookup payment again',
        tags: ['routing'],
        expect: { tool: 'read_architecture_yaml' }
      })}\n`
    );
    const suite = path.join(dir, 'suite.yaml');
    fs.writeFileSync(
      suite,
      `name: "Agent 503"
dataset: "cases.jsonl"
metrics:
  - type: "tool_selection"
`
    );

    try {
      const runner = new EvalRunner({
        model: 'gemini-3.7-flash',
        apiKey: 'test-key',
        baseUrl: 'https://example.test/v1/'
      });
      const report = await runner.runSuite(suite);
      assert.equal(report.total, 2);
      assert.equal(report.failed, 2);
      assert.equal(report.results[0]?.id, 'agent-01');
      assert.ok(report.results[0]?.failures.some((f) => /LLM provider error 503/.test(f)));
      assert.equal(report.results[1]?.id, 'agent-02');
    } finally {
      globalThis.fetch = originalFetch;
      if (prevAttempts === undefined) delete process.env.KIT_EVAL_RETRY_ATTEMPTS;
      else process.env.KIT_EVAL_RETRY_ATTEMPTS = prevAttempts;
      if (prevBackoff === undefined) delete process.env.KIT_EVAL_RETRY_BACKOFF_MS;
      else process.env.KIT_EVAL_RETRY_BACKOFF_MS = prevBackoff;
    }
  });
});
