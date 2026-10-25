import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { parse as parseYaml } from 'yaml';
import { stackEntryExportsPlan } from '../../../infra/cursor-automations/index.js';
import { ensureCursorSdk, preResolution } from '../../../infra/cursor-automations/ensure-cursor-sdk.cjs';

const require = createRequire(import.meta.url);

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

  it('does not commit the generated cursor SDK', () => {
    const root = path.resolve(projectDir, '../..');
    const listed = spawnSync('git', ['ls-files', '--', 'infra/cursor-automations/sdks/cursor'], {
      cwd: root,
      encoding: 'utf8'
    });
    assert.equal(listed.status, 0, listed.stderr);
    assert.equal(listed.stdout.trim(), '');
  });

  it('regenerates a missing cursor SDK from Pulumi.yaml during pnpm install', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-sdk-'));
    const project = path.join(tmp, 'infra', 'cursor-automations');
    fs.mkdirSync(project, { recursive: true });
    fs.copyFileSync(path.join(projectDir, 'Pulumi.yaml'), path.join(project, 'Pulumi.yaml'));
    const log = path.join(tmp, 'args.txt');
    const fake = path.join(tmp, 'pulumi');
    fs.writeFileSync(
      fake,
      `#!/usr/bin/env node
const fs = require('node:fs');
fs.writeFileSync(${JSON.stringify(log)}, process.argv.slice(2).join('\\n'));
fs.mkdirSync('sdks/cursor', { recursive: true });
fs.writeFileSync('sdks/cursor/package.json', '{"name":"@pulumi/cursor"}\\n');
`
    );
    fs.chmodSync(fake, 0o755);

    const first = ensureCursorSdk({ root: tmp, pulumiBin: fake });
    assert.equal(first.generated, true);
    assert.equal(fs.readFileSync(path.join(project, 'sdks/cursor/package.json'), 'utf8').includes('@pulumi/cursor'), true);
    assert.equal(fs.readFileSync(log, 'utf8'), 'install\n--no-dependencies\n--non-interactive');

    fs.writeFileSync(log, '');
    const second = ensureCursorSdk({ root: tmp, pulumiBin: fake });
    assert.equal(second.generated, false);
    assert.equal(fs.readFileSync(log, 'utf8'), '');

    const root = path.resolve(projectDir, '../..');
    const rootHooks = require(path.join(root, '.pnpmfile.cjs')) as { hooks: { preResolution: unknown } };
    const projectHooks = require(path.join(projectDir, '.pnpmfile.cjs')) as { hooks: { preResolution: unknown } };
    assert.equal(rootHooks.hooks.preResolution, preResolution);
    assert.equal(projectHooks.hooks.preResolution, preResolution);
  });

  it('installs a pinned Pulumi CLI when pnpm install cannot find one', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cursor-sdk-'));
    const project = path.join(tmp, 'infra', 'cursor-automations');
    fs.mkdirSync(project, { recursive: true });
    fs.copyFileSync(path.join(projectDir, 'Pulumi.yaml'), path.join(project, 'Pulumi.yaml'));
    const log = path.join(tmp, 'args.txt');
    const fake = path.join(tmp, 'pulumi-bin');
    fs.writeFileSync(
      fake,
      `#!/usr/bin/env node
const fs = require('node:fs');
fs.writeFileSync(${JSON.stringify(log)}, process.argv.slice(2).join('\\n'));
fs.mkdirSync('sdks/cursor', { recursive: true });
fs.writeFileSync('sdks/cursor/package.json', '{"name":"@pulumi/cursor"}\\n');
`
    );
    fs.chmodSync(fake, 0o755);
    let installed = 0;
    const result = ensureCursorSdk({
      root: tmp,
      env: { ...process.env, PATH: path.dirname(process.execPath) },
      installPulumi: () => {
        installed += 1;
        return fake;
      }
    });
    assert.equal(installed, 1);
    assert.equal(result.generated, true);
    assert.equal(fs.readFileSync(log, 'utf8'), 'install\n--no-dependencies\n--non-interactive');
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
