import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatCliBanner, stripAnsi } from './cliBanner.js';
import {
  INTERACTIVE_MAIN_ACTIONS,
  buildInteractiveInitCommand,
  buildInteractiveMcpCommand,
  commandForMainAction,
  commandForMoreAction,
  shouldShowInteractiveMenu
} from './interactiveMenu.js';
import { formatUnknownCommand, suggestKitCommand } from './suggest.js';

describe('cliBanner', () => {
  it('renders an ASCII panel with the Waykit mark', () => {
    const banner = stripAnsi(formatCliBanner('1.0.0'));
    assert.match(banner, /╭/);
    assert.match(banner, /│/);
    assert.match(banner, /╰/);
    assert.match(banner, /WAYKIT/);
    assert.match(banner, /CLI/);
    assert.match(banner, /1\.0\.0/);
  });
});

describe('suggestKitCommand', () => {
  it('suggests close verbs and formats unknown copy without dumping help', () => {
    assert.equal(suggestKitCommand('initt'), 'init');
    assert.equal(suggestKitCommand('zzzz'), undefined);
    const text = formatUnknownCommand('initt');
    assert.match(text, /Unknown command: initt/);
    assert.match(text, /wk init/);
    assert.match(text, /wk help/);
    assert.doesNotMatch(text, /Day-to-day/);
  });
});

describe('interactiveMenu', () => {
  it('lists job-oriented actions', () => {
    assert.deepEqual(
      INTERACTIVE_MAIN_ACTIONS.map((item) => item.value),
      ['init', 'align', 'mcp', 'check', 'debug-ci', 'more', 'help']
    );
  });

  it('shows the menu on a TTY and never in CI unless WK_INTERACTIVE', () => {
    assert.equal(shouldShowInteractiveMenu({ stdoutIsTTY: true, env: {} }), true);
    assert.equal(shouldShowInteractiveMenu({ stdoutIsTTY: false, env: {} }), false);
    assert.equal(shouldShowInteractiveMenu({ stdoutIsTTY: true, env: { CI: 'true' } }), false);
    assert.equal(
      shouldShowInteractiveMenu({ stdoutIsTTY: false, env: { CI: 'true', WK_INTERACTIVE: '1' } }),
      true
    );
  });

  it('builds init and mcp commands from wizard answers', () => {
    assert.deepEqual(
      buildInteractiveInitCommand({
        cwd: '/work',
        targetDir: '/work/app',
        mcpProfile: 'default',
        installMCP: true,
        installIDE: true,
        installHook: false,
        hosts: ['cursor']
      }),
      {
        kind: 'init',
        targetDir: '/work/app',
        mcpProfile: 'default',
        installMCP: true,
        installIDE: true,
        installHook: false,
        hosts: ['cursor']
      }
    );
    assert.deepEqual(
      buildInteractiveMcpCommand({
        profile: 'restore',
        install: false,
        project: true,
        hosts: ['claude']
      }),
      {
        kind: 'mcp',
        profile: 'restore',
        install: false,
        project: true,
        outputFile: undefined,
        hosts: ['claude']
      }
    );
  });

  it('maps menu actions onto the same KitCommand execute path', () => {
    assert.equal(commandForMainAction('check', '/work').kind, 'check');
    assert.deepEqual(commandForMainAction('help', '/work'), { kind: 'help', topic: 'overview' });
    assert.equal(commandForMoreAction('audit', '/work').kind, 'audit');
    const sync = commandForMoreAction('sync', '/work');
    assert.equal(sync.kind, 'sync');
    if (sync.kind === 'sync') assert.deepEqual(sync.rest, ['--install']);
    assert.deepEqual(commandForMoreAction('loops', '/work'), {
      kind: 'loops',
      action: 'status',
      targetDir: '/work',
      write: false,
      json: false
    });
  });
});
