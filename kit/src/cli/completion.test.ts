import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  completeKitLine,
  installCompletions,
  listMcpProfileNames,
  renderBashCompletion,
  renderZshCompletion
} from './completion.js';
import { KIT_HELP } from './help.js';
import { parseKitArgv } from './parse.js';
import { KIT_NESTED_COMMANDS, KIT_TOP_LEVEL_COMMANDS } from './spec.js';

const parseOpts = { cwd: '/work', repoDir: '/kit' };
const profiles = ['default', 'collab'] as const;

describe('completeKitLine', () => {
  it('offers top-level verbs from the live command tree', () => {
    const replies = completeKitLine(['wk', ''], { mcpProfiles: profiles });
    for (const cmd of KIT_TOP_LEVEL_COMMANDS) {
      assert.ok(replies.includes(cmd), cmd);
    }
    assert.equal(replies.includes('__complete'), false);
  });

  it('filters by the current prefix and nested eval verbs', () => {
    assert.deepEqual(completeKitLine(['wk', 'ev'], { mcpProfiles: profiles }), ['eval']);
    assert.deepEqual(completeKitLine(['kit', 'eval', ''], { mcpProfiles: profiles }), [
      'run',
      'watch',
      'report',
      'ci',
      'shadow',
      'dataset',
      'miss-rate'
    ]);
    assert.ok(completeKitLine(['wk', 'eval', 'dataset', ''], { mcpProfiles: profiles }).includes('lint'));
  });

  it('lists MCP profiles and doctor flag values from the current checkout', () => {
    assert.deepEqual(completeKitLine(['wk', 'mcp', ''], { mcpProfiles: profiles }), [
      'restore',
      'default',
      'collab',
      '--install',
      '--project',
      '--host',
      '-o'
    ]);
    assert.ok(completeKitLine(['wk', 'doctor', '--'], { mcpProfiles: profiles }).includes('--write'));
    assert.ok(completeKitLine(['wk', 'doctor', '--'], { mcpProfiles: profiles }).includes('--json'));
    assert.ok(completeKitLine(['wk', 'align', '--'], { mcpProfiles: profiles }).includes('--json'));
    assert.ok(completeKitLine(['wk', 'align', '--'], { mcpProfiles: profiles }).includes('--mcp'));
    assert.ok(completeKitLine(['wk', 'check', '--'], { mcpProfiles: profiles }).includes('--json'));
    assert.deepEqual(completeKitLine(['wk', 'doctor', '--class', ''], { mcpProfiles: profiles }), [
      'kit',
      'product',
      'dns',
      'site',
      'template'
    ]);
    assert.ok(completeKitLine(['wk', 'mcp', '--host', ''], { mcpProfiles: profiles }).includes('cursor'));
  });
});

describe('renderCompletion', () => {
  it('emits a thin stub that asks the live binary, not a baked verb list', () => {
    const zsh = renderZshCompletion();
    const bash = renderBashCompletion();
    assert.match(zsh, /#compdef wk$/m);
    assert.doesNotMatch(zsh, /agent-kit/);
    assert.match(zsh, /__complete --/);
    assert.doesNotMatch(zsh, /_values 'eval'/);
    assert.match(bash, /complete -F _wk wk/);
    assert.match(bash, /__complete --/);
    assert.doesNotMatch(bash, /opts="run watch report ci shadow dataset"/);
  });

  it('keeps help and the command tree on the same verbs', () => {
    for (const cmd of KIT_TOP_LEVEL_COMMANDS) {
      if (cmd === 'scan') continue;
      assert.match(KIT_HELP, new RegExp(`(?:^|\\n)\\s+${cmd}\\b`, 'm'));
    }
    assert.match(KIT_HELP, /run\|watch\|report\|ci\|shadow\|dataset\|miss-rate/);
    assert.deepEqual([...KIT_NESTED_COMMANDS.completion], ['zsh', 'bash', 'install']);
  });

  it('parses every advertised verb instead of unknown', () => {
    for (const cmd of KIT_TOP_LEVEL_COMMANDS) {
      const parsed = parseKitArgv([cmd], parseOpts);
      assert.notEqual(parsed.kind, 'unknown', cmd);
    }
  });

  it('lists MCP profile ids from mcps/profiles', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-complete-'));
    const dir = path.join(root, 'mcps', 'profiles');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'default.json'), '{}', 'utf8');
    fs.writeFileSync(path.join(dir, 'ops.json'), '{}', 'utf8');
    assert.deepEqual(listMcpProfileNames(root), ['default', 'ops']);
  });

  it('writes upgrade-stable stubs under the home completion dirs', () => {
    const homedir = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-complete-home-'));
    const result = installCompletions({ homedir, shells: ['zsh'] });
    assert.equal(result.files.length, 1);
    const body = fs.readFileSync(result.files[0] ?? '', 'utf8');
    assert.match(body, /__complete --/);
    assert.match(result.snippet, /fpath=/);
  });
});
