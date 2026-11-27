import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { checkBoundaries } from './check.js';
import { parseKitArgv } from '../cli/parse.js';
import { runKitCommand } from '../cli/run.js';

function write(root: string, rel: string, contents: string): void {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents, 'utf8');
}

describe('checkBoundaries', () => {
  it('fails when a TypeScript import crosses a forbidden edge and names that edge', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-boundaries-'));
    write(
      root,
      'boundaries.yaml',
      [
        'layers:',
        '  - name: domain',
        '    paths: [src/domain]',
        '  - name: adapter',
        '    paths: [src/adapter]',
        'forbidden:',
        '  - from: domain',
        '    to: adapter',
        ''
      ].join('\n')
    );
    write(root, 'src/domain/order.ts', "import { save } from '../adapter/db.js';\n");
    write(root, 'src/adapter/db.ts', 'export const save = () => undefined;\n');

    const result = checkBoundaries(root);

    assert.equal(result.ok, false);
    assert.match(result.detail, /domain -> adapter/);
  });

  it('wk boundaries check fails and names the forbidden edge', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-boundaries-cli-'));
    write(
      root,
      'boundaries.yaml',
      [
        'layers:',
        '  - name: domain',
        '    paths: [src/domain]',
        '  - name: adapter',
        '    paths: [src/adapter]',
        'forbidden:',
        '  - from: domain',
        '    to: adapter',
        ''
      ].join('\n')
    );
    write(root, 'src/domain/order.ts', "import { save } from '../adapter/db.js';\n");
    const lines: string[] = [];
    const orig = console.log;
    const origErr = console.error;
    console.log = (msg?: unknown) => {
      lines.push(String(msg));
    };
    console.error = (msg?: unknown) => {
      lines.push(String(msg));
    };
    try {
      const parsed = parseKitArgv(['boundaries', 'check'], { cwd: root, repoDir: root });
      const code = await runKitCommand(parsed, { repoDir: root, cwd: root });
      assert.equal(code, 1);
      assert.match(lines.join('\n'), /domain -> adapter/);
    } finally {
      console.log = orig;
      console.error = origErr;
    }
  });

  it('skips with a named reason when the repo has no boundaries manifest', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-boundaries-skip-'));
    const lines: string[] = [];
    const orig = console.log;
    const origErr = console.error;
    console.log = (msg?: unknown) => {
      lines.push(String(msg));
    };
    console.error = (msg?: unknown) => {
      lines.push(String(msg));
    };
    try {
      const parsed = parseKitArgv(['boundaries', 'check'], { cwd: root, repoDir: root });
      const code = await runKitCommand(parsed, { repoDir: root, cwd: root });
      assert.equal(code, 0);
      assert.match(lines.join('\n'), /skip/);
      assert.match(lines.join('\n'), /boundaries\.yaml/);
    } finally {
      console.log = orig;
      console.error = origErr;
    }
  });
});
