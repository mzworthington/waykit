import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { exportIDERules, HOST_POINTER_TEMPLATE, IDE_RULE_REL_PATHS } from './export_ide_rules.js';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function kitWithSharedPointer(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-ide-'));
  const templates = path.join(root, 'templates');
  fs.mkdirSync(templates);
  fs.writeFileSync(path.join(templates, HOST_POINTER_TEMPLATE), '# shared-host-pointer\n', 'utf8');
  return root;
}

describe('exportIDERules', () => {
  it('writes the same host-pointer stub to every IDE entry point', () => {
    const kit = kitWithSharedPointer();
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-app-'));
    const ok = exportIDERules(target, false, kit);
    assert.equal(ok, true);
    const stub = '# shared-host-pointer\n';
    for (const rel of IDE_RULE_REL_PATHS) {
      assert.equal(fs.readFileSync(path.join(target, rel), 'utf8'), stub);
    }
  });

  it('keeps committed kit host files identical to host-pointer.md', () => {
    const stub = fs.readFileSync(path.join(kitRoot, 'templates', HOST_POINTER_TEMPLATE), 'utf8');
    for (const rel of IDE_RULE_REL_PATHS) {
      assert.equal(fs.readFileSync(path.join(kitRoot, rel), 'utf8'), stub);
    }
  });

  it('copies the kit host-pointer.md into every entry point', () => {
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-app-'));
    exportIDERules(target, false, kitRoot);
    const stub = fs.readFileSync(path.join(kitRoot, 'templates', HOST_POINTER_TEMPLATE), 'utf8');
    assert.match(stub, /Waykit host pointer/);
    for (const rel of IDE_RULE_REL_PATHS) {
      assert.equal(fs.readFileSync(path.join(target, rel), 'utf8'), stub);
    }
  });

  it('falls back when host-pointer.md is missing', () => {
    const kit = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-ide-'));
    fs.mkdirSync(path.join(kit, 'templates'));
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-app-'));
    exportIDERules(target, false, kit);
    const body = fs.readFileSync(path.join(target, 'CLAUDE.md'), 'utf8');
    assert.match(body, /Waykit host pointer/);
    assert.match(body, /~\/\.agents\/AGENTS\.md/);
    for (const rel of IDE_RULE_REL_PATHS) {
      assert.equal(fs.readFileSync(path.join(target, rel), 'utf8'), body);
    }
  });

  it('check-only passes when all entry points exist', () => {
    const kit = kitWithSharedPointer();
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-app-'));
    exportIDERules(target, false, kit);
    assert.equal(exportIDERules(target, true, kit), true);
  });

  it('check-only fails when an entry point is missing', () => {
    const kit = kitWithSharedPointer();
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-app-'));
    assert.equal(exportIDERules(target, true, kit), false);
  });
});
