import * as p from '@clack/prompts';
import path from 'node:path';
import { MCP_HOSTS, type McpHostId } from '../bootstrap/mcp_hosts.js';
import { listMcpProfileNames } from './completion.js';
import { excludeCancel } from './exclude_cancel.js';
import {
  INTERACTIVE_MAIN_ACTIONS,
  INTERACTIVE_MORE_ACTIONS,
  buildInteractiveInitCommand,
  buildInteractiveMcpCommand,
  commandForMainAction,
  commandForMoreAction,
  type InteractiveMainAction,
  type InteractiveMoreAction
} from './interactiveMenu.js';
import type { KitCommand } from './parse.js';
import { formatCliBanner, renderCliQuickTips } from './cliBanner.js';
import { CLI_BIN } from './name.js';

function exitOnCancel<T>(value: T): Exclude<T, symbol> {
  const kept = excludeCancel(value, p.isCancel);
  if (kept === null) {
    p.cancel('Cancelled.');
    process.exit(0);
  }
  return kept;
}

const HOST_OPTIONS: Array<{ value: McpHostId; label: string }> = [
  { value: 'cursor', label: 'Cursor' },
  { value: 'claude', label: 'Claude Code' },
  { value: 'copilot', label: 'Copilot' },
  { value: 'antigravity', label: 'Antigravity' }
];

function hostsFromSelection(values: readonly string[]): McpHostId[] {
  const hosts: McpHostId[] = [];
  for (const value of values) {
    if (value === 'cursor' || value === 'claude' || value === 'copilot' || value === 'antigravity') {
      hosts.push(value);
    }
  }
  return hosts.length > 0 ? hosts : [...MCP_HOSTS];
}

export async function promptInteractiveInit(input: {
  cwd: string;
  profiles: readonly string[];
}): Promise<Extract<KitCommand, { kind: 'init' }>> {
  p.intro('Bootstrap this repo');
  const targetDir = exitOnCancel(
    await p.text({
      message: 'Target directory',
      placeholder: '.',
      defaultValue: '.'
    })
  );
  const profileOptions = (input.profiles.length > 0 ? input.profiles : ['default']).map((name) => ({
    value: name,
    label: name
  }));
  const mcpProfile = exitOnCancel(
    await p.select({
      message: 'MCP profile',
      options: profileOptions
    })
  );
  const hosts = exitOnCancel(
    await p.multiselect({
      message: 'Hosts to write',
      options: HOST_OPTIONS,
      initialValues: [...MCP_HOSTS],
      required: true
    })
  );
  const installHook = exitOnCancel(
    await p.confirm({
      message: 'Install git hooks? (owned repos only)',
      initialValue: false
    })
  );
  return buildInteractiveInitCommand({
    cwd: input.cwd,
    targetDir: path.resolve(input.cwd, String(targetDir).trim() || '.'),
    mcpProfile: String(mcpProfile),
    installMCP: true,
    installIDE: true,
    installHook,
    hosts: hostsFromSelection(hosts)
  });
}

export async function promptInteractiveMcp(input: {
  profiles: readonly string[];
}): Promise<Extract<KitCommand, { kind: 'mcp' }>> {
  p.intro('Compose MCP');
  const names = input.profiles.length > 0 ? [...input.profiles] : ['default'];
  const mcpProfile = exitOnCancel(
    await p.select({
      message: 'Profile',
      options: [
        ...names.map((name) => ({ value: name, label: name })),
        { value: 'restore', label: 'restore', hint: 'Previous project profile' }
      ]
    })
  );
  const project = exitOnCancel(
    await p.confirm({
      message: 'Write this checkout (project files)?',
      initialValue: true
    })
  );
  const install = exitOnCancel(
    await p.confirm({
      message: 'Also write user-scope host files?',
      initialValue: false
    })
  );
  const hosts = exitOnCancel(
    await p.multiselect({
      message: 'Hosts',
      options: HOST_OPTIONS,
      initialValues: [...MCP_HOSTS],
      required: true
    })
  );
  return buildInteractiveMcpCommand({
    profile: String(mcpProfile),
    install,
    project,
    hosts: hostsFromSelection(hosts)
  });
}

async function promptMainAction(): Promise<InteractiveMainAction> {
  return exitOnCancel(
    await p.select({
      message: 'What do you want to do?',
      options: INTERACTIVE_MAIN_ACTIONS.map((item) => ({
        value: item.value,
        label: item.label,
        hint: item.hint
      }))
    })
  );
}

async function promptMoreAction(): Promise<InteractiveMoreAction> {
  return exitOnCancel(
    await p.select({
      message: 'More commands',
      options: INTERACTIVE_MORE_ACTIONS.map((item) => ({
        value: item.value,
        label: item.label,
        hint: item.hint
      }))
    })
  );
}

export async function promptInteractiveMenu(input: {
  cwd: string;
  repoDir: string;
}): Promise<KitCommand> {
  console.log(formatCliBanner());
  renderCliQuickTips();
  p.intro(`${CLI_BIN} · pick a job`);

  let action = await promptMainAction();
  while (action === 'more') {
    const more = await promptMoreAction();
    if (more === 'back') {
      action = await promptMainAction();
      continue;
    }
    return commandForMoreAction(more, input.cwd);
  }

  if (action === 'init') {
    return promptInteractiveInit({
      cwd: input.cwd,
      profiles: listMcpProfileNames(input.repoDir)
    });
  }
  if (action === 'mcp') {
    return promptInteractiveMcp({ profiles: listMcpProfileNames(input.repoDir) });
  }
  return commandForMainAction(action, input.cwd);
}
