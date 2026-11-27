import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { archiveSpec, readRepoHandover, readWaykitPaths, seedWorkspace } from './layout.js';
import { parseKitArgv } from '../cli/parse.js';
import { runKitCommand } from '../cli/run.js';

describe('readWaykitPaths', () => {
  it('does not create a handover or spec folder when the lifecycle never runs', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-layout-'));
    const paths = readWaykitPaths(repo);

    assert.equal(paths.handover, '.waykit/handover');
    assert.equal(paths.spec, 'docs/spec');
    assert.equal(fs.existsSync(path.join(repo, '.waykit', 'handover')), false);
    assert.equal(fs.existsSync(path.join(repo, 'docs', 'spec')), false);
  });

  it('gitignores phase handovers and leaves the living spec in git', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-layout-'));
    seedWorkspace(repo);
    const ignore = fs.readFileSync(path.join(repo, '.gitignore'), 'utf8');
    assert.match(ignore, /\.waykit\/handover\//);
    assert.equal(ignore.includes('docs/spec'), false);
  });

  it('moves a completed spec into the archive and updates the living spec in the same change', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-layout-'));
    seedWorkspace(repo);
    const specDir = path.join(repo, 'docs', 'spec');
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, 'order.md'), '# order\n', 'utf8');
    fs.writeFileSync(path.join(specDir, 'living.md'), '# living\nold\n', 'utf8');

    archiveSpec(repo, 'order.md', '# living\norder is done\n');

    assert.equal(fs.existsSync(path.join(specDir, 'order.md')), false);
    assert.match(fs.readFileSync(path.join(repo, 'docs', 'spec', 'archive', 'order.md'), 'utf8'), /# order/);
    assert.match(fs.readFileSync(path.join(specDir, 'living.md'), 'utf8'), /order is done/);
  });

  it('reads the repo handover and does not read ~/.agents/handover', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-layout-'));
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-home-'));
    const homeDir = path.join(home, '.agents', 'handover', 'app');
    fs.mkdirSync(homeDir, { recursive: true });
    fs.writeFileSync(path.join(homeDir, 'handover_spec.md'), 'from-home\n', 'utf8');
    const repoDir = path.join(repo, '.waykit', 'handover', 'app');
    fs.mkdirSync(repoDir, { recursive: true });
    fs.writeFileSync(path.join(repoDir, 'handover_spec.md'), 'from-repo\n', 'utf8');

    const found = readRepoHandover(repo, 'app', 'spec', home);

    assert.ok(found);
    assert.match(found.body, /from-repo/);
    assert.equal(found.body.includes('from-home'), false);
    assert.equal(found.path.includes(`${path.sep}.agents${path.sep}`), false);
  });

  it('archives a spec from wk spec archive and updates the living spec', async () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-layout-'));
    seedWorkspace(repo);
    const specDir = path.join(repo, 'docs', 'spec');
    fs.mkdirSync(specDir, { recursive: true });
    fs.writeFileSync(path.join(specDir, 'order.md'), '# order\n', 'utf8');

    const command = parseKitArgv(['spec', 'archive', 'order.md', '--living', 'order is done'], {
      cwd: repo,
      repoDir: repo
    });
    const code = await runKitCommand(command, { repoDir: repo, cwd: repo });

    assert.equal(code, 0);
    assert.equal(fs.existsSync(path.join(specDir, 'order.md')), false);
    assert.match(fs.readFileSync(path.join(repo, 'docs', 'spec', 'archive', 'order.md'), 'utf8'), /# order/);
    assert.match(fs.readFileSync(path.join(specDir, 'living.md'), 'utf8'), /order is done/);
  });
});
