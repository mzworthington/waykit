import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  canonicalizeMcpHost,
  installMcpOnHosts,
  parseMcpHosts,
  projectMcpPath,
  toVsCodeMcpFile,
  userMcpPath,
  writeHostMcpFile
} from './mcp_hosts.js';

describe('parseMcpHosts', () => {
  it('defaults to every supported host', () => {
    assert.deepEqual(parseMcpHosts(undefined), ['cursor', 'claude', 'copilot', 'antigravity']);
    assert.deepEqual(parseMcpHosts('all'), ['cursor', 'claude', 'copilot', 'antigravity']);
  });

  it('accepts aliases and a comma list', () => {
    assert.equal(canonicalizeMcpHost('agy'), 'antigravity');
    assert.equal(canonicalizeMcpHost('vscode'), 'copilot');
    assert.deepEqual(parseMcpHosts('claude, gemini'), ['claude', 'antigravity']);
  });

  it('rejects Windsurf as rules-only forever, not an MCP host', () => {
    assert.throws(
      () => parseMcpHosts('windsurf'),
      /rules-only forever.*\.windsurfrules/s
    );
  });
});

describe('Windsurf host docs', () => {
  it('states rules-only forever and does not promise an MCP writer', () => {
    const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const hosts = fs.readFileSync(path.join(kitRoot, 'docs/hosts.md'), 'utf8');
    assert.match(hosts, /rules-only forever/i);
    assert.match(hosts, /\.windsurfrules/);
    assert.match(hosts, /does not accept `--host windsurf`/);
    assert.doesNotMatch(hosts, /MCP writer yet/i);
  });
});

describe('host MCP paths', () => {
  it('places user and project files where each host actually reads them', () => {
    const home = '/Users/me';
    const app = '/app';
    assert.equal(userMcpPath('cursor', { homedir: home }), path.join(home, '.cursor', 'mcp.json'));
    assert.equal(userMcpPath('claude', { homedir: home }), path.join(home, '.claude.json'));
    assert.equal(userMcpPath('copilot', { homedir: home }), path.join(home, '.copilot', 'mcp-config.json'));
    assert.equal(
      userMcpPath('antigravity', { homedir: home }),
      path.join(home, '.gemini', 'config', 'mcp_config.json')
    );
    assert.equal(projectMcpPath('cursor', app), path.join(app, '.cursor', 'mcp.json'));
    assert.equal(projectMcpPath('claude', app), path.join(app, '.mcp.json'));
    assert.equal(projectMcpPath('copilot', app), path.join(app, '.vscode', 'mcp.json'));
    assert.equal(projectMcpPath('antigravity', app), path.join(app, '.agents', 'mcp_config.json'));
  });
});

describe('VS Code MCP shape', () => {
  it('adds type http for url servers and type stdio for command servers', () => {
    const file = toVsCodeMcpFile({
      linear: { url: 'https://mcp.linear.app/mcp' },
      github: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] }
    });
    assert.deepEqual(file.servers.linear, { type: 'http', url: 'https://mcp.linear.app/mcp' });
    assert.deepEqual(file.servers.github, {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github']
    });
  });
});

describe('writeHostMcpFile', () => {
  it('replaces only the servers Waykit wrote last time', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-host-'));
    const file = path.join(dir, '.claude.json');
    fs.writeFileSync(
      file,
      JSON.stringify({
        theme: 'dark',
        waykitServers: ['old'],
        mcpServers: { old: { command: 'x' }, mine: { command: 'mine' } }
      }),
      'utf8'
    );
    writeHostMcpFile(file, 'claude', { kit: { command: 'node' } });
    const body = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      theme: string;
      waykitServers: string[];
      mcpServers: Record<string, { command?: string }>;
    };
    assert.equal(body.theme, 'dark');
    assert.equal(body.mcpServers.mine?.command, 'mine');
    assert.equal(body.mcpServers.old, undefined);
    assert.equal(body.mcpServers.kit?.command, 'node');
    assert.deepEqual(body.waykitServers, ['kit']);
  });

  it('treats an empty existing file as an empty object', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-host-empty-'));
    const file = path.join(dir, 'mcp_config.json');
    fs.writeFileSync(file, '', 'utf8');
    writeHostMcpFile(file, 'antigravity', { posthog: { url: 'https://mcp.posthog.com/mcp' } });
    const body = JSON.parse(fs.readFileSync(file, 'utf8')) as {
      mcpServers: Record<string, { url?: string }>;
    };
    assert.equal(body.mcpServers.posthog?.url, 'https://mcp.posthog.com/mcp');
  });
});

describe('installMcpOnHosts', () => {
  it('writes user configs for every selected host under homedir', () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-home-'));
    const servers = { kit: { command: 'npx' } };
    const written = installMcpOnHosts(servers, ['cursor', 'claude', 'copilot', 'antigravity'], {
      scope: 'user',
      homedir: home
    });
    assert.equal(written.length, 4);
    const cursor = JSON.parse(fs.readFileSync(path.join(home, '.cursor', 'mcp.json'), 'utf8')) as {
      mcpServers: { kit: unknown };
    };
    const claude = JSON.parse(fs.readFileSync(path.join(home, '.claude.json'), 'utf8')) as {
      mcpServers: { kit: unknown };
    };
    const copilot = JSON.parse(fs.readFileSync(path.join(home, '.copilot', 'mcp-config.json'), 'utf8')) as {
      servers: { kit: { type: string } };
      mcpServers: { kit: unknown };
    };
    assert.equal(copilot.servers.kit.type, 'stdio');
    assert.ok(copilot.mcpServers.kit);
    const agy = JSON.parse(
      fs.readFileSync(path.join(home, '.gemini', 'config', 'mcp_config.json'), 'utf8')
    ) as { mcpServers: { kit: unknown } };
    assert.ok(cursor.mcpServers.kit);
    assert.ok(claude.mcpServers.kit);
    assert.equal(copilot.servers.kit.type, 'stdio');
    assert.ok(agy.mcpServers.kit);
  });

  it('writes project configs next to the app, not only .cursor', () => {
    const app = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-app-'));
    installMcpOnHosts({ kit: { url: 'https://example.test/mcp' } }, ['claude', 'copilot', 'antigravity'], {
      scope: 'project',
      homedir: app,
      projectDir: app
    });
    const claude = JSON.parse(fs.readFileSync(path.join(app, '.mcp.json'), 'utf8')) as {
      mcpServers: { kit: { url: string } };
    };
    const vscode = JSON.parse(fs.readFileSync(path.join(app, '.vscode', 'mcp.json'), 'utf8')) as {
      servers: { kit: { type: string; url: string } };
    };
    assert.equal(claude.mcpServers.kit.url, 'https://example.test/mcp');
    assert.equal(vscode.servers.kit.type, 'http');
    assert.equal(fs.existsSync(path.join(app, '.agents', 'mcp_config.json')), true);
  });
});
