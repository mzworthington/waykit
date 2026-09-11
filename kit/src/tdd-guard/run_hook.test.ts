import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { installTddGuardHooks } from './install_hooks.js';
import { runTddGuardHook } from './run_hook.js';
import { saveTddGuardState } from './session_store.js';

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('runTddGuardHook', () => {
  it('denies a production Write before red and allows it after a failing test run', () => {
    fs.mkdirSync(path.join(repoDir, 'out'), { recursive: true });
    const cwd = fs.mkdtempSync(path.join(repoDir, 'out', 'wk-tdd-'));
    const deny = runTddGuardHook({
      cwd,
      stdin: JSON.stringify({
        hook_event_name: 'preToolUse',
        tool_name: 'Write',
        tool_input: { path: 'src/foo.ts', contents: 'export const n = 1;' }
      })
    });
    assert.match(deny.stdout, /"permission":"deny"/);

    saveTddGuardState(cwd, { disabled: false, lastTestOutcome: 'fail' });
    const allow = runTddGuardHook({
      cwd,
      stdin: JSON.stringify({
        hook_event_name: 'preToolUse',
        tool_name: 'Write',
        tool_input: { path: 'src/foo.ts', contents: 'export const n = 1;' }
      })
    });
    assert.match(allow.stdout, /"permission":"allow"/);
  });

  it('reminds agent-pre-commit on stop after a test run, once', () => {
    fs.mkdirSync(path.join(repoDir, 'out'), { recursive: true });
    const cwd = fs.mkdtempSync(path.join(repoDir, 'out', 'wk-tdd-stop-'));
    saveTddGuardState(cwd, { disabled: false, lastTestOutcome: 'pass' });
    const first = runTddGuardHook({
      cwd,
      stdin: JSON.stringify({ hook_event_name: 'stop', status: 'completed', loop_count: 0 })
    });
    assert.match(first.stdout, /agent-pre-commit/);
    assert.match(first.stdout, /followup_message/);

    const second = runTddGuardHook({
      cwd,
      stdin: JSON.stringify({ hook_event_name: 'stop', status: 'completed', loop_count: 1 })
    });
    assert.doesNotMatch(second.stdout, /followup_message/);
  });
});

describe('installTddGuardHooks', () => {
  it('writes Cursor hooks.json, the shim script, and Claude settings without wiping extras', () => {
    fs.mkdirSync(path.join(repoDir, 'out'), { recursive: true });
    const cwd = fs.mkdtempSync(path.join(repoDir, 'out', 'wk-tdd-install-'));
    const cursorDir = path.join(cwd, 'cursor-config');
    const claudeDir = path.join(cwd, 'claude-config');
    fs.mkdirSync(cursorDir, { recursive: true });
    fs.writeFileSync(
      path.join(cursorDir, 'hooks.json'),
      JSON.stringify({ version: 1, hooks: { afterFileEdit: [{ command: './fmt.sh' }] } }),
      'utf8'
    );
    const result = installTddGuardHooks(cwd, { cursorDir, claudeDir });
    const cursor = JSON.parse(fs.readFileSync(result.cursorHooks, 'utf8')) as {
      hooks: {
        afterFileEdit: unknown[];
        preToolUse: Array<{ command: string }>;
        stop: Array<{ command: string; loop_limit?: number }>;
      };
    };
    assert.equal(cursor.hooks.afterFileEdit.length, 1);
    assert.equal(cursor.hooks.preToolUse[0]?.command, '.cursor/hooks/waykit-tdd-guard.sh');
    assert.equal(cursor.hooks.stop[0]?.command, '.cursor/hooks/waykit-tdd-guard.sh');
    assert.equal(cursor.hooks.stop[0]?.loop_limit, 1);
    assert.match(fs.readFileSync(result.hookScript, 'utf8'), /tdd-guard/);
    const claude = JSON.parse(fs.readFileSync(result.claudeSettings, 'utf8')) as {
      hooks: { PreToolUse: unknown[]; Stop: unknown[] };
    };
    assert.ok(Array.isArray(claude.hooks.PreToolUse));
    assert.ok(Array.isArray(claude.hooks.Stop));
  });
});
