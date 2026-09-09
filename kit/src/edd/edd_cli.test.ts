import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  defaultEddSuite,
  eddWatchTargets,
  getEddFlag,
  getEddNumberFlag,
  handleEddEvalCli,
  hasEddFlag,
  resolveEddSuite,
  shouldPublishGithubSummary
} from './edd_cli.js';

function writeMiniSuite(dir: string): string {
  fs.mkdirSync(dir, { recursive: true });
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
    `name: "Mini"
dataset: "cases.jsonl"
metrics:
  - type: "tool_selection"
  - type: "schema_match"
    strict: true
`
  );
  return suite;
}

describe('EDD CLI flag helpers', () => {
  it('reads flags and number flags', () => {
    assert.equal(getEddFlag(['--suite', 'a.yaml'], '--suite'), 'a.yaml');
    assert.equal(getEddFlag(['--suite'], '--missing'), undefined);
    assert.equal(getEddNumberFlag(['--threshold-routing', '80'], '--threshold-routing', 95), 80);
    assert.equal(getEddNumberFlag([], '--threshold-routing', 95), 95);
    assert.throws(() => getEddNumberFlag(['--threshold-routing', 'nope'], '--threshold-routing', 95), /Invalid number/);
    assert.equal(hasEddFlag(['--github-summary'], '--github-summary'), true);
    assert.equal(hasEddFlag([], '--github-summary'), false);
  });

  it('decides when to publish a GitHub job summary', () => {
    assert.equal(shouldPublishGithubSummary(['--github-summary'], {}), true);
    assert.equal(shouldPublishGithubSummary(['--no-github-summary'], { GITHUB_ACTIONS: 'true' }), false);
    assert.equal(
      shouldPublishGithubSummary([], { GITHUB_ACTIONS: 'true', GITHUB_STEP_SUMMARY: '/tmp/summary.md' }),
      true
    );
    assert.equal(
      shouldPublishGithubSummary(
        [],
        { GITHUB_ACTIONS: 'true', GITHUB_STEP_SUMMARY: '/tmp/summary.md', NODE_TEST_CONTEXT: 'child-v8' }
      ),
      false
    );
    assert.equal(
      shouldPublishGithubSummary(
        ['--github-summary'],
        { GITHUB_STEP_SUMMARY: '/tmp/summary.md', NODE_TEST_CONTEXT: 'child-v8' }
      ),
      true
    );
    assert.equal(shouldPublishGithubSummary([], {}), false);
  });

  it('resolves the default suite and watch targets', () => {
    const repo = '/tmp/kit';
    const defaultSuite = defaultEddSuite(repo);
    assert.equal(defaultSuite, path.join(repo, 'evals', 'edd', 'architecture_routing.yaml'));
    const targets = eddWatchTargets(repo, ['--target', 'kit/src/edd/edd_cli.ts']);
    assert.ok(targets.includes(path.resolve(process.cwd(), defaultSuite)));
    assert.ok(targets.includes('kit/src/edd/edd_cli.ts'));
    assert.ok(targets.includes(path.join(repo, 'evals', 'edd')));
  });

  it('resolves --suite relative to cwd', () => {
    assert.equal(resolveEddSuite('/kit', ['--suite', 'foo.yaml']), path.resolve(process.cwd(), 'foo.yaml'));
  });

  it('documents judge backends in help output', async () => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => {
      lines.push(args.map(String).join(' '));
    };
    try {
      assert.equal(await handleEddEvalCli({ repoDir: '/kit', args: ['help'] }), 0);
    } finally {
      console.log = original;
    }
    const text = lines.join('\n');
    assert.match(text, /--style <name>/);
    assert.match(text, /--cli <name>/);
    assert.match(text, /--cli-stdout/);
    assert.match(text, /--base-url/);
  });
});

