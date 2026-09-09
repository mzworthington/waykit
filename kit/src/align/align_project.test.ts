import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { stripAnsi } from '../cli/outcome.js';
import { alignNextSteps, alignProject, printAlignResult } from './align_project.js';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function write(root: string, rel: string, contents: string): void {
  const full = path.join(root, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, contents, 'utf8');
}

const THIN_HANDSHAKE = `# Agent Handshake

Standards live in ~/.agents ([Waykit](https://github.com/mzworthington/waykit)).

Start from ~/.agents/AGENTS.md. **Do not** bulk-read philosophy, SOPs, or skills up front.
`;

function kitWithTemplates(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-align-kit-'));
  const templates = path.join(root, 'templates');
  fs.mkdirSync(templates);
  fs.writeFileSync(path.join(templates, 'project-AGENTS.md'), THIN_HANDSHAKE, 'utf8');
  for (const name of [
    'project-GEMINI.md',
    'project-CLAUDE.md',
    'project-windsurfrules',
    'project-cursorrules',
    'project-copilot-instructions.md'
  ]) {
    fs.writeFileSync(path.join(templates, name), `# ${name}\n`, 'utf8');
  }
  return root;
}

function alignedApp(name = 'demoapp'): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `wk -align-${name}-`));
  write(root, 'AGENTS.md', THIN_HANDSHAKE);
  write(root, 'GEMINI.md', 'p\n');
  write(root, 'CLAUDE.md', 'p\n');
  write(root, '.windsurfrules', 'p\n');
  write(root, '.cursorrules', 'p\n');
  write(root, path.join('.github', 'copilot-instructions.md'), 'p\n');
  write(root, path.join('.husky', 'commit-msg'), '#!/bin/sh\n');
  write(root, path.join('.mcp.json'), JSON.stringify({ mcpServers: { 'kit-knowledge': { command: 'node' } } }));
  return root;
}

