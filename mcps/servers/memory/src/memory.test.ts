import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { KnowledgeGraphManager } from './graph';
import { callTool } from './server';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

describe('typed memory create_entities', () => {
  it('rejects unknown entity types and accepts allowlisted ones', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-memory-'));
    const file = path.join(tmp, 'mcp-memory.jsonl');
    try {
      const mgr = new KnowledgeGraphManager(file);

      const rejected = await callTool(
        'create_entities',
        {
          entities: [
            { name: 'bad', entityType: 'Alien', observations: ['x'] }
          ]
        },
        mgr,
        kitRoot
      );
      assert.equal(rejected.isError, true);
      assert.match(rejected.content[0].text, /Rejected/);
      assert.deepEqual(await mgr.readGraph(), { entities: [], relations: [] });

      const ok = await callTool(
        'create_entities',
        {
          entities: [
            {
              name: 'EDD',
              entityType: 'GlossaryTerm',
              observations: ['Eval-Driven Development']
            }
          ]
        },
        mgr,
        kitRoot
      );
      assert.equal(ok.isError, undefined);
      const graph = await mgr.readGraph();
      assert.equal(graph.entities.length, 1);
      assert.equal(graph.entities[0].entityType, 'GlossaryTerm');

      // Legacy unknown types remain readable if already on disk
      fs.writeFileSync(
        file,
        JSON.stringify({
          type: 'entity',
          name: 'legacy',
          entityType: 'OldLabel',
          observations: ['kept']
        }) +
          '\n' +
          JSON.stringify({
            type: 'entity',
            name: 'EDD',
            entityType: 'GlossaryTerm',
            observations: ['Eval-Driven Development']
          })
      );
      const read = await mgr.readGraph();
      assert.ok(read.entities.some((e) => e.entityType === 'OldLabel'));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('stdio launch via ~/.agents symlink still initializes', async () => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-memory-home-'));
    fs.symlinkSync(kitRoot, path.join(home, '.agents'));
    const serverFile = path.join(kitRoot, 'mcps', 'servers', 'memory', 'server.json');
    const spec = JSON.parse(fs.readFileSync(serverFile, 'utf8')) as {
      mcp: { memory: { args: string[] } };
    };
    const args = spec.mcp.memory.args.map((a) => a.replaceAll('${userHome}', home));
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-memory-cwd-'));
    const child = spawn('node', args, {
      cwd,
      env: { ...process.env, HOME: home, KIT_ROOT: kitRoot },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const stderr: Buffer[] = [];
    child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk));
    const stdout = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`timeout. stderr=${Buffer.concat(stderr).toString()}`));
      }, 8000);
      let out = '';
      child.stdout?.on('data', (chunk: Buffer) => {
        out += chunk.toString();
        if (out.includes('"serverInfo"')) {
          clearTimeout(timer);
          resolve(out);
        }
      });
      child.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on('exit', (code) => {
        if (!out.includes('"serverInfo"')) {
          clearTimeout(timer);
          reject(
            new Error(
              `exited ${code}. stderr=${Buffer.concat(stderr).toString()} stdout=${out}`
            )
          );
        }
      });
      child.stdin?.write(
        `${JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'probe', version: '0' }
          }
        })}\n`
      );
      child.stdin?.end();
    });
    child.kill('SIGKILL');
    assert.match(stdout, /"name":"memory"/);
  });
});
