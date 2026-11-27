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

function withFixture(run: (ctx: { root: string; home: string }) => void): void {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'waykit-install-'));
  const home = path.join(fixture, 'home');
  fs.mkdirSync(home);
  try {
    run({ root: fixture, home });
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

function linkAgents(shell: string, home: string, repo: string, args: string[] = []): SpawnSyncReturns<string> {
  const script = ['installer=$1', 'repo=$2', 'shift 2', '. "$installer"', 'link_agents "$repo"', 'echo CONTINUED'].join(
    '\n'
  );
  return spawnSync(shell, ['-c', script, 'sh', installer, repo, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home, WAYKIT_INSTALL_LIB: '1' }
  });
}

function assertContinued(result: SpawnSyncReturns<string>): void {
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /CONTINUED/);
}

function foreignAgentsSymlink(home: string, fixture: string): { agents: string; elsewhere: string; checkout: string } {
  const elsewhere = path.join(fixture, 'elsewhere');
  fs.mkdirSync(elsewhere);
  fs.writeFileSync(path.join(elsewhere, 'marker'), 'mine\n');
  const agents = path.join(home, '.agents');
  fs.symlinkSync(elsewhere, agents);
  const checkout = path.join(fixture, 'checkout');
  fs.mkdirSync(checkout);
  return { agents, elsewhere, checkout };
}

function writeExe(file: string, body: string): void {
  fs.writeFileSync(file, body);
  fs.chmodSync(file, 0o755);
}

