import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { KIT_HELP } from './help.js';

describe('KIT_HELP', () => {
  it('lists EDD shadow, profile directory, and site assemble build prerequisite', () => {
    assert.match(KIT_HELP, /run\|watch\|report\|ci\|shadow\|dataset\|miss-rate/);
    assert.match(KIT_HELP, /ok \/ warn \/ fail/);
    assert.match(KIT_HELP, /NO_COLOR/);
    assert.match(KIT_HELP, /mcps\/profiles\//);
    assert.match(KIT_HELP, /site assemble[\s\S]*web build first/);
    assert.match(KIT_HELP, /commit-msg/);
    assert.match(KIT_HELP, /doctor \[dir\]/);
    assert.match(KIT_HELP, /--mcp composes kit default/);
    assert.match(KIT_HELP, /completion <shell>/);
    assert.match(KIT_HELP, /completion install/);
    assert.match(KIT_HELP, /guided menu/);
    assert.match(KIT_HELP, /Day-to-day:/);
    assert.match(KIT_HELP, /Typo, bug, or failed CI/);
    assert.match(KIT_HELP, /wk align \./);
    assert.match(KIT_HELP, /wk version/);
    assert.match(KIT_HELP, /--owned --scan/);
    assert.match(KIT_HELP, /wk check/);
    assert.match(KIT_HELP, /mcp restore --project/);
    assert.match(KIT_HELP, /--json/);
    assert.match(KIT_HELP, /role SKILL\.md line budget/);
    assert.match(KIT_HELP, /agents generate/);
    assert.match(KIT_HELP, /agents install/);
    assert.match(KIT_HELP, /agents status/);
    assert.match(KIT_HELP, /launch-prompt/);
    assert.match(KIT_HELP, /refreshes user kit subagent stubs/);
    assert.match(KIT_HELP, /thin agent stubs/);
    assert.match(KIT_HELP, /Usage: wk <command>/);
    assert.doesNotMatch(KIT_HELP, /kit <command>/);
    assert.doesNotMatch(KIT_HELP, /agent-kit <command>/);
    assert.doesNotMatch(KIT_HELP, /default, collab, ops/);
    assert.doesNotMatch(KIT_HELP, /live trigger/i);
  });
});

describe('printKitHelp topics', () => {
  it('prints an ASCII banner on overview and a focused topic for mcp', async () => {
    const { printKitHelp } = await import('./help.js');
    const lines: string[] = [];
    printKitHelp((msg) => lines.push(msg), 'overview');
    const overview = lines.join('\n');
    assert.match(overview, /╭/);
    assert.match(overview, /WAY/);
    assert.match(overview, /KIT/);
    lines.length = 0;
    printKitHelp((msg) => lines.push(msg), 'mcp');
    assert.match(lines.join('\n'), /One MCP profile/);
  });
});