describe('handleEddEvalCli', () => {
  it('returns null so bare wk eval can run the trigger harness', async () => {
    assert.equal(await handleEddEvalCli({ repoDir: '/kit', args: [] }), null);
    assert.equal(await handleEddEvalCli({ repoDir: '/kit', args: ['--model', 'scripted'] }), null);
    assert.equal(await handleEddEvalCli({ repoDir: '/kit', args: ['all'] }), null);
    assert.equal(await handleEddEvalCli({ repoDir: '/kit', args: ['suite.yaml'] }), null);
  });

  it('prints help and rejects unknown subcommands', async () => {
    assert.equal(await handleEddEvalCli({ repoDir: '/kit', args: ['help'] }), 0);
    assert.equal(await handleEddEvalCli({ repoDir: '/kit', args: ['nope'] }), 1);
  });

  it('rejects removed split agent/judge flags', async () => {
    await assert.rejects(
      handleEddEvalCli({
        repoDir: '/kit',
        args: ['run', '--suite', 'x.yaml', '--agent-cli', 'claude', '--model', 'scripted']
      }),
      /--agent-cli/
    );
    await assert.rejects(
      handleEddEvalCli({
        repoDir: '/kit',
        args: ['run', '--suite', 'x.yaml', '--judge-model', 'gpt-4o', '--model', 'scripted']
      }),
      /--judge-model/
    );
  });

  it('runs a scripted suite and writes reports', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-edd-cli-'));
    const suite = writeMiniSuite(dir);
    const out = path.join(dir, 'reports');
    const code = await handleEddEvalCli({
      repoDir: dir,
      args: ['run', '--suite', suite, '--model', 'scripted', '--out', out, '--format', 'md']
    });
    assert.equal(code, 0);
    assert.equal(fs.existsSync(path.join(out, 'eval-report.md')), true);
    assert.equal(fs.existsSync(path.join(out, 'edd-report.json')), true);
  });

  it('fails CI when routing accuracy is below the threshold', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-edd-cli-'));
    const suite = writeMiniSuite(dir);
    const code = await handleEddEvalCli({
      repoDir: dir,
      args: ['ci', '--suite', suite, '--model', 'scripted', '--threshold-routing', '100.1', '--out', path.join(dir, 'out')]
    });
    assert.equal(code, 1);
  });

  it('regenerates a report from an existing JSON file', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-edd-cli-'));
    const from = path.join(dir, 'edd-report.json');
    fs.writeFileSync(
      from,
      JSON.stringify({
        suite: 'Mini',
        suitePath: '/tmp/suite.yaml',
        model: 'scripted',
        startedAt: '2026-08-31T00:00:00.000Z',
        finishedAt: '2026-08-31T00:00:01.000Z',
        total: 1,
        passed: 1,
        failed: 0,
        routingAccuracy: 100,
        schemaAdherence: 100,
        hallucinationRate: 0,
        totalTokens: 10,
        avgLatencyMs: 1,
        results: []
      }),
      'utf8'
    );
    const out = path.join(dir, 'reports');
    const code = await handleEddEvalCli({
      repoDir: dir,
      args: ['report', '--from', from, '--format', 'md', '--out', out]
    });
    assert.equal(code, 0);
    assert.equal(fs.existsSync(path.join(out, 'eval-report.md')), true);
  });

  it('publishes a report to GITHUB_STEP_SUMMARY when requested', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-edd-cli-'));
    const from = path.join(dir, 'edd-report.json');
    const summary = path.join(dir, 'step-summary.md');
    fs.writeFileSync(
      from,
      JSON.stringify([
        {
          suite: 'Mini',
          suitePath: '/tmp/suite.yaml',
          model: 'scripted',
          startedAt: '2026-08-31T00:00:00.000Z',
          finishedAt: '2026-08-31T00:00:01.000Z',
          total: 1,
          passed: 1,
          failed: 0,
          routingAccuracy: 100,
          schemaAdherence: 100,
          hallucinationRate: 0,
          totalTokens: 10,
          avgLatencyMs: 1,
          results: []
        }
      ]),
      'utf8'
    );
    const prevSummary = process.env.GITHUB_STEP_SUMMARY;
    process.env.GITHUB_STEP_SUMMARY = summary;
    try {
      const code = await handleEddEvalCli({
        repoDir: dir,
        args: [
          'report',
          '--from',
          from,
          '--format',
          'md',
          '--out',
          path.join(dir, 'reports'),
          '--github-summary'
        ]
      });
      assert.equal(code, 0);
      const body = fs.readFileSync(summary, 'utf8');
      assert.match(body, /EDD overview/);
      assert.match(body, /Mini/);
    } finally {
      if (prevSummary === undefined) delete process.env.GITHUB_STEP_SUMMARY;
      else process.env.GITHUB_STEP_SUMMARY = prevSummary;
    }
  });
});
