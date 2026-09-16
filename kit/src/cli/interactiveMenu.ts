import type { McpHostId } from '../bootstrap/mcp_hosts.js';
import type { KitCommand } from './parse.js';

export type InteractiveMainAction =
  | 'init'
  | 'align'
  | 'mcp'
  | 'check'
  | 'debug-ci'
  | 'more'
  | 'help';

export const INTERACTIVE_MAIN_ACTIONS: Array<{
  value: InteractiveMainAction;
  label: string;
  hint: string;
}> = [
  { value: 'init', label: 'Bootstrap this repo', hint: 'Handshake, MCP, host pointers, optional hooks' },
  { value: 'align', label: 'Check this checkout', hint: 'Consumer handshake (report only)' },
  { value: 'mcp', label: 'Compose MCP for this session', hint: 'One named profile' },
  { value: 'check', label: 'Run the merge bar', hint: 'audit, ontology, evals, context budget' },
  { value: 'debug-ci', label: 'Debug a failed CI run', hint: 'Latest failed GitHub Actions logs' },
  { value: 'more', label: 'More…', hint: 'eval, agents, doctor, sync' },
  { value: 'help', label: 'Show help', hint: 'Grouped command list' }
];

export type InteractiveMoreAction =
  | 'eval'
  | 'agents-status'
  | 'doctor'
  | 'loops'
  | 'sync'
  | 'audit'
  | 'back';

export const INTERACTIVE_MORE_ACTIONS: Array<{
  value: InteractiveMoreAction;
  label: string;
  hint: string;
}> = [
  { value: 'eval', label: 'Run evals', hint: 'Skill-trigger / EDD' },
  { value: 'agents-status', label: 'Agent launch status', hint: 'subagent vs skills-only' },
  { value: 'doctor', label: 'Repo doctor', hint: 'Community files on owned sources' },
  { value: 'loops', label: 'Quality-loop Automations', hint: 'Catalog, MCP checklist, project pack' },
  { value: 'sync', label: 'Sync external skills', hint: 'Lockfile + user stubs' },
  { value: 'audit', label: 'Security audit', hint: 'Skills and scripts' },
  { value: 'back', label: 'Back', hint: 'Return to the main menu' }
];

export function shouldShowInteractiveMenu(opts: {
  stdoutIsTTY: boolean;
  env: NodeJS.ProcessEnv;
}): boolean {
  const force = opts.env.WK_INTERACTIVE;
  if (force === '1' || force === 'true') return true;
  if (opts.env.CI === 'true' || opts.env.CI === '1') return false;
  return opts.stdoutIsTTY;
}

export function buildInteractiveInitCommand(input: {
  cwd: string;
  targetDir: string;
  mcpProfile: string;
  installMCP: boolean;
  installIDE: boolean;
  installHook: boolean;
  hosts: readonly McpHostId[];
}): Extract<KitCommand, { kind: 'init' }> {
  return {
    kind: 'init',
    targetDir: input.targetDir.trim() || input.cwd,
    mcpProfile: input.mcpProfile.trim() || 'default',
    installMCP: input.installMCP,
    installIDE: input.installIDE,
    installHook: input.installHook,
    hosts: [...input.hosts]
  };
}

export function buildInteractiveMcpCommand(input: {
  profile: string;
  install: boolean;
  project: boolean;
  hosts: readonly McpHostId[];
}): Extract<KitCommand, { kind: 'mcp' }> {
  return {
    kind: 'mcp',
    profile: input.profile.trim() || 'default',
    install: input.install,
    project: input.project,
    outputFile: undefined,
    hosts: [...input.hosts]
  };
}

export function commandForMainAction(
  action: Exclude<InteractiveMainAction, 'more' | 'mcp' | 'init'>,
  cwd: string
): KitCommand {
  switch (action) {
    case 'align':
      return {
        kind: 'align',
        targetDir: cwd,
        write: false,
        composeMcp: false,
        owned: false,
        scanDir: undefined,
        login: undefined,
        json: false
      };
    case 'check':
      return { kind: 'check', json: false };
    case 'debug-ci':
      return { kind: 'debug-ci', rest: [] };
    case 'help':
      return { kind: 'help', topic: 'overview' };
  }
}

export function commandForMoreAction(
  action: Exclude<InteractiveMoreAction, 'back'>,
  cwd: string
): KitCommand {
  switch (action) {
    case 'eval':
      return { kind: 'eval', rest: [] };
    case 'agents-status':
      return { kind: 'agents-status', json: false };
    case 'doctor':
      return {
        kind: 'doctor',
        targetDir: cwd,
        write: false,
        owned: false,
        scanDir: undefined,
        repoClass: undefined,
        installHook: false,
        login: undefined,
        json: false
      };
    case 'loops':
      return {
        kind: 'loops',
        action: 'status',
        targetDir: cwd,
        write: false,
        json: false
      };
    case 'sync':
      return { kind: 'sync', rest: ['--install'] };
    case 'audit':
      return { kind: 'audit' };
  }
}