describe('alignProject', () => {
  it('fails an empty checkout', () => {
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-align-empty-'));
    const result = alignProject({ targetDir: target, kitRepoDir: kitWithTemplates(), write: false });
    assert.equal(result.ok, false);
    const byId = Object.fromEntries(result.findings.map((f) => [f.id, f.status]));
    assert.equal(byId.agents, 'fail');
    assert.equal(byId.budget, 'fail');
    assert.equal(byId['host-pointers'], 'fail');
    assert.equal(byId['commit-msg'], 'fail');
    assert.equal(byId['mcp-kit-knowledge'], 'fail');
  });

  it('passes a thin handshake with pointers, commit-msg, and kit MCP', () => {
    const target = alignedApp();
    const result = alignProject({ targetDir: target, kitRepoDir: kitWithTemplates(), write: false });
    assert.equal(result.ok, true);
    assert.ok(result.findings.every((f) => f.status === 'ok'));
  });

  it('fails when AGENTS.md requires philosophy before phase work', () => {
    const target = alignedApp();
    write(
      target,
      'AGENTS.md',
      'Standards live in ~/.agents.\nRead AGENTS.md and CODING_PHILOSOPHY.md before phase work.\n'
    );
    const result = alignProject({ targetDir: target, kitRepoDir: kitWithTemplates(), write: false });
    assert.equal(result.ok, false);
    const bulk = result.findings.find((f) => f.id === 'no-bulk-load');
    assert.equal(bulk?.status, 'fail');
  });

  it('fails a handover path that still uses a stale project folder', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-align-parent-'));
    const target = path.join(parent, 'archlens');
    fs.cpSync(alignedApp(), target, { recursive: true });
    write(
      target,
      'AGENTS.md',
      `${THIN_HANDSHAKE}\nDead-code backlog: ~/.agents/handover/blueprint/dead-code-backlog.md\n`
    );
    const result = alignProject({ targetDir: target, kitRepoDir: kitWithTemplates(), write: false });
    assert.equal(result.ok, false);
    const home = result.findings.find((f) => f.id === 'handover-home');
    assert.equal(home?.status, 'fail');
  });

  it('writes missing host pointers when --write is set and does not overwrite AGENTS.md', () => {
    const kit = kitWithTemplates();
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-align-write-'));
    write(target, 'AGENTS.md', THIN_HANDSHAKE);
    write(target, path.join('.husky', 'commit-msg'), 'ok\n');
    write(target, path.join('.mcp.json'), JSON.stringify({ mcpServers: { 'kit-knowledge': {} } }));
    const before = fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8');
    const result = alignProject({ targetDir: target, kitRepoDir: kit, write: true });
    assert.equal(result.ok, true);
    assert.ok(result.written.includes('CLAUDE.md'));
    assert.equal(fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8'), before);
    assert.equal(fs.readFileSync(path.join(target, 'CLAUDE.md'), 'utf8'), '# project-CLAUDE.md\n');
  });

  it('passes when only Copilot project MCP includes kit-knowledge', () => {
    const target = alignedApp();
    fs.unlinkSync(path.join(target, '.mcp.json'));
    write(
      target,
      path.join('.vscode', 'mcp.json'),
      JSON.stringify({ servers: { 'kit-knowledge': { type: 'stdio', command: 'node' } } })
    );
    const result = alignProject({ targetDir: target, kitRepoDir: kitWithTemplates(), write: false });
    const mcp = result.findings.find((f) => f.id === 'mcp-kit-knowledge');
    assert.equal(mcp?.status, 'ok');
    assert.equal(result.ok, true);
  });

  it('passes when only Antigravity project MCP includes kit-knowledge', () => {
    const target = alignedApp();
    fs.unlinkSync(path.join(target, '.mcp.json'));
    write(
      target,
      path.join('.agents', 'mcp_config.json'),
      JSON.stringify({ mcpServers: { 'kit-knowledge': { command: 'node' } } })
    );
    const result = alignProject({ targetDir: target, kitRepoDir: kitWithTemplates(), write: false });
    const mcp = result.findings.find((f) => f.id === 'mcp-kit-knowledge');
    assert.equal(mcp?.status, 'ok');
    assert.equal(result.ok, true);
  });

  it('fails and names an empty Copilot MCP file when Cursor MCP is valid', () => {
    const target = alignedApp();
    write(target, path.join('.cursor', 'mcp.json'), JSON.stringify({ mcpServers: { 'kit-knowledge': {} } }));
    write(target, path.join('.vscode', 'mcp.json'), '');
    const result = alignProject({ targetDir: target, kitRepoDir: kitWithTemplates(), write: false });
    const mcp = result.findings.find((f) => f.id === 'mcp-kit-knowledge');
    assert.equal(mcp?.status, 'fail');
    assert.match(mcp?.detail ?? '', /\.vscode\/mcp\.json/);
    assert.equal(result.ok, false);
  });

  it('fails and names an empty Antigravity MCP file when Cursor MCP is valid', () => {
    const target = alignedApp();
    write(target, path.join('.cursor', 'mcp.json'), JSON.stringify({ mcpServers: { 'kit-knowledge': {} } }));
    write(target, path.join('.agents', 'mcp_config.json'), '{}\n');
    const result = alignProject({ targetDir: target, kitRepoDir: kitWithTemplates(), write: false });
    const mcp = result.findings.find((f) => f.id === 'mcp-kit-knowledge');
    assert.equal(mcp?.status, 'fail');
    assert.match(mcp?.detail ?? '', /\.agents\/mcp_config\.json/);
    assert.equal(result.ok, false);
  });

  it('seeds AGENTS.md from the kit template when --write and the file is missing', () => {
    const kit = kitWithTemplates();
    const target = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-align-seed-'));
    write(target, path.join('.husky', 'commit-msg'), 'ok\n');
    write(target, path.join('.mcp.json'), JSON.stringify({ mcpServers: { 'kit-knowledge': {} } }));
    const result = alignProject({ targetDir: target, kitRepoDir: kit, write: true });
    assert.equal(result.ok, true);
    assert.ok(result.written.includes('AGENTS.md'));
    assert.match(fs.readFileSync(path.join(target, 'AGENTS.md'), 'utf8'), /~\/\.agents/);
  });

  it('composes kit default MCP when --mcp is set and never writes cloudflare-ops', () => {
    const target = alignedApp();
    write(
      target,
      '.mcp.json',
      JSON.stringify({ mcpServers: { cloudflare: { url: 'https://mcp.cloudflare.com/mcp' } } })
    );
    const result = alignProject({
      targetDir: target,
      kitRepoDir: kitRoot,
      write: false,
      composeMcp: true,
      mcpHosts: ['claude']
    });
    assert.equal(result.ok, true);
    const body = JSON.parse(fs.readFileSync(path.join(target, '.mcp.json'), 'utf8')) as {
      mcpServers: Record<string, unknown>;
    };
    assert.ok(body.mcpServers['kit-knowledge']);
    assert.ok(body.mcpServers.linear);
    assert.equal(body.mcpServers.cloudflare, undefined);
    assert.ok(result.written.includes('mcp default'));
  });

  it('leaves project MCP unchanged when --mcp is omitted', () => {
    const target = alignedApp();
    const ops = JSON.stringify({ mcpServers: { cloudflare: { url: 'https://mcp.cloudflare.com/mcp' } } });
    write(target, '.mcp.json', ops);
    const result = alignProject({
      targetDir: target,
      kitRepoDir: kitRoot,
      write: true,
      composeMcp: false,
      mcpHosts: ['claude']
    });
    assert.equal(fs.readFileSync(path.join(target, '.mcp.json'), 'utf8'), ops);
    assert.equal(result.written.includes('mcp default'), false);
  });
});

describe('printAlignResult', () => {
  it('prints pass and fail marks', () => {
    const lines: string[] = [];
    printAlignResult(
      {
        ok: false,
        targetDir: '/tmp/app',
        findings: [
          { id: 'agents', label: 'AGENTS.md present', status: 'ok', detail: '' },
          { id: 'host-pointers', label: 'Host pointers', status: 'fail', detail: 'missing CLAUDE.md' }
        ],
        written: []
      },
      (msg) => lines.push(msg)
    );
    assert.match(lines.join('\n'), /ok\s+AGENTS.md present/);
    assert.match(lines.join('\n'), /fail\s+Host pointers/);
    assert.match(stripAnsi(lines.join('\n')), /fail  align/);
    assert.match(lines.join('\n'), /next:/);
    assert.match(lines.join('\n'), /wk align \. --write/);
  });

  it('groups next commands from failed finding ids', () => {
    const steps = alignNextSteps([
      { id: 'agents', label: 'AGENTS.md', status: 'fail', detail: '' },
      { id: 'host-pointers', label: 'hosts', status: 'fail', detail: '' },
      { id: 'mcp-kit-knowledge', label: 'mcp', status: 'fail', detail: '' },
      { id: 'no-bulk-load', label: 'bulk', status: 'fail', detail: '' }
    ]);
    assert.equal(steps.length, 2);
    assert.match(steps[0] ?? '', /--write/);
    assert.match(steps[1] ?? '', /align \. --mcp|mcp default --project/);
  });
});