function runDetachedInstall(
  home: string,
  fixture: string,
  args: string[],
  cloneInstaller: string = installer
): SpawnSyncReturns<string> {
  const bin = path.join(fixture, 'bin');
  fs.mkdirSync(bin);
  writeExe(
    path.join(bin, 'git'),
    `#!/bin/sh
if [ "$1" != "clone" ]; then
  echo "unexpected git: $*" >&2
  exit 1
fi
dest=
for arg in "$@"; do
  dest=$arg
done
mkdir -p "$dest/bin" "$dest/system"
cp ${JSON.stringify(cloneInstaller)} "$dest/install.sh"
: > "$dest/bin/kit.ts"
: > "$dest/package.json"
: > "$dest/AGENTS.md"
printf '%s\\n' '{}' > "$dest/system/config.example.json"
`
  );
  writeExe(path.join(bin, 'pnpm'), '#!/bin/sh\nexit 0\n');
  const scriptDir = path.join(fixture, 'installer');
  fs.mkdirSync(scriptDir);
  fs.copyFileSync(installer, path.join(scriptDir, 'install.sh'));
  return spawnSync('sh', [path.join(scriptDir, 'install.sh'), ...args], {
    encoding: 'utf8',
    env: {
      ...process.env,
      HOME: home,
      PATH: `${bin}:${process.env.PATH ?? ''}`,
      KIT_DIR: path.join(fixture, 'dest'),
      INSTALL_MCP: '0',
      INSTALL_EXTERNAL_SKILLS: '0'
    }
  });
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
    assert.match(result.stdout, /--force-link/);
    assert.match(result.stdout, /left in place/);
  });

  it('accepts --force-link and exits at help without bootstrapping', () => {
    const result = runInstaller('sh', ['--force-link', '--help']);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /--force-link/);
    assert.doesNotMatch(result.stdout, /Installing kit dependencies/);
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

  for (const shell of ['sh', 'bash']) {
    it(`(${shell}) succeeds when ~/.agents is this checkout and does not create another link`, () => {
      withFixture(({ home }) => {
        const agents = path.join(home, '.agents');
        fs.mkdirSync(agents);
        fs.writeFileSync(path.join(agents, 'marker'), 'kit\n');
        const result = linkAgents(shell, home, agents);
        assertContinued(result);
        assert.match(result.stdout, /this checkout/);
        assert.equal(fs.lstatSync(agents).isSymbolicLink(), false);
        assert.equal(fs.readFileSync(path.join(agents, 'marker'), 'utf8'), 'kit\n');
        assert.equal(fs.existsSync(path.join(agents, '.agents')), false);
      });
    });
  }

  it('succeeds when install runs from a ~/.agents symlink and does not replace that link', () => {
    withFixture(({ root: fixture, home }) => {
      const checkout = path.join(fixture, 'checkout');
      fs.mkdirSync(checkout);
      const agents = path.join(home, '.agents');
      const linkText = path.relative(home, checkout);
      fs.symlinkSync(linkText, agents);
      const result = linkAgents('sh', home, agents);
      assertContinued(result);
      assert.equal(fs.readlinkSync(agents), linkText);
      assert.equal(fs.existsSync(path.join(home, '.agents.bak')), false);
    });
  });

  it('treats a symlink to this checkout as already linked when the link text differs', () => {
    withFixture(({ root: fixture, home }) => {
      const checkout = path.join(fixture, 'checkout');
      fs.mkdirSync(checkout);
      const via = path.join(fixture, 'via');
      fs.symlinkSync(checkout, via);
      const linkText = path.relative(home, via);
      const agents = path.join(home, '.agents');
      fs.symlinkSync(linkText, agents);
      const result = linkAgents('sh', home, checkout);
      assertContinued(result);
      assert.equal(fs.readlinkSync(agents), linkText);
      assert.equal(fs.existsSync(path.join(home, '.agents.bak')), false);
    });
  });

  it('leaves a different agents directory in place, prints both paths, and continues', () => {
    withFixture(({ root: fixture, home }) => {
      const agents = path.join(home, '.agents');
      fs.mkdirSync(agents);
      fs.writeFileSync(path.join(agents, 'marker'), 'mine\n');
      const checkout = path.join(fixture, 'checkout');
      fs.mkdirSync(checkout);
      const result = linkAgents('sh', home, checkout);
      assertContinued(result);
      assert.equal(fs.lstatSync(agents).isSymbolicLink(), false);
      assert.equal(fs.readFileSync(path.join(agents, 'marker'), 'utf8'), 'mine\n');
      assert.ok(result.stdout.includes(fs.realpathSync(agents)), result.stdout);
      assert.ok(result.stdout.includes(fs.realpathSync(checkout)), result.stdout);
      assert.equal(fs.existsSync(path.join(home, '.agents.bak')), false);
    });
  });

  it('leaves a symlink to somewhere else in place, prints both paths, and continues', () => {
    withFixture(({ root: fixture, home }) => {
      const { agents, elsewhere, checkout } = foreignAgentsSymlink(home, fixture);
      const result = linkAgents('sh', home, checkout);
      assertContinued(result);
      assert.equal(fs.readlinkSync(agents), elsewhere);
      assert.equal(fs.readFileSync(path.join(elsewhere, 'marker'), 'utf8'), 'mine\n');
      assert.ok(result.stdout.includes(fs.realpathSync(elsewhere)), result.stdout);
      assert.ok(result.stdout.includes(fs.realpathSync(checkout)), result.stdout);
    });
  });

  it('leaves a broken symlink in place, prints both paths, and continues', () => {
    withFixture(({ root: fixture, home }) => {
      const missing = path.join(fixture, 'missing');
      const agents = path.join(home, '.agents');
      fs.symlinkSync(missing, agents);
      const checkout = path.join(fixture, 'checkout');
      fs.mkdirSync(checkout);
      const result = linkAgents('sh', home, checkout);
      assertContinued(result);
      assert.equal(fs.readlinkSync(agents), missing);
      assert.ok(result.stdout.includes(missing), result.stdout);
      assert.ok(result.stdout.includes(fs.realpathSync(checkout)), result.stdout);
    });
  });

  it('moves a conflicting directory aside with --force-link and does not delete it', () => {
    withFixture(({ root: fixture, home }) => {
      const agents = path.join(home, '.agents');
      fs.mkdirSync(agents);
      fs.writeFileSync(path.join(agents, 'marker'), 'mine\n');
      const checkout = path.join(fixture, 'checkout');
      fs.mkdirSync(checkout);
      const result = linkAgents('sh', home, checkout, ['--force-link']);
      assertContinued(result);
      assert.equal(fs.readlinkSync(agents), checkout);
      const aside = path.join(home, '.agents.bak');
      assert.equal(fs.lstatSync(aside).isDirectory(), true);
      assert.equal(fs.readFileSync(path.join(aside, 'marker'), 'utf8'), 'mine\n');
    });
  });

  it('moves a conflicting symlink aside with --force-link and keeps its target', () => {
    withFixture(({ root: fixture, home }) => {
      const { agents, elsewhere, checkout } = foreignAgentsSymlink(home, fixture);
      const result = linkAgents('sh', home, checkout, ['--force-link']);
      assertContinued(result);
      assert.equal(fs.readlinkSync(agents), checkout);
      assert.equal(fs.readlinkSync(path.join(home, '.agents.bak')), elsewhere);
      assert.equal(fs.readFileSync(path.join(elsewhere, 'marker'), 'utf8'), 'mine\n');
    });
  });

  it('does not replace an earlier backup when --force-link moves ~/.agents aside', () => {
    withFixture(({ root: fixture, home }) => {
      const previous = path.join(home, '.agents.bak');
      fs.mkdirSync(previous);
      fs.writeFileSync(path.join(previous, 'marker'), 'old\n');
      const agents = path.join(home, '.agents');
      fs.mkdirSync(agents);
      fs.writeFileSync(path.join(agents, 'marker'), 'mine\n');
      const checkout = path.join(fixture, 'checkout');
      fs.mkdirSync(checkout);
      const result = linkAgents('sh', home, checkout, ['--force-link']);
      assertContinued(result);
      assert.equal(fs.readFileSync(path.join(previous, 'marker'), 'utf8'), 'old\n');
      assert.equal(fs.readFileSync(path.join(home, '.agents.bak.1', 'marker'), 'utf8'), 'mine\n');
      assert.equal(fs.readlinkSync(agents), checkout);
    });
  });

  it('does not move ~/.agents aside when --force-link finds it is already this checkout', () => {
    withFixture(({ root: fixture, home }) => {
      const checkout = path.join(fixture, 'checkout');
      fs.mkdirSync(checkout);
      const agents = path.join(home, '.agents');
      const linkText = path.relative(home, checkout);
      fs.symlinkSync(linkText, agents);
      const result = linkAgents('sh', home, checkout, ['--force-link']);
      assertContinued(result);
      assert.equal(fs.readlinkSync(agents), linkText);
      assert.equal(fs.existsSync(path.join(home, '.agents.bak')), false);
    });
  });

  it('links ~/.agents when that path is absent', () => {
    withFixture(({ root: fixture, home }) => {
      const checkout = path.join(fixture, 'checkout');
      fs.mkdirSync(checkout);
      const agents = path.join(home, '.agents');
      const result = linkAgents('sh', home, checkout);
      assertContinued(result);
      assert.equal(fs.readlinkSync(agents), checkout);
    });
  });

  it('leaves a conflicting directory in place and still finishes a cloned install', () => {
    withFixture(({ root: fixture, home }) => {
      const agents = path.join(home, '.agents');
      fs.mkdirSync(agents);
      fs.writeFileSync(path.join(agents, 'marker'), 'mine\n');
      const result = runDetachedInstall(home, fixture, []);
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, /Waykit is ready/);
      assert.equal(fs.lstatSync(agents).isSymbolicLink(), false);
      assert.equal(fs.readFileSync(path.join(agents, 'marker'), 'utf8'), 'mine\n');
      const checkout = path.join(fixture, 'dest');
      assert.ok(result.stdout.includes(fs.realpathSync(agents)), result.stdout);
      assert.ok(result.stdout.includes(fs.realpathSync(checkout)), result.stdout);
      assert.equal(fs.lstatSync(path.join(home, '.local', 'bin', 'wk')).isSymbolicLink(), true);
    });
  });

  it('refuses --force-link when the checkout is inside ~/.agents', () => {
    withFixture(({ home }) => {
      const agents = path.join(home, '.agents');
      const checkout = path.join(agents, 'checkout');
      fs.mkdirSync(checkout, { recursive: true });
      fs.writeFileSync(path.join(agents, 'marker'), 'keep\n');
      const result = linkAgents('sh', home, checkout, ['--force-link']);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /inside/);
      assert.equal(fs.lstatSync(agents).isSymbolicLink(), false);
      assert.equal(fs.readFileSync(path.join(agents, 'marker'), 'utf8'), 'keep\n');
      assert.equal(fs.existsSync(path.join(home, '.agents.bak')), false);
    });
  });

  it('re-execs an older checkout without passing --force-link', () => {
    withFixture(({ root: fixture, home }) => {
      const oldInstaller = path.join(fixture, 'old-install.sh');
      fs.writeFileSync(
        oldInstaller,
        '#!/bin/sh\nif [ "$1" = "--force-link" ]; then\n  echo "Unknown option: --force-link" >&2\n  exit 1\nfi\necho OLD_BOOTSTRAP\n'
      );
      const agents = path.join(home, '.agents');
      fs.mkdirSync(agents);
      fs.writeFileSync(path.join(agents, 'marker'), 'mine\n');
      const result = runDetachedInstall(home, fixture, ['--force-link'], oldInstaller);
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      assert.match(result.stdout, /OLD_BOOTSTRAP/);
      assert.doesNotMatch(result.stderr, /Unknown option/);
      assert.equal(fs.readFileSync(path.join(agents, 'marker'), 'utf8'), 'mine\n');
    });
  });

  it('forwards --force-link into the cloned checkout and moves the old directory aside', () => {
    withFixture(({ root: fixture, home }) => {
      const agents = path.join(home, '.agents');
      fs.mkdirSync(agents);
      fs.writeFileSync(path.join(agents, 'marker'), 'mine\n');
      const result = runDetachedInstall(home, fixture, ['--force-link']);
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
      const checkout = path.join(fixture, 'dest');
      assert.equal(fs.realpathSync(agents), fs.realpathSync(checkout));
      assert.equal(fs.readFileSync(path.join(home, '.agents.bak', 'marker'), 'utf8'), 'mine\n');
      assert.equal(fs.lstatSync(path.join(home, '.agents.bak')).isDirectory(), true);
    });
  });
});
