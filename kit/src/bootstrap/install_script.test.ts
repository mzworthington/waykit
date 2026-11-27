import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const installer = path.join(root, 'install.sh');

function runInstaller(shell: string, args: string[]): SpawnSyncReturns<string> {
  return spawnSync(shell, [installer, ...args], { encoding: 'utf8' });
}

function runInstallWithPnpm(version: string): { result: SpawnSyncReturns<string>; log: string } {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'waykit-install-'));
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'waykit-pnpm-'));
  const logPath = path.join(home, 'pnpm-invocations.log');
  const stub = `#!/bin/sh
if [ "$1" = "--version" ] || [ "$1" = "-v" ]; then
  pwd >> '${logPath}'
  printf '%s\\n' '${version}'
  exit 0
fi
printf '%s\\n' "$*" >> '${logPath}'
exit 42
`;
  fs.writeFileSync(path.join(bin, 'pnpm'), stub, { mode: 0o755 });
  const result = spawnSync('sh', [installer], {
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: home,
      PATH: `${bin}:${process.env.PATH ?? ''}`,
    },
  });
  const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(bin, { recursive: true, force: true });
  return { result, log };
}

function pathWithout(command: string): string {
  return (process.env.PATH ?? '')
    .split(':')
    .filter((dir) => dir.length > 0 && !fs.existsSync(path.join(dir, command)))
    .join(':');
}

function runInstallWithoutPnpm(): { result: SpawnSyncReturns<string>; log: string } {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'waykit-install-'));
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'waykit-corepack-'));
  const logPath = path.join(home, 'corepack-invocations.log');
  fs.symlinkSync(process.execPath, path.join(bin, 'node'));
  const stub = `#!/bin/sh
printf '%s\\n' "$*" >> '${logPath}'
exit 0
`;
  fs.writeFileSync(path.join(bin, 'corepack'), stub, { mode: 0o755 });
  const result = spawnSync('/bin/sh', [installer], {
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: home,
      PATH: `${bin}:${pathWithout('pnpm')}`,
    },
  });
  const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8') : '';
  fs.rmSync(home, { recursive: true, force: true });
  fs.rmSync(bin, { recursive: true, force: true });
  return { result, log };
}

describe('install.sh', () => {
  it('documents curl | sh install', () => {
    const result = runInstaller('sh', ['--help']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.stdout,
      /curl -fsSL https:\/\/raw\.githubusercontent\.com\/mzworthington\/waykit\/main\/install\.sh \| sh/
    );
    assert.match(result.stdout, /wk init \. --mcp default --hook/);
  });

  it('rejects unknown options and missing --dir values', () => {
    const unknown = runInstaller('sh', ['--bogus']);
    assert.equal(unknown.status, 1);
    assert.match(unknown.stderr, /Unknown option/);
    const missingDir = runInstaller('sh', ['--dir']);
    assert.equal(missingDir.status, 1);
    assert.match(missingDir.stderr, /--dir requires a path/);
  });

  it('runs under bash as well as sh', () => {
    const result = runInstaller('bash', ['--help']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /\| sh/);
  });

  it('names the pinned pnpm 11.25.0 in the packageManager field', () => {
    const mise = fs.readFileSync(path.join(root, 'mise.toml'), 'utf8');
    const pin = /^pnpm = "([^"]+)"$/m.exec(mise)?.[1];
    assert.equal(pin, '11.25.0');
    const pkg = fs.readFileSync(path.join(root, 'package.json'), 'utf8');
    const field = /"packageManager"\s*:\s*"([^"]+)"/.exec(pkg)?.[1];
    assert.equal(field, `pnpm@${pin}`);
    const workflows = path.join(root, '.github/workflows');
    for (const name of fs.readdirSync(workflows)) {
      if (!name.endsWith('.yml')) continue;
      const body = fs.readFileSync(path.join(workflows, name), 'utf8');
      const lines = body.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i]?.includes('pnpm/action-setup@')) continue;
        for (let j = i + 1; j < lines.length; j++) {
          const line = lines[j] ?? '';
          if (/^\s*-\s+(name|uses):/.test(line)) break;
          const version = /^\s+version:\s*['"]?([^'"]+?)['"]?\s*$/.exec(line)?.[1];
          if (version !== undefined) {
            assert.equal(version, pin, `${name} must install pnpm ${pin}`);
          }
        }
      }
    }
  });

  it('exits before pnpm install when pnpm is older than 11.25.0 and names that version', () => {
    for (const version of ['10.33.4', '11.9.0', '11.24.9']) {
      const { result, log } = runInstallWithPnpm(version);
      assert.notEqual(result.status, 0, version);
      assert.match(`${result.stderr}\n${result.stdout}`, /11\.25\.0/, version);
      assert.equal(log.trim(), '/', `${version}: ${log}`);
    }
  });

  it('proceeds into pnpm install when pnpm is 11.25.0', () => {
    for (const version of ['11.25.0', '11.26.0']) {
      const { result, log } = runInstallWithPnpm(version);
      assert.equal(result.status, 42, `${version}\n${result.stdout}\n${result.stderr}`);
      assert.match(log, /^\/$/m, version);
      assert.match(log, /^install$/m, version);
      assert.doesNotMatch(`${result.stderr}`, /or newer is required/, version);
    }
  });

  it('asks corepack for pnpm 11.25.0 when pnpm is not installed', () => {
    const { result, log } = runInstallWithoutPnpm();
    assert.doesNotMatch(`${result.stderr}`, /dirname:/);
    assert.match(log, /prepare pnpm@11\.25\.0 --activate/);
    assert.doesNotMatch(log, /pnpm@latest/);
  });
});
