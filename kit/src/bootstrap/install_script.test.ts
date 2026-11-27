import assert from 'node:assert/strict';
import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const installer = path.join(root, 'install.sh');

function runInstaller(shell: string, args: string[]): SpawnSyncReturns<string> {
  return spawnSync(shell, [installer, ...args], { encoding: 'utf8' });
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

  it('pins packageManager to the mise pnpm version', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      packageManager?: string;
    };
    const mise = readFileSync(path.join(root, 'mise.toml'), 'utf8');
    const pin = /^pnpm = "([^"]+)"/m.exec(mise)?.[1];
    assert.ok(pin, 'mise.toml must pin pnpm');
    assert.equal(pkg.packageManager, `pnpm@${pin}`);
  });

  it('refuses a pnpm older than the pin before pnpm install', () => {
    const home = mkdtempSync(path.join(tmpdir(), 'waykit-install-'));
    const bin = mkdtempSync(path.join(tmpdir(), 'waykit-pnpm-'));
    const log = path.join(bin, 'pnpm.log');
    const stub = path.join(bin, 'pnpm');
    writeFileSync(
      stub,
      `#!/bin/sh\nprintf '%s\\n' "$*" >> '${log}'\nif [ "$1" = "--version" ]; then printf '%s\\n' '9.15.0'; exit 0; fi\nexit 1\n`
    );
    chmodSync(stub, 0o755);
    const result = spawnSync('sh', [installer], {
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: home,
        PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
      },
    });
    const calls = existsSync(log) ? readFileSync(log, 'utf8') : '';
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /11\.25\.0/);
    assert.doesNotMatch(calls, /install/);
  });

  it('runs pnpm install when pnpm matches the pin', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      packageManager: string;
    };
    const pin = pkg.packageManager.replace(/^pnpm@/, '');
    const home = mkdtempSync(path.join(tmpdir(), 'waykit-install-'));
    const bin = mkdtempSync(path.join(tmpdir(), 'waykit-pnpm-'));
    const log = path.join(bin, 'pnpm.log');
    const stub = path.join(bin, 'pnpm');
    writeFileSync(
      stub,
      `#!/bin/sh\nprintf '%s\\n' "$*" >> '${log}'\nif [ "$1" = "--version" ]; then printf '%s\\n' '${pin}'; exit 0; fi\nexit 1\n`
    );
    chmodSync(stub, 0o755);
    const result = spawnSync('sh', [installer], {
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: home,
        PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
      },
    });
    const calls = existsSync(log) ? readFileSync(log, 'utf8') : '';
    assert.match(calls, /^install$/m);
    assert.doesNotMatch(result.stderr, /is required/);
  });

  it('leaves a different agents directory in place and prints both paths', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      packageManager: string;
    };
    const pin = pkg.packageManager.replace(/^pnpm@/, '');
    const home = mkdtempSync(path.join(tmpdir(), 'waykit-install-'));
    const agents = path.join(home, '.agents');
    mkdirSync(agents);
    const bin = mkdtempSync(path.join(tmpdir(), 'waykit-pnpm-'));
    const stub = path.join(bin, 'pnpm');
    writeFileSync(
      stub,
      `#!/bin/sh\nif [ "$1" = "--version" ]; then printf '%s\\n' '${pin}'; exit 0; fi\nexit 0\n`
    );
    chmodSync(stub, 0o755);
    const result = spawnSync('sh', [installer], {
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: home,
        INSTALL_MCP: '0',
        PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
      },
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.ok(result.stdout.includes(agents), result.stdout);
    assert.ok(result.stdout.includes(root), result.stdout);
    assert.equal(lstatSync(agents).isSymbolicLink(), false);
    assert.equal(existsSync(agents), true);
  });

  it('succeeds when install runs from the agents directory itself', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      packageManager: string;
    };
    const pin = pkg.packageManager.replace(/^pnpm@/, '');
    const home = mkdtempSync(path.join(tmpdir(), 'waykit-install-'));
    const agents = path.join(home, '.agents');
    mkdirSync(path.join(agents, 'bin'), { recursive: true });
    mkdirSync(path.join(agents, 'system'));
    copyFileSync(installer, path.join(agents, 'install.sh'));
    writeFileSync(path.join(agents, 'package.json'), JSON.stringify({ packageManager: `pnpm@${pin}` }));
    writeFileSync(path.join(agents, 'AGENTS.md'), '# kit\n');
    writeFileSync(path.join(agents, 'bin', 'kit.ts'), '');
    writeFileSync(path.join(agents, 'bin', 'kit'), '#!/bin/sh\nexit 0\n');
    writeFileSync(path.join(agents, 'system', 'config.json'), '{}\n');
    chmodSync(path.join(agents, 'bin', 'kit'), 0o755);
    const bin = mkdtempSync(path.join(tmpdir(), 'waykit-pnpm-'));
    const stub = path.join(bin, 'pnpm');
    writeFileSync(
      stub,
      `#!/bin/sh\nif [ "$1" = "--version" ]; then printf '%s\\n' '${pin}'; exit 0; fi\nexit 0\n`
    );
    chmodSync(stub, 0o755);
    const result = spawnSync('sh', [path.join(agents, 'install.sh')], {
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: home,
        INSTALL_MCP: '0',
        PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
      },
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /this checkout/);
    assert.equal(lstatSync(agents).isSymbolicLink(), false);
  });

  it('leaves a symlink to somewhere else in place and prints both paths', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      packageManager: string;
    };
    const pin = pkg.packageManager.replace(/^pnpm@/, '');
    const home = mkdtempSync(path.join(tmpdir(), 'waykit-install-'));
    const elsewhere = mkdtempSync(path.join(tmpdir(), 'waykit-elsewhere-'));
    const agents = path.join(home, '.agents');
    symlinkSync(elsewhere, agents);
    const bin = mkdtempSync(path.join(tmpdir(), 'waykit-pnpm-'));
    const stub = path.join(bin, 'pnpm');
    writeFileSync(
      stub,
      `#!/bin/sh\nif [ "$1" = "--version" ]; then printf '%s\\n' '${pin}'; exit 0; fi\nexit 0\n`
    );
    chmodSync(stub, 0o755);
    const result = spawnSync('sh', [installer], {
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: home,
        INSTALL_MCP: '0',
        PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
      },
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.ok(result.stdout.includes(elsewhere), result.stdout);
    assert.ok(result.stdout.includes(root), result.stdout);
    assert.equal(lstatSync(agents).isSymbolicLink(), true);
    assert.equal(readlinkSync(agents), elsewhere);
  });

  it('moves an existing agents path aside when --force-link is set', () => {
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as {
      packageManager: string;
    };
    const pin = pkg.packageManager.replace(/^pnpm@/, '');
    const home = mkdtempSync(path.join(tmpdir(), 'waykit-install-'));
    const agents = path.join(home, '.agents');
    mkdirSync(agents);
    writeFileSync(path.join(agents, 'keep.txt'), 'kept');
    const bin = mkdtempSync(path.join(tmpdir(), 'waykit-pnpm-'));
    const stub = path.join(bin, 'pnpm');
    writeFileSync(
      stub,
      `#!/bin/sh\nif [ "$1" = "--version" ]; then printf '%s\\n' '${pin}'; exit 0; fi\nexit 0\n`
    );
    chmodSync(stub, 0o755);
    const result = spawnSync('sh', [installer, '--force-link'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: home,
        INSTALL_MCP: '0',
        PATH: `${bin}${path.delimiter}${process.env.PATH ?? ''}`,
      },
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.equal(lstatSync(agents).isSymbolicLink(), true);
    assert.equal(readlinkSync(agents), root);
    const aside = readdirSync(home).find((name) => name !== '.agents' && name.startsWith('.agents'));
    assert.ok(aside, readdirSync(home).join(','));
    assert.equal(readFileSync(path.join(home, aside, 'keep.txt'), 'utf8'), 'kept');
  });
});
