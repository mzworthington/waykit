import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runLlmJudge, runCriteriaJudge, runTaskCompletionJudge } from './run-judges.js';
import {
  createCliJudgeCompletion,
  parseJudgeCliStdout,
  resolveJudgeApiKey,
  resolveJudgeBackend,
  resolveJudgeCompletion,
  type ExecFileFn
} from './judge-provider.js';

describe('parseJudgeCliStdout', () => {
  it('returns a raw judge object', () => {
    assert.deepEqual(parseJudgeCliStdout('{"score":"PASS","reasoning":"ok"}'), {
      score: 'PASS',
      reasoning: 'ok'
    });
  });

  it('unwraps Claude Code / Cursor result envelopes', () => {
    const envelope = JSON.stringify({
      type: 'result',
      result: '{"score":"FAIL","reasoning":"invented"}'
    });
    assert.deepEqual(parseJudgeCliStdout(envelope), {
      score: 'FAIL',
      reasoning: 'invented'
    });
  });

  it('extracts JSON embedded in prose', () => {
    assert.equal(parseJudgeCliStdout('Here you go:\n{"score":"PASS","reasoning":"fine"}\n').score, 'PASS');
  });
});

describe('resolveJudgeBackend', () => {
  it('defaults scripted models to heuristic even with an API key', () => {
    assert.equal(resolveJudgeBackend({ model: 'scripted', apiKey: 'sk-test' }), 'heuristic');
  });

  it('selects http for live models with a key or base URL', () => {
    assert.equal(resolveJudgeBackend({ model: 'gpt-4o-mini', apiKey: 'sk-test' }), 'http');
    assert.equal(
      resolveJudgeBackend({ model: 'llama3.1', baseUrl: 'http://localhost:11434/v1' }),
      'http'
    );
  });

  it('honors explicit style', () => {
    assert.equal(
      resolveJudgeBackend({ model: 'cursor-grok-4.6-medium', style: 'cli', cli: 'cursor-agent' }),
      'cli'
    );
    assert.equal(resolveJudgeBackend({ model: 'gpt-4o-mini', style: 'http', baseUrl: 'http://x' }), 'http');
    assert.equal(resolveJudgeBackend({ model: 'scripted', style: 'local', apiKey: 'k' }), 'heuristic');
  });
});

describe('resolveJudgeCompletion / apiKey', () => {
  it('returns undefined for heuristic and HTTP adapter for http', () => {
    assert.equal(resolveJudgeCompletion({ model: 'scripted' }), undefined);
    assert.ok(resolveJudgeCompletion({ model: 'llama3.1', baseUrl: 'http://localhost:11434/v1' }));
  });

  it('fills a dummy api key for local HTTP and CLI', () => {
    assert.equal(resolveJudgeApiKey(undefined, 'http://localhost:11434/v1', 'http'), 'local');
    assert.equal(resolveJudgeApiKey(undefined, undefined, 'cli'), 'cli');
    assert.equal(resolveJudgeApiKey('sk-real', undefined, 'http'), 'sk-real');
  });
});

