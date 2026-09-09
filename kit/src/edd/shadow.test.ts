import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { handleEddEvalCli, mulberry32 } from './edd_cli.js';
import { emitAgentSpan, type OtelSpan } from './otel.js';
import {
  kitSpanToOtlpJson,
  normalizeProdTurn,
  shadowEvalTurn,
  shadowEvalTurns
} from './shadow.js';

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('shadow eval', () => {
  it('normalizes kit OTel spans and prod turns', () => {
    const fixture = JSON.parse(
      fs.readFileSync(path.join(repoDir, 'evals/edd/examples/otel-agent-loop.json'), 'utf8')
    );
    const fromSpan = normalizeProdTurn(fixture);
    assert.equal(fromSpan.id, 'prod-halluc-01');
    assert.match(fromSpan.prompt, /payment-api/);
    assert.equal(fromSpan.toolCalls?.[0]?.name, 'read_architecture_yaml');

    const fromTurn = normalizeProdTurn({
      id: 't1',
      prompt: 'hi',
      tool_calls: [{ name: 'read_architecture_yaml', arguments: {} }]
    });
    assert.equal(fromTurn.id, 't1');
    assert.equal(fromTurn.toolCalls?.[0]?.name, 'read_architecture_yaml');
  });

  it('builds OTLP JSON from kit spans', () => {
    const spans: OtelSpan[] = [];
    emitAgentSpan((s) => spans.push(s), {
      prompt: 'x',
      toolCalls: [{ name: 'read_architecture_yaml', arguments: {} }],
      latencyMs: 10,
      tokens: 5,
      passed: false
    });
    const otlp = kitSpanToOtlpJson(spans[0]!);
    const span = (otlp.resourceSpans as Array<{ scopeSpans: Array<{ spans: Array<Record<string, unknown>> }> }>)[0]!
      .scopeSpans[0]!.spans[0]!;
    assert.equal(span.name, 'agent.loop');
    assert.equal((span.status as { code: number }).code, 2);
  });

  it('samples and promotes shadow fails to prod-derived JSONL', () => {
    const fail = shadowEvalTurn(
      {
        id: 'h1',
        prompt: 'Summarize architecture',
        toolOutput: { component: 'payment-api' },
        agentResponse: 'payment-api talks to the legacy-monolith and redis cluster',
        expect: { tool: 'read_architecture_yaml' }
      },
      { sampleRate: 1, rand: () => 0 }
    );
    assert.equal(fail.sampled, true);
    assert.equal(fail.passed, false);
    assert.ok(fail.jsonl);
    assert.match(fail.jsonl!, /shadow_fail/);
    assert.match(fail.jsonl!, /prod-derived/);

    const skip = shadowEvalTurn(
      {
        id: 'h2',
        prompt: 'Summarize architecture',
        toolOutput: { component: 'payment-api' },
        agentResponse: 'payment-api talks to the legacy-monolith'
      },
      { sampleRate: 0.05, rand: () => 0.99 }
    );
    assert.equal(skip.sampled, false);
  });

  it('runs wk eval shadow on the example corpus', async () => {
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'edd-shadow-')), 'fails.jsonl');
    const code = await handleEddEvalCli({
      repoDir,
      args: [
        'shadow',
        '--infile',
        path.join(repoDir, 'evals/edd/examples/prod-turns.jsonl'),
        '--sample',
        '1',
        '--seed',
        '1',
        '--out',
        out
      ]
    });
    assert.equal(code, 1); // fails present
    const lines = fs.readFileSync(out, 'utf8').trim().split('\n');
    assert.ok(lines.length >= 1);
    assert.match(lines[0]!, /shadow_fail/);
  });

  it('mulberry32 is deterministic', () => {
    const a = mulberry32(1);
    const b = mulberry32(1);
    assert.equal(a(), b());
  });

  it('shadowEvalTurns aggregates fails', () => {
    const { sampled, failed, fails } = shadowEvalTurns(
      [
        {
          id: 'ok',
          prompt: 'Summarize architecture',
          toolOutput: { component: 'payment-api' },
          agentResponse: 'payment-api architecture summary'
        },
        {
          id: 'bad',
          prompt: 'Summarize architecture',
          toolOutput: { component: 'payment-api' },
          agentResponse: 'payment-api talks to the legacy-monolith and redis cluster'
        }
      ],
      { sampleRate: 1, rand: () => 0 }
    );
    assert.equal(sampled, 2);
    assert.equal(failed, 1);
    assert.equal(fails[0]?.id, 'shadow-bad');
  });
});
