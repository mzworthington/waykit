import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { loadQualityLoopCatalog } from './catalog.js';
import { LOOPS_PACK_REL, setupQualityLoops } from './setup.js';
import { reportLoopsStatus } from './status.js';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('setupQualityLoops', () => {
  it('writes the project pack once and never overwrites', () => {
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wk-loops-setup-'));
    const catalog = loadQualityLoopCatalog(kitRoot);
    const first = setupQualityLoops({
      catalog,
      kitRoot,
      targetDir,
      write: true,
      repo: 'mzworthington/archlens'
    });
    assert.equal(first.written.length > 0, true);
    assert.ok(first.written.includes(`${LOOPS_PACK_REL}/AUTOMATE.md`));
    assert.ok(first.written.includes(`${LOOPS_PACK_REL}/overlay.yaml`));
    assert.ok(first.written.includes(`${LOOPS_PACK_REL}/failed-check.md`));

    const automate = fs.readFileSync(path.join(targetDir, LOOPS_PACK_REL, 'AUTOMATE.md'), 'utf8');
    assert.match(automate, /mzworthington\/archlens/);
    assert.match(automate, /\/automate/);
    assert.match(automate, /cursor.com\/automations/);
    assert.doesNotMatch(automate, /create-automation/);
    assert.doesNotMatch(automate, /wk mcp --install does wake/i);
    assert.match(automate, /does not wake/);
    assert.match(automate, /Stop BLOCKED|stop BLOCKED/);
    assert.match(automate, /File or update one Bug ticket/);

    fs.writeFileSync(path.join(targetDir, LOOPS_PACK_REL, 'AUTOMATE.md'), 'operator edit\n', 'utf8');
    const second = setupQualityLoops({
      catalog,
      kitRoot,
      targetDir,
      write: true,
      repo: 'mzworthington/archlens'
    });
    assert.deepEqual(second.written, []);
    assert.equal(
      fs.readFileSync(path.join(targetDir, LOOPS_PACK_REL, 'AUTOMATE.md'), 'utf8'),
      'operator edit\n'
    );

    const status = reportLoopsStatus({ catalog, targetDir });
    assert.equal(status.packPresent, true);
    assert.equal(status.outcome, 'warn');
  });

  it('previews without writing when --write is off', () => {
    const targetDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wk-loops-preview-'));
    const catalog = loadQualityLoopCatalog(kitRoot);
    const result = setupQualityLoops({
      catalog,
      kitRoot,
      targetDir,
      write: false,
      repo: 'demo/repo'
    });
    assert.equal(result.written.length, 0);
    assert.equal(fs.existsSync(path.join(targetDir, LOOPS_PACK_REL)), false);
    assert.match(result.preview, /Create these Cursor Automations/);
    assert.match(result.preview, /demo\/repo/);
  });
});
