import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildCliAgentPrompt,
  createCliAgentDriver,
  parseAgentCliStdout,
  resolveCliAgentDriver
} from './cli-agent.js';
import type { ExecFileFn } from './judge-provider.js';

describe('parseAgentCliStdout', () => {
  it('reads a raw tool-call object', () => {
    const parsed = parseAgentCliStdout(
      JSON.stringify({
        content: 'Looking up payment-api.',
        tool_calls: [{ name: 'read_architecture_yaml', arguments: { componentId: 'payment-api' } }]
      }),
      ['read_architecture_yaml']
    );
    assert.equal(parsed.content, 'Looking up payment-api.');
    assert.equal(parsed.tool_calls[0]?.name, 'read_architecture_yaml');
    assert.deepEqual(parsed.tool_calls[0]?.arguments, { componentId: 'payment-api' });
  });

  it('unwraps a Cursor result envelope and drops unknown tools', () => {
    const parsed = parseAgentCliStdout(
      JSON.stringify({
        type: 'result',
        result: JSON.stringify({
          content: 'ok',
          tool_calls: [
            { name: 'read_architecture_yaml', arguments: { componentId: 'payment-api' } },
            { name: 'Shell', arguments: { command: 'rm -rf /' } }
          ]
        })
      }),
      ['read_architecture_yaml']
    );
    assert.equal(parsed.tool_calls.length, 1);
    assert.equal(parsed.tool_calls[0]?.name, 'read_architecture_yaml');
  });

  it('reads Cursor / Claude usage from the outer envelope', () => {
    const parsed = parseAgentCliStdout(
      JSON.stringify({
        type: 'result',
        result: JSON.stringify({ content: 'ok', tool_calls: [] }),
        usage: { inputTokens: 1200, outputTokens: 80, cacheReadTokens: 400 }
      })
    );
    assert.equal(parsed.usage.promptTokens, 1200);
    assert.equal(parsed.usage.completionTokens, 80);
    assert.equal(parsed.usage.totalTokens, 1280);
  });
});

