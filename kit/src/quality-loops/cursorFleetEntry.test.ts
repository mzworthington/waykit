import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { parse as parseYaml } from 'yaml';
import { stackEntryExportsPlan } from '../../../infra/cursor-automations/index.js';

const projectDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../infra/cursor-automations'
);

describe('cursor automation pulumi entry', () => {
  it('exports the fleet plan from the Pulumi entry module', () => {
    assert.equal(typeof stackEntryExportsPlan, 'function');
  });

  it('belongs to the kit workspace so root typecheck resolves Pulumi', () => {
    const root = path.resolve(projectDir, '../..');
    const workspace = parseYaml(fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8')) as {
      packages?: string[];
    };
    assert.ok(workspace.packages?.includes('infra/cursor-automations'));
    const lockfile = fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8');
    assert.match(lockfile, /^ {2}infra\/cursor-automations:/m);
  });

  it('loads under the Node args Pulumi is configured to pass', () => {
    const manifest = parseYaml(fs.readFileSync(path.join(projectDir, 'Pulumi.yaml'), 'utf8')) as {
      runtime?: { options?: { nodeargs?: string } };
    };
    const nodeargs = manifest.runtime?.options?.nodeargs ?? '';
    const args = nodeargs.split(' ').filter((arg) => arg !== '');
    const env = { ...process.env };
    delete env.PULUMI_NODEJS_STACK;
    const result = spawnSync(process.execPath, [...args, 'index.ts'], {
      cwd: projectDir,
      env,
      encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr);
  });
});
