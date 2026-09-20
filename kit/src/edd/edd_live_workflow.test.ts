import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const workflowPath = path.join(kitRoot, '.github/workflows/edd-live.yml');
const eddDocsPath = path.join(kitRoot, 'docs/edd.md');
const eddSopPath = path.join(kitRoot, 'SOPs/eval-driven-development.md');

type WorkflowStep = {
  id?: string;
  name?: string;
  run?: string;
  env?: Record<string, string>;
  if?: string;
};

type LiveWorkflow = {
  on?: {
    schedule?: Array<{ cron?: string }>;
    workflow_dispatch?: {
      inputs?: {
        allow_unkeyed_skip?: {
          type?: string;
          default?: boolean | string;
        };
      };
    };
  };
  jobs?: {
    live?: {
      steps?: WorkflowStep[];
    };
  };
};

function loadWorkflow(): { yml: string; doc: LiveWorkflow } {
  const yml = fs.readFileSync(workflowPath, 'utf8');
  return { yml, doc: parseYaml(yml) as LiveWorkflow };
}

function credsStep(): WorkflowStep {
  const step = loadWorkflow().doc.jobs?.live?.steps?.find((item) => item.id === 'creds');
  assert.ok(step?.run, 'creds step must have a run script');
  return step;
}

function runCreds(env: Record<string, string>): {
  status: number | null;
  output: string;
  summary: string;
} {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'edd-live-creds-'));
  const output = path.join(dir, 'github-output');
  const summary = path.join(dir, 'github-summary');
  fs.writeFileSync(output, '');
  fs.writeFileSync(summary, '');
  const result = spawnSync('bash', ['-c', credsStep().run ?? ''], {
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH ?? '/usr/bin:/bin',
      GITHUB_OUTPUT: output,
      GITHUB_STEP_SUMMARY: summary,
      ...env,
    },
  });
  return {
    status: result.status,
    output: fs.readFileSync(output, 'utf8'),
    summary: fs.readFileSync(summary, 'utf8'),
  };
}

describe('nightly live-model EDD workflow', () => {
  it('runs cursor-agent with CURSOR_API_KEY from GitHub secrets', () => {
    const yml = fs.readFileSync(workflowPath, 'utf8');
    assert.match(yml, /secrets\.CURSOR_API_KEY/);
    assert.match(yml, /--style cli/);
    assert.match(yml, /--cli cursor-agent/);
  });

  it('installs a checksum-pinned linux cursor-agent tarball instead of cursor.com/install', () => {
    const step = loadWorkflow().doc.jobs?.live?.steps?.find(
      (item) => item.name === 'Install Cursor CLI'
    );
    const run = step?.run ?? '';
    assert.match(step?.env?.CURSOR_AGENT_VERSION ?? '', /^\d{4}\.\d{2}\.\d{2}-[0-9a-f]+$/);
    assert.match(step?.env?.CURSOR_AGENT_SHA256 ?? '', /^[a-f0-9]{64}$/);
    assert.match(
      run,
      /downloads\.cursor\.com\/lab\/\$\{CURSOR_AGENT_VERSION\}\/linux\/x64\/agent-cli-package\.tar\.gz/
    );
    assert.match(run, /sha256sum -c/);
    assert.match(run, /cursor-agent/);
    assert.doesNotMatch(run, /cursor\.com\/install/);
  });

  it('schedules live cursor-agent evals once a week', () => {
    const yml = fs.readFileSync(workflowPath, 'utf8');
    assert.match(yml, /cron:\s*'0 3 \* \* [0-6]'/);
    assert.doesNotMatch(yml, /cron:\s*'0 3 \* \* \*'/);
  });

  it('runs remaining live suites when one eval ci fails and still publishes github summary', () => {
    const yml = fs.readFileSync(workflowPath, 'utf8');
    assert.match(yml, /for suite in/);
    assert.match(yml, /failed=1/);
    assert.match(yml, /--github-summary/);
    assert.match(yml, /if: always\(\) && steps\.creds\.outputs\.skip != 'true'/);
  });

  it('exposes a workflow_dispatch skip flag that defaults off', () => {
    const input = loadWorkflow().doc.on?.workflow_dispatch?.inputs?.allow_unkeyed_skip;
    assert.equal(input?.type, 'boolean');
    assert.equal(String(input?.default), 'false');
    assert.match(credsStep().env?.ALLOW_UNKEYED_SKIP ?? '', /allow_unkeyed_skip/);
  });

  it('fails the scheduled job when CURSOR_API_KEY is missing instead of skipping green', () => {
    const result = runCreds({
      CURSOR_API_KEY: '',
      ALLOW_UNKEYED_SKIP: 'false',
      KIT_EVAL_MODEL: '',
    });
    assert.equal(result.status, 1);
    assert.match(result.output, /skip=true/);
    assert.match(result.summary, /Failed: `CURSOR_API_KEY` is not configured/);
    assert.doesNotMatch(result.summary, /^Skipped:/m);
  });

  it('allows workflow_dispatch skip when the secret is missing and says so in the summary', () => {
    const result = runCreds({
      CURSOR_API_KEY: '',
      ALLOW_UNKEYED_SKIP: 'true',
      KIT_EVAL_MODEL: '',
    });
    assert.equal(result.status, 0);
    assert.match(result.output, /skip=true/);
    assert.match(result.summary, /Skipped: `CURSOR_API_KEY` is not configured/);
    assert.match(result.summary, /allow_unkeyed_skip/);
    assert.match(result.summary, /wk check/);
  });

  it('runs live suites when CURSOR_API_KEY is present', () => {
    const result = runCreds({
      CURSOR_API_KEY: 'test-key',
      ALLOW_UNKEYED_SKIP: 'false',
      KIT_EVAL_MODEL: '',
    });
    assert.equal(result.status, 0);
    assert.match(result.output, /skip=false/);
    assert.match(result.output, /model=cursor-grok-4\.6-medium/);
    assert.equal(result.summary, '');
  });

  it('keeps scripted wk check as the PR merge gate and live as extra', () => {
    const docs = fs.readFileSync(eddDocsPath, 'utf8');
    const sop = fs.readFileSync(eddSopPath, 'utf8');
    assert.match(docs, /Verify.*`wk check`|`wk check`.*merge gate/s);
    assert.match(docs, /allow_unkeyed_skip/);
    assert.match(docs, /fails the scheduled job|scheduled job \*\*fails\*\*/i);
    assert.doesNotMatch(docs, /Weekly \*\*skips the whole job\*\*/);
    assert.match(sop, /`wk check`/);
    assert.match(sop, /fails|fail/);
    assert.doesNotMatch(sop, /Missing `CURSOR_API_KEY` skips the job/);
  });
});
