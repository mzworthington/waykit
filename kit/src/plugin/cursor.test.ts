import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { generateCursorPlugin } from './cursor.js';
import { parseKitArgv } from '../cli/parse.js';
import { runKitCommand } from '../cli/run.js';

function kitFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-plugin-src-'));
  fs.mkdirSync(path.join(root, 'skills', 'agent-tdd'), { recursive: true });
  fs.writeFileSync(path.join(root, 'skills', 'agent-tdd', 'SKILL.md'), '---\nname: agent-tdd\n---\n# TDD\n', 'utf8');
  return root;
}

describe('generateCursorPlugin', () => {
  it('writes skills, rules, and a setup skill that calls wk', () => {
    const kit = kitFixture();
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-plugin-out-'));
    generateCursorPlugin(kit, out);

    const setup = fs.readFileSync(path.join(out, 'skills', 'setup', 'SKILL.md'), 'utf8');
    assert.match(setup, /\bwk\b/);
    assert.equal(fs.existsSync(path.join(out, 'rules', 'waykit.mdc')), true);
    assert.match(fs.readFileSync(path.join(out, 'skills', 'agent-tdd', 'SKILL.md'), 'utf8'), /agent-tdd/);
  });

  it('does not copy CLI behavior, evals, or MCP compose into the plugin', () => {
    const kit = kitFixture();
    fs.mkdirSync(path.join(kit, 'kit', 'src', 'bootstrap'), { recursive: true });
    fs.writeFileSync(
      path.join(kit, 'kit', 'src', 'bootstrap', 'compose_mcp.ts'),
      'export function composeMCP() { return "unique-compose-marker"; }\n',
      'utf8'
    );
    fs.mkdirSync(path.join(kit, 'evals'), { recursive: true });
    fs.writeFileSync(path.join(kit, 'evals', 'suite.json'), '{"id":"unique-eval-marker"}\n', 'utf8');
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-plugin-out-'));
    generateCursorPlugin(kit, out);

    const files = walk(out);
    const blob = files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
    assert.equal(blob.includes('unique-compose-marker'), false);
    assert.equal(blob.includes('unique-eval-marker'), false);
    const setup = fs.readFileSync(path.join(out, 'skills', 'setup', 'SKILL.md'), 'utf8');
    assert.match(setup, /wk mcp default/);
    assert.match(setup, /preserves servers/);
  });

  it('calls wk from plugin setup and leaves the other host installers in place', async () => {
    const installPath = path.resolve('install.sh');
    const before = fs.readFileSync(installPath, 'utf8');
    const kit = kitFixture();
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-plugin-out-'));
    const command = parseKitArgv(['plugin', 'cursor', out], { cwd: kit, repoDir: kit });
    const code = await runKitCommand(command, { repoDir: kit, cwd: kit });

    assert.equal(code, 0);
    assert.match(fs.readFileSync(path.join(out, 'skills', 'setup', 'SKILL.md'), 'utf8'), /\bwk\b/);
    assert.equal(fs.readFileSync(installPath, 'utf8'), before);
    assert.match(before, /Claude Code, Copilot, and Antigravity/);
  });
});

function walk(dir: string): string[] {
  const found: string[] = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) found.push(...walk(full));
    else found.push(full);
  }
  return found;
}