describe('createCliAgentDriver', () => {
  it('prompts with the allow-list and parses JSON tool calls', async () => {
    const calls: Array<{ file: string; args: string[] }> = [];
    const execFile: ExecFileFn = async (file, args) => {
      calls.push({ file, args });
      return {
        stdout: JSON.stringify({
          content: 'Fetching architecture.',
          tool_calls: [{ name: 'read_architecture_yaml', arguments: { componentId: 'payment-api' } }]
        }),
        stderr: ''
      };
    };
    const driver = createCliAgentDriver({
      cli: 'cursor-agent',
      execFile,
      exists: () => false
    });
    const result = await driver({
      model: 'cursor-grok-4.6-medium',
      systemPrompt: 'Prefer architecture tools.',
      messages: [{ role: 'user', content: 'Show the payment C4 model' }],
      tools: [
        {
          name: 'read_architecture_yaml',
          description: 'Load a C4 component',
          inputSchema: { type: 'object', properties: { componentId: { type: 'string' } } }
        }
      ],
      mocks: new Map()
    });
    assert.equal(calls[0]?.file, 'cursor-agent');
    assert.ok(calls[0]?.args.includes('--mode=ask'));
    assert.ok(calls[0]?.args.includes('cursor-grok-4.6-medium'));
    const prompt = calls[0]?.args[1] ?? '';
    assert.match(prompt, /read_architecture_yaml/);
    assert.match(prompt, /Do not use filesystem/);
    assert.equal(result.tool_calls[0]?.name, 'read_architecture_yaml');
    assert.equal(calls.length, 1);
    assert.match(buildCliAgentPrompt({
      systemPrompt: 's',
      messages: [{ role: 'user', content: 'q' }],
      tools: [{ name: 'read_architecture_yaml' }]
    }), /allow-list/i);
    assert.match(prompt, /one lookup each/i);
    assert.match(prompt, /payment-api/);
    assert.match(prompt, /never use tools/i);
    assert.match(prompt, /overrides System/i);
  });

  it('grounds final content from mock JSON in one spawn', async () => {
    const stdoutByTurn = [
      JSON.stringify({
        content: '',
        tool_calls: [{ name: 'read_architecture_yaml', arguments: { componentId: 'payment-api' } }]
      })
    ];
    const prompts: string[] = [];
    const execFile: ExecFileFn = async (_file, args) => {
      prompts.push(args[1] ?? '');
      return { stdout: stdoutByTurn.shift() ?? '{}', stderr: '' };
    };
    const mocks = new Map([
      [
        'read_architecture_yaml',
        [{ tool: 'read_architecture_yaml', response: { component: 'payment-api', containers: ['payment-db'] } }]
      ]
    ]);
    const driver = createCliAgentDriver({ cli: 'cursor-agent', execFile, exists: () => false });
    const result = await driver({
      model: 'cursor-grok-4.6-medium',
      systemPrompt: 'Prefer architecture tools.',
      messages: [{ role: 'user', content: 'Show the payment C4 model' }],
      tools: [{ name: 'read_architecture_yaml' }],
      mocks
    });
    assert.equal(prompts.length, 1);
    assert.match(prompts[0] ?? '', /EVAL USER PROMPT/);
    assert.equal(result.tool_calls.length, 1);
    assert.match(result.content, /payment-db/);
  });

  it('keeps only the first tool call unless the user asks for one lookup each', async () => {
    const execFile: ExecFileFn = async () => ({
      stdout: JSON.stringify({
        content: '',
        tool_calls: [
          { name: 'read_architecture_yaml', arguments: { componentId: 'auth-service' } },
          { name: 'read_architecture_yaml', arguments: { componentId: 'payment-api' } }
        ]
      }),
      stderr: ''
    });
    const driver = createCliAgentDriver({ cli: 'cursor-agent', execFile, exists: () => false });
    const once = await driver({
      model: 'cursor-grok-4.6-medium',
      systemPrompt: 's',
      messages: [{ role: 'user', content: 'Check the architecture for the auth service and the payment api.' }],
      tools: [{ name: 'read_architecture_yaml' }],
      mocks: new Map()
    });
    assert.equal(once.tool_calls.length, 1);
    assert.deepEqual(once.tool_calls[0]?.arguments, { componentId: 'auth-service' });
    const both = await driver({
      model: 'cursor-grok-4.6-medium',
      systemPrompt: 's',
      messages: [
        {
          role: 'user',
          content: 'Look up architecture for the auth service, then the payment API - one lookup each.'
        }
      ],
      tools: [{ name: 'read_architecture_yaml' }],
      mocks: new Map()
    });
    assert.equal(both.tool_calls.length, 2);
  });

  it('counts CLI usage from the tool-selection turn', async () => {
    const stdoutByTurn = [
      JSON.stringify({
        result: JSON.stringify({
          content: '',
          tool_calls: [{ name: 'read_architecture_yaml', arguments: { componentId: 'payment-api' } }]
        }),
        usage: { input_tokens: 100, output_tokens: 20 }
      })
    ];
    const execFile: ExecFileFn = async () => ({ stdout: stdoutByTurn.shift() ?? '{}', stderr: '' });
    const driver = createCliAgentDriver({ cli: 'cursor-agent', execFile, exists: () => false });
    const result = await driver({
      model: 'cursor-grok-4.6-medium',
      systemPrompt: 's',
      messages: [{ role: 'user', content: 'lookup' }],
      tools: [{ name: 'read_architecture_yaml' }],
      mocks: new Map([
        ['read_architecture_yaml', [{ tool: 'read_architecture_yaml', response: { component: 'payment-api' } }]]
      ])
    });
    assert.equal(result.usage.promptTokens, 100);
    assert.equal(result.usage.completionTokens, 20);
    assert.equal(result.usage.totalTokens, 120);
  });

  it('retries once when the agent CLI is killed at the timeout (exit 143)', async () => {
    let attempts = 0;
    const execFile: ExecFileFn = async () => {
      attempts += 1;
      if (attempts === 1) {
        const err = new Error('CLI exited 143') as NodeJS.ErrnoException;
        err.code = 'ETIMEDOUT';
        throw err;
      }
      return {
        stdout: JSON.stringify({
          content: 'Fetching architecture.',
          tool_calls: [{ name: 'read_architecture_yaml', arguments: { componentId: 'auth-service' } }]
        }),
        stderr: ''
      };
    };
    const driver = createCliAgentDriver({ cli: 'cursor-agent', execFile, exists: () => false });
    const result = await driver({
      model: 'cursor-grok-4.6-medium',
      systemPrompt: 's',
      messages: [
        {
          role: 'user',
          content: 'Look up architecture for the auth service, then the payment API - one lookup each.'
        }
      ],
      tools: [{ name: 'read_architecture_yaml' }],
      mocks: new Map()
    });
    assert.equal(attempts, 2);
    assert.equal(result.tool_calls[0]?.name, 'read_architecture_yaml');
  });

  it('refuses local model ids for the CLI style', () => {
    assert.throws(
      () => resolveCliAgentDriver({ style: 'cli', model: 'scripted', cli: 'claude' }),
      /cursor-grok-4.6-medium/
    );
    assert.equal(resolveCliAgentDriver({ model: 'cursor-grok-4.6-medium' }), undefined);
  });
});
