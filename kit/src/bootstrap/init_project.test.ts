import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { initProject } from './init_project.js';

function kitRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-init-src-'));
  const templates = path.join(root, 'templates');
  fs.mkdirSync(templates);
  fs.writeFileSync(path.join(templates, 'project-AGENTS.md'), '# handshake-template\n', 'utf8');
  fs.writeFileSync(path.join(templates, 'host-pointer.md'), '# shared-host-pointer\n', 'utf8');
  const profiles = path.join(root, 'mcps', 'profiles');
  fs.mkdirSync(profiles, { recursive: true });
  fs.writeFileSync(path.join(profiles, 'default.json'), JSON.stringify({ servers: ['alpha'] }), 'utf8');
  const server = path.join(root, 'mcps', 'servers', 'alpha');
  fs.mkdirSync(server, { recursive: true });
  fs.writeFileSync(
    path.join(server, 'server.json'),
    JSON.stringify({ mcp: { alpha: { command: 'npx' } } }),
    'utf8'
  );
  return root;
}

describe('initProject', () => {
  it('creates AGENTS.md from the template and does not overwrite it', () => {
    const kit = kitRoot();
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-app-'));
    initProject({
      targetDir: target,
      mcpProfile: 'default',
      installMCP: false,
      installIDE: false,
      installHook: false,
      kitRepoDir: kit
    });
    assert.equal(fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8'), '# handshake-template\n');
    fs.writeFileSync(path.join(target, 'AGENTS.md'), '# keep-me\n', 'utf8');
    initProject({
      targetDir: target,
      mcpProfile: 'default',
      installMCP: false,
      installIDE: false,
      installHook: false,
      kitRepoDir: kit
    });
    assert.equal(fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8'), '# keep-me\n');
  });

  it('exports IDE rules and composes MCP when requested', () => {
    const kit = kitRoot();
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-app-'));
    const cursorDir = path.join(target, 'cursor-config');
    initProject({
      targetDir: target,
      mcpProfile: 'default',
      installMCP: true,
      installIDE: true,
      installHook: false,
      kitRepoDir: kit,
      cursorDir
    });
    assert.equal(fs.existsSync(path.join(target, 'CLAUDE.md')), true);
    const mcp = JSON.parse(fs.readFileSync(path.join(cursorDir, 'mcp.json'), 'utf8')) as {
      mcpServers: { alpha: unknown };
    };
    assert.ok(mcp.mcpServers.alpha);
    const claudeMcp = JSON.parse(fs.readFileSync(path.join(target, '.mcp.json'), 'utf8')) as {
      mcpServers: { alpha: unknown };
    };
    assert.ok(claudeMcp.mcpServers.alpha);
    const vscodeMcp = JSON.parse(fs.readFileSync(path.join(target, '.vscode', 'mcp.json'), 'utf8')) as {
      servers: { alpha: unknown };
    };
    assert.ok(vscodeMcp.servers.alpha);
  });

  it('installs a pre-commit hook only when .git exists', () => {
    const kit = kitRoot();
    const withGit = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-app-'));
    fs.mkdirSync(path.join(withGit, '.git'));
    const hooksDir = path.join(withGit, 'hooks');
    initProject({
      targetDir: withGit,
      mcpProfile: 'default',
      installMCP: false,
      installIDE: false,
      installHook: true,
      kitRepoDir: kit,
      hooksDir
    });
    const hook = fs.readFileSync(path.join(hooksDir, 'pre-commit'), 'utf8');
    assert.match(hook, /"\$WK" audit/);
    assert.match(hook, /command -v wk/);
    const commitMsg = fs.readFileSync(path.join(hooksDir, 'commit-msg'), 'utf8');
    assert.match(commitMsg, /commit-msg/);

    const noGit = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-app-'));
    initProject({
      targetDir: noGit,
      mcpProfile: 'default',
      installMCP: false,
      installIDE: false,
      installHook: true,
      kitRepoDir: kit,
      hooksDir: path.join(noGit, 'hooks')
    });
    assert.equal(fs.existsSync(path.join(noGit, 'hooks', 'pre-commit')), false);
  });

  it('writes fallback AGENTS.md when the template is missing', () => {
    const kit = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-init-src-'));
    fs.mkdirSync(path.join(kit, 'templates'));
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-app-'));
    initProject({
      targetDir: target,
      mcpProfile: 'default',
      installMCP: false,
      installIDE: false,
      installHook: false,
      kitRepoDir: kit
    });
    assert.match(fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8'), /~\/\.agents/);
  });
});
