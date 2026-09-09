import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { EvalRunner } from './runner.js';
import { synthesizeParaphrases } from './synthesize.js';
import { evaluateMcpUse } from './mcp-use.js';
import { evaluatePlanAdherence, evaluateStepEfficiency } from './plan-metrics.js';
import { buildTrajectory } from './trajectory.js';
import { dedupeCases, lintCases, casesFromTraceFile } from './dataset-hygiene.js';
import { stripAnsi } from '../cli/outcome.js';
import { handleEddEvalCli } from './edd_cli.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoDir = path.resolve(here, '../../..');

describe('EDD phases 2-4', () => {
  it('synthesizes paraphrases that preserve expectations and tag synthetic', () => {
    const seed = {
      id: 'seed-01',
      prompt: 'Show payment architecture.',
      tags: ['routing'],
      expect: { tool: 'read_architecture_yaml', arguments_contains: { componentId: 'payment-api' } }
    };
    const rows = synthesizeParaphrases(seed, 2);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.expect?.tool, 'read_architecture_yaml');
    assert.ok(rows[0]?.tags?.includes('synthetic'));
    assert.ok(rows[0]?.tags?.includes('requires-live'));
    assert.notEqual(rows[0]?.prompt, seed.prompt);
  });

  it('passes the safety suite with the scripted driver', async () => {
    const runner = new EvalRunner({
      model: 'scripted',
      systemPromptPath: path.join(repoDir, 'evals/edd/system_prompt.md')
    });
    const report = await runner.runSuite(path.join(repoDir, 'evals/edd/safety.yaml'));
    assert.equal(
      report.failed,
      0,
      report.results.filter((r) => !r.passed).map((r) => `${r.id}: ${r.failures.join(',')}`).join(' | ')
    );
    assert.ok(report.results.some((r) => r.id === 'safe-inject-01'));
    assert.ok(!report.results.some((r) => r.id === 'safe-live-01'));
  });

  it('evaluates mcp_use against the available catalog', () => {
    const ok = evaluateMcpUse({
      toolCalls: [{ name: 'read_architecture_yaml', arguments: {} }],
      availableTools: ['read_architecture_yaml'],
      expectTool: 'read_architecture_yaml'
    });
    assert.deepEqual(ok, []);
    const bad = evaluateMcpUse({
      toolCalls: [{ name: 'shell_exec', arguments: {} }],
      availableTools: ['read_architecture_yaml']
    });
    assert.ok(bad.some((f) => f.includes('mcp:')));
  });

  it('flags plan drift and inefficient extra steps', () => {
    const plan = evaluatePlanAdherence({
      expectedPlan: ['a', 'b'],
      toolCalls: [
        { name: 'a', arguments: {} },
        { name: 'c', arguments: {} }
      ]
    });
    assert.ok(plan.failures.some((f) => f.includes('step[1]')));
    assert.equal(plan.stepFailures.get(1)?.includes('step[1]'), true);

    const efficiency = evaluateStepEfficiency({
      toolCalls: [{ name: 'a', arguments: {} }, { name: 'b', arguments: {} }, { name: 'c', arguments: {} }],
      maxSteps: 2
    });
    assert.ok(efficiency[0]?.startsWith('efficiency:'));
  });

  it('builds trajectory steps for tool calls and halts', () => {
    const steps = buildTrajectory({
      toolCalls: [{ name: 'read_architecture_yaml', arguments: { componentId: 'payment-api' } }],
      content: 'done',
      stepFailures: new Map([[0, 'plan: step[0] expected other']])
    });
    assert.equal(steps[0]?.kind, 'tool');
    assert.ok(steps[0]?.failure);

    const halt = buildTrajectory({
      toolCalls: [],
      content: 'stopping',
      haltedAutonomousExecution: true
    });
    assert.equal(halt[0]?.kind, 'halt');
  });

  it('lints and dedupes datasets', () => {
    const issues = lintCases([
      { line: 1, raw: { id: 'a', prompt: 'x', expect: { no_tool: true } } },
      { line: 2, raw: { id: 'a', prompt: 'y', expect: { no_tool: true } } },
      { line: 3, raw: { prompt: 'missing-id' } }
    ]);
    assert.ok(issues.some((i) => i.message.includes('duplicate')));
    assert.ok(issues.some((i) => i.line === 3));

    const { kept, removed } = dedupeCases([
      { id: '1', prompt: 'same', expect: { no_tool: true } },
      { id: '2', prompt: 'same', expect: { no_tool: true } },
      { id: '3', prompt: 'other', expect: { no_tool: true } }
    ]);
    assert.equal(kept.length, 2);
    assert.equal(removed.length, 1);
  });

  it('converts traces via dataset hygiene', () => {
    const row = casesFromTraceFile({
      id: 't-1',
      prompt: 'retry',
      reason: 'circuit_breaker',
      expect: { no_tool: true }
    });
    assert.ok(row.tags?.includes('prod-derived'));
  });

  it('runs plugin metrics from a module path', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edd-plugin-'));
    const pluginPath = path.join(dir, 'plugin.mjs');
    fs.writeFileSync(
      pluginPath,
      `export default function evaluate(ctx) {
  const ok = (ctx.response.tool_calls?.[0]?.name === 'read_architecture_yaml');
  return { pass: ok, reason: ok ? 'ok' : 'wrong tool' };
}
`
    );
    fs.writeFileSync(
      path.join(dir, 'cases.jsonl'),
      `${JSON.stringify({
        id: 'plug-01',
        prompt: 'Show payment architecture',
        expect: { tool: 'read_architecture_yaml' }
      })}\n`
    );
    fs.writeFileSync(
      path.join(dir, 'suite.yaml'),
      `name: "Plugin"
dataset: "cases.jsonl"
metrics:
  - type: "plugin"
    module: "./plugin.mjs"
`
    );
    const runner = new EvalRunner({
      model: 'scripted',
      driver: async () => ({
        content: 'ok',
        tool_calls: [{ name: 'read_architecture_yaml', arguments: { componentId: 'payment-api' } }],
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
      })
    });
    const report = await runner.runSuite(path.join(dir, 'suite.yaml'));
    assert.equal(report.failed, 0, report.results[0]?.failures.join(','));
    assert.ok(report.results[0]?.trajectory?.length);
  });

  it('supports wk eval dataset lint via CLI', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edd-ds-'));
    const dataset = path.join(dir, 'cases.jsonl');
    fs.writeFileSync(
      dataset,
      `${JSON.stringify({ id: 'ok', prompt: 'hi', expect: { no_tool: true } })}\n`
    );
    const code = await handleEddEvalCli({
      repoDir,
      args: ['dataset', 'lint', '--dataset', dataset]
    });
    assert.equal(code, 0);
  });

  it('supports dataset synthesize, dedupe, and from-trace via CLI', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edd-ds2-'));
    const dataset = path.join(dir, 'seed.jsonl');
    fs.writeFileSync(
      dataset,
      `${JSON.stringify({ id: 's1', prompt: 'Show payment architecture.', tags: ['routing'], expect: { tool: 'read_architecture_yaml' } })}\n` +
        `${JSON.stringify({ id: 's2', prompt: 'Show payment architecture.', tags: ['routing'], expect: { tool: 'read_architecture_yaml' } })}\n`
    );
    const synOut = path.join(dir, 'syn.jsonl');
    assert.equal(
      await handleEddEvalCli({
        repoDir,
        args: ['dataset', 'synthesize', '--dataset', dataset, '--count', '1', '--out', synOut]
      }),
      0
    );
    assert.ok(fs.existsSync(synOut));

    const dedupeOut = path.join(dir, 'deduped.jsonl');
    assert.equal(
      await handleEddEvalCli({
        repoDir,
        args: ['dataset', 'dedupe', '--dataset', dataset, '--out', dedupeOut]
      }),
      0
    );
    const deduped = fs.readFileSync(dedupeOut, 'utf8').trim().split('\n');
    assert.equal(deduped.length, 1);

    const trace = path.join(dir, 'trace.json');
    fs.writeFileSync(
      trace,
      JSON.stringify({
        id: 't1',
        prompt: 'retry',
        reason: 'circuit_breaker',
        expect: { no_tool: true }
      })
    );
    const fromOut = path.join(dir, 'from.jsonl');
    assert.equal(
      await handleEddEvalCli({
        repoDir,
        args: ['dataset', 'from-trace', '--trace', trace, '--out', fromOut]
      }),
      0
    );
    assert.match(fs.readFileSync(fromOut, 'utf8'), /prod-derived/);
  });

  it('prints specialist vs skill-picker miss rates', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edd-miss-rate-'));
    fs.mkdirSync(path.join(dir, 'evals', 'edd'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'evals', 'suites'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'evals', 'edd', 'subagent_routing.jsonl'),
      '{"id":"a","prompt":"x","tags":["seed"],"expect":{"no_tool":true}}\n'
    );
    fs.writeFileSync(
      path.join(dir, 'evals', 'suites', 'routing-matrix.json'),
      JSON.stringify({ test_cases: [{ id: 'EVAL-1' }] })
    );
    const logs: string[] = [];
    const orig = console.log;
    console.log = (msg?: unknown) => {
      logs.push(String(msg ?? ''));
    };
    try {
      assert.equal(await handleEddEvalCli({ repoDir: dir, args: ['miss-rate'] }), 0);
    } finally {
      console.log = orig;
    }
    assert.match(stripAnsi(logs.join('\n')), /warn  eval miss-rate/);
    assert.match(logs.join('\n'), /verdict: not-enough/);
  });

  it('redacts credential-like strings in report text', async () => {
    const { redactSecrets } = await import('./redact.js');
    assert.match(redactSecrets('key sk-abc123456789 token'), /REDACTED_API_KEY/);
    assert.match(redactSecrets('Authorization: Bearer abcdefghijklmnop'), /REDACTED_TOKEN/);
  });

  it('attaches trajectory step failures in multi-step reports', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edd-traj-'));
    fs.writeFileSync(
      path.join(dir, 'cases.jsonl'),
      `${JSON.stringify({
        id: 'traj-01',
        prompt: 'lookup both',
        tags: ['routing'],
        expect: {
          tools: [
            { name: 'read_architecture_yaml' },
            { name: 'read_architecture_yaml' }
          ]
        }
      })}\n`
    );
    fs.writeFileSync(
      path.join(dir, 'suite.yaml'),
      `name: "Trajectory"
dataset: "cases.jsonl"
metrics:
  - type: "plan_adherence"
  - type: "step_efficiency"
    max_steps: 2
`
    );
    const runner = new EvalRunner({
      model: 'scripted',
      driver: async () => ({
        content: 'done',
        tool_calls: [
          { name: 'read_architecture_yaml', arguments: { componentId: 'auth-service' } },
          { name: 'search_kit', arguments: { query: 'x' } }
        ],
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
      })
    });
    const report = await runner.runSuite(path.join(dir, 'suite.yaml'));
    assert.equal(report.failed, 1);
    assert.ok(report.results[0]?.failures.some((f) => f.startsWith('plan:')));
    assert.equal(report.results[0]?.trace?.stepIndex, 1);
    assert.ok(report.results[0]?.trajectory?.some((s) => s.failure));
  });
});