describe('createCliJudgeCompletion', () => {
  it('shells out with preset args and parses stdout', async () => {
    const calls: Array<{ file: string; args: string[] }> = [];
    const execFile: ExecFileFn = async (file, args) => {
      calls.push({ file, args });
      return {
        stdout: JSON.stringify({ result: '{"score":"PASS","reasoning":"from-cli"}' }),
        stderr: ''
      };
    };
    const complete = createCliJudgeCompletion({ cli: 'claude', execFile });
    const parsed = await complete({
      model: 'scripted',
      prompt: 'grade this',
      apiKey: 'cli'
    });
    assert.deepEqual(parsed, { score: 'PASS', reasoning: 'from-cli' });
    assert.equal(calls[0]?.file, 'claude');
    assert.deepEqual(calls[0]?.args.slice(0, 4), ['-p', 'grade this', '--output-format', 'json']);
  });

  it('forwards child stdout chunks to onStdout while still parsing JSON', async () => {
    const seen: string[] = [];
    const execFile: ExecFileFn = async (_file, _args, options) => {
      options.onStdout?.('live-chunk');
      return { stdout: '{"score":"PASS","reasoning":"ok"}', stderr: '' };
    };
    const parsed = await createCliJudgeCompletion({
      cli: 'claude',
      execFile,
      onStdout: (chunk) => seen.push(chunk)
    })({
      model: 'scripted',
      prompt: 'x',
      apiKey: 'cli'
    });
    assert.deepEqual(seen, ['live-chunk']);
    assert.equal(parsed.score, 'PASS');
  });

  it('spawns cursor-agent for cursor aliases and prefers ~/.local/bin', async () => {
    const calls: Array<{ file: string; args: string[] }> = [];
    const execFile: ExecFileFn = async (file, args) => {
      calls.push({ file, args });
      return { stdout: '{"score":"PASS","reasoning":"ok"}', stderr: '' };
    };
    await createCliJudgeCompletion({ cli: 'cursor-agent', execFile })({
      model: 'composer',
      prompt: 'x',
      apiKey: 'cli'
    });
    assert.equal(calls[0]?.file, 'cursor-agent');
    assert.ok(calls[0]?.args.includes('--mode=ask'));
    assert.ok(calls[0]?.args.includes('--model'));
    assert.ok(calls[0]?.args.includes('composer'));
    await createCliJudgeCompletion({
      cli: 'cursor',
      execFile,
      homedir: '/Users/me',
      exists: (p) => p === '/Users/me/.local/bin/cursor-agent'
    })({
      model: 'scripted',
      prompt: 'y',
      apiKey: 'cli'
    });
    assert.equal(calls[1]?.file, '/Users/me/.local/bin/cursor-agent');
  });

  it('passes --trust so cursor-agent can run without a workspace prompt', async () => {
    const calls: Array<{ args: string[] }> = [];
    const execFile: ExecFileFn = async (_file, args) => {
      calls.push({ args });
      return { stdout: '{"score":"PASS","reasoning":"ok"}', stderr: '' };
    };
    await createCliJudgeCompletion({ cli: 'cursor-agent', execFile, exists: () => false })({
      model: 'cursor-grok-4.6-medium',
      prompt: 'x',
      apiKey: 'cli'
    });
    assert.ok(calls[0]?.args.includes('--trust'));
  });

  it('explains ENOENT with the cursor-agent install path', async () => {
    const execFile: ExecFileFn = async () => {
      const err = new Error('spawn cursor-agent ENOENT') as NodeJS.ErrnoException;
      err.code = 'ENOENT';
      throw err;
    };
    await assert.rejects(
      createCliJudgeCompletion({ cli: 'cursor-agent', execFile })({
        model: 'scripted',
        prompt: 'x',
        apiKey: 'cli'
      }),
      /cursor-agent[\s\S]*cursor\.com\/install[\s\S]*~\/\.local\/bin\/cursor-agent/
    );
  });
});

describe('runLlmJudge backends', () => {
  it('uses injected complete instead of the heuristic', async () => {
    const verdict = await runLlmJudge({
      prompt: 'Summarize',
      toolOutput: { component: 'payment-api' },
      agentResponse: 'payment-api talks to the legacy-monolith',
      model: 'scripted',
      complete: async () => ({ score: 'PASS', reasoning: 'trusted-complete' })
    });
    assert.equal(verdict.score, 'PASS');
    assert.equal(verdict.reasoning, 'trusted-complete');
    assert.equal(verdict.hallucinated, false);
  });

  it('keeps heuristic for scripted without complete', async () => {
    const verdict = await runLlmJudge({
      prompt: 'Summarize',
      toolOutput: { component: 'payment-api' },
      agentResponse: 'payment-api talks to the legacy-monolith',
      model: 'scripted'
    });
    assert.equal(verdict.score, 'FAIL');
    assert.equal(verdict.hallucinated, true);
  });

  it('uses CLI backend when requested', async () => {
    const complete = createCliJudgeCompletion({
      cli: 'claude',
      execFile: async () => ({
        stdout: JSON.stringify({
          results: [{ pass: true, reason: 'ok' }],
          score: 1
        }),
        stderr: ''
      })
    });
    const verdict = await runCriteriaJudge({
      prompt: 'q',
      toolOutput: {},
      agentResponse: 'a',
      criteria: ['Be accurate'],
      model: 'scripted',
      backend: 'cli',
      complete
    });
    assert.equal(verdict.passed, true);
    assert.equal(verdict.score, 1);
  });

  it('does not call a live judge for no_tool task completion', async () => {
    const verdict = await runTaskCompletionJudge({
      prompt: 'What is TDD?',
      noTool: true,
      toolCalls: [],
      toolOutput: null,
      agentResponse: 'C4 stands for context, containers, components, code.',
      model: 'cursor-grok-4.6-medium',
      backend: 'cli',
      complete: async () => {
        throw new Error('live judge must not run for no_tool');
      }
    });
    assert.equal(verdict.score, 'PASS');
  });
});
