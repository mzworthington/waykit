import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseHookEvent } from './parse_hook_event.js';

describe('parseHookEvent', () => {
  it('reads Cursor preToolUse Write path and contents', () => {
    const event = parseHookEvent(
      JSON.stringify({
        hook_event_name: 'preToolUse',
        tool_name: 'Write',
        tool_input: { path: '/app/src/foo.ts', contents: 'export const n = 1;' },
        cwd: '/app'
      })
    );
    assert.equal(event.kind, 'write');
    if (event.kind !== 'write') return;
    assert.equal(event.path, '/app/src/foo.ts');
    assert.equal(event.contents, 'export const n = 1;');
    assert.equal(event.host, 'cursor');
  });

  it('reads Claude PreToolUse Edit file_path', () => {
    const event = parseHookEvent(
      JSON.stringify({
        hook_event_name: 'PreToolUse',
        tool_name: 'Edit',
        tool_input: { file_path: 'src/foo.ts', new_string: 'return 2;' }
      })
    );
    assert.equal(event.kind, 'write');
    if (event.kind !== 'write') return;
    assert.equal(event.path, 'src/foo.ts');
    assert.equal(event.host, 'claude');
  });

  it('classifies test runner shells and file-write bypasses', () => {
    const testRun = parseHookEvent(
      JSON.stringify({
        hook_event_name: 'afterShellExecution',
        command: 'pnpm test',
        output: 'Test Files  1 failed'
      })
    );
    assert.equal(testRun.kind, 'test-run');
    if (testRun.kind !== 'test-run') return;
    assert.equal(testRun.outcome, 'fail');

    const bypass = parseHookEvent(
      JSON.stringify({
        hook_event_name: 'preToolUse',
        tool_name: 'Shell',
        tool_input: { command: "sed -i 's/a/b/' kit/src/foo.ts" }
      })
    );
    assert.equal(bypass.kind, 'shell-bypass');
  });

  it('records node --test and tsx --test as a test run', () => {
    const event = parseHookEvent(
      JSON.stringify({
        hook_event_name: 'afterShellExecution',
        command: 'node --import tsx/esm --test kit/src/tdd-guard/run_hook.test.ts',
        output: '✖ installTddGuardHooks\nℹ fail 1'
      })
    );
    assert.equal(event.kind, 'test-run');
    if (event.kind !== 'test-run') return;
    assert.equal(event.outcome, 'fail');
  });
});
