import path from 'path';
import { parseMcpHosts, type McpHostId } from '../bootstrap/mcp_hosts.js';
import { isCompletionShell, type KitCompletionShell } from './completion.js';
import { isRepoClass, type RepoClass } from '../doctor/hygiene.js';
import { firstPositional, flagValue, hasFlag, collectFlagValues } from './flags.js';
import { isKitHelpTopic, type KitHelpTopic } from './help.js';
import { cliUsage } from './name.js';

export interface ParseKitArgvOptions {
  cwd: string;
  repoDir: string;
}

export type KitCommand =
  | { kind: 'menu' }
  | { kind: 'help'; topic: KitHelpTopic }
  | { kind: 'unknown'; command: string }
  | { kind: 'usage'; message: string }
  | {
      kind: 'init';
      targetDir: string;
      mcpProfile: string;
      installMCP: boolean;
      installIDE: boolean;
      installHook: boolean;
      hosts: McpHostId[];
    }
  | {
      kind: 'mcp';
      profile: string;
      install: boolean;
      project: boolean;
      outputFile: string | undefined;
      hosts: McpHostId[];
    }
  | { kind: 'audit' }
  | { kind: 'validate' }
  | { kind: 'eval'; rest: string[] }
  | { kind: 'export-rules'; dir: string; check: boolean }
  | { kind: 'metrics' }
  | { kind: 'verify' }
  | { kind: 'agents-generate' }
  | { kind: 'agents-install' }
  | { kind: 'agents-status'; json: boolean }
  | {
      kind: 'agents-launch-prompt';
      skill: string;
      project: string;
      linearId: string | undefined;
      handoverPaths: string[];
      nextAgent: string | undefined;
      definitionOfDone: string | undefined;
    }
  | { kind: 'sync'; rest: string[] }
  | { kind: 'measure-context' }
  | { kind: 'debug-board'; project: string; title: string }
  | { kind: 'debug-ci'; rest: string[] }
  | { kind: 'check'; json: boolean }
  | {
      kind: 'align';
      targetDir: string;
      write: boolean;
      composeMcp: boolean;
      owned: boolean;
      scanDir: string | undefined;
      login: string | undefined;
      json: boolean;
    }
  | { kind: 'version'; check: boolean }
  | { kind: 'ontology'; sub: 'generate' | 'check' }
  | { kind: 'memory-lint' }
  | {
      kind: 'model-resolve';
      skill: string | undefined;
      phase: string | undefined;
      host: string;
      specComplete: boolean | undefined;
      blocked: boolean;
    }
  | { kind: 'site-assemble'; dest: string | undefined }
  | { kind: 'commit-msg'; message: string | undefined; file: string | undefined }
  | {
      kind: 'doctor';
      targetDir: string;
      write: boolean;
      owned: boolean;
      scanDir: string | undefined;
      repoClass: RepoClass | undefined;
      installHook: boolean;
      login: string | undefined;
      json: boolean;
    }
  | { kind: 'completion'; shell: KitCompletionShell }
  | { kind: 'completion-install'; shell: KitCompletionShell | undefined }
  | { kind: 'complete'; words: string[] }
  | {
      kind: 'tdd-guard';
      action: 'hook' | 'install' | 'enable' | 'disable';
      targetDir: string;
    };

const COMPLETION_USAGE = cliUsage('completion <zsh|bash|install>');

const MCP_USAGE = cliUsage(
  'mcp [profile|restore] [--install] [--project] [--host cursor|claude|copilot|antigravity|all] [-o <file>]'
);
const INIT_USAGE = cliUsage(
  'init [dir] [--mcp <profile>] [--host cursor|claude|copilot|antigravity|all] [--hook] [--skip-mcp] [--skip-ide]'
);

const DOCTOR_USAGE = cliUsage(
  'doctor [dir] [--write] [--owned] [--scan <dir>] [--class kit|product|dns|site|template] [--hook] [--login <user>] [--json]'
);

const ALIGN_USAGE = cliUsage(
  'align [dir] [--write] [--mcp] [--owned] [--scan <dir>] [--login <user>] [--json]'
);

const MODEL_RESOLVE_USAGE = cliUsage(
  'model resolve [--skill <id>] [--phase <id>] [--host cursor|claude|copilot|antigravity] [--spec-complete] [--blocked]'
);

const AGENTS_USAGE = cliUsage(
  'agents generate|install|status|launch-prompt [--skill <id>] [--project <name>] [--linear <id>] [--handover <path>] [--next <skill>] [--dod <text>]'
);
const SUBAGENTS_USAGE = cliUsage('subagents status [--json]');
const SITE_ASSEMBLE_USAGE = cliUsage('site assemble [--out <dir>]');
const COMMIT_MSG_USAGE = cliUsage('commit-msg [--message <subject>] [file]');
const TDD_GUARD_USAGE = cliUsage('tdd-guard [hook|install|enable|disable] [dir]');

function helpTopicFromArgv(argv: string[]): KitHelpTopic | undefined {
  const flagged = argv.includes('--help') || argv.includes('-h');
  const head = argv[0];
  const headIsHelp = head === 'help' || head === '--help' || head === '-h';
  if (!flagged && !headIsHelp) return undefined;
  if (headIsHelp) {
    const next = argv[1];
    if (next && !next.startsWith('-') && isKitHelpTopic(next)) return next;
    return 'overview';
  }
  if (head && !head.startsWith('-') && isKitHelpTopic(head)) return head;
  return 'overview';
}

export function parseKitArgv(argv: string[], opts: ParseKitArgvOptions): KitCommand {
  const command = argv[0];
  const rest = argv.slice(1);
  const helpTopic = helpTopicFromArgv(argv);
  if (helpTopic !== undefined) {
    return { kind: 'help', topic: helpTopic };
  }

  switch (command) {
    case undefined:
      return { kind: 'menu' };

    case 'init': {
      const targetFlag = flagValue(rest, '--target');
      const positional = rest[0] && !rest[0].startsWith('--') ? rest[0] : undefined;
      const targetDir = path.resolve(opts.cwd, targetFlag ?? positional ?? '.');
      try {
        return {
          kind: 'init',
          targetDir,
          mcpProfile: flagValue(rest, '--mcp') ?? 'default',
          installMCP: !hasFlag(rest, '--skip-mcp'),
          installIDE: !hasFlag(rest, '--skip-ide'),
          installHook: hasFlag(rest, '--hook') || hasFlag(rest, '--with-hook'),
          hosts: parseMcpHosts(flagValue(rest, '--host'))
        };
      } catch (err: unknown) {
        return { kind: 'usage', message: err instanceof Error ? err.message : INIT_USAGE };
      }
    }

    case 'mcp': {
      const profile = rest[0] && !rest[0].startsWith('-') ? rest[0] : 'default';
      try {
        return {
          kind: 'mcp',
          profile,
          install: hasFlag(rest, '--install'),
          project: hasFlag(rest, '--project'),
          outputFile: flagValue(rest, '-o'),
          hosts: parseMcpHosts(flagValue(rest, '--host'))
        };
      } catch (err: unknown) {
        return { kind: 'usage', message: err instanceof Error ? err.message : MCP_USAGE };
      }
    }

    case 'audit':
    case 'scan':
      return { kind: 'audit' };

    case 'validate':
      return { kind: 'validate' };

    case 'eval':
      return { kind: 'eval', rest };

    case 'export-rules': {
      const target = firstPositional(rest);
      return {
        kind: 'export-rules',
        dir: target ? path.resolve(opts.cwd, target) : opts.repoDir,
        check: hasFlag(rest, '--check')
      };
    }

    case 'metrics':
      return { kind: 'metrics' };

    case 'verify':
      return { kind: 'verify' };

    case 'agents': {
      if (rest[0] === 'generate') {
        return { kind: 'agents-generate' };
      }
      if (rest[0] === 'install') {
        return { kind: 'agents-install' };
      }
      if (rest[0] === 'status') {
        return { kind: 'agents-status', json: hasFlag(rest, '--json') };
      }
      if (rest[0] === 'launch-prompt') {
        const skill = flagValue(rest, '--skill');
        if (!skill || skill.startsWith('--')) {
          return { kind: 'usage', message: AGENTS_USAGE };
        }
        return {
          kind: 'agents-launch-prompt',
          skill,
          project: flagValue(rest, '--project') ?? '',
          linearId: flagValue(rest, '--linear'),
          handoverPaths: collectFlagValues(rest, '--handover'),
          nextAgent: flagValue(rest, '--next'),
          definitionOfDone: flagValue(rest, '--dod')
        };
      }
      return { kind: 'usage', message: AGENTS_USAGE };
    }

    case 'subagents': {
      if (rest[0] === 'status') {
        return { kind: 'agents-status', json: hasFlag(rest, '--json') };
      }
      return { kind: 'usage', message: SUBAGENTS_USAGE };
    }

    case 'sync':
      return { kind: 'sync', rest };

    case 'measure-context':
      return { kind: 'measure-context' };

    case 'debug-board': {
      const project = rest[0];
      if (!project) {
        return { kind: 'usage', message: cliUsage('debug-board <project> [title]') };
      }
      return {
        kind: 'debug-board',
        project,
        title: rest.slice(1).join(' ') || 'debug session'
      };
    }

    case 'debug-ci':
      return { kind: 'debug-ci', rest };

    case 'check':
      return { kind: 'check', json: hasFlag(rest, '--json') };

    case 'version':
      return { kind: 'version', check: hasFlag(rest, '--check') };

    case 'align': {
      const positional = rest[0] && !rest[0].startsWith('--') ? rest[0] : undefined;
      const scan = flagValue(rest, '--scan');
      if (hasFlag(rest, '--scan') && (scan === undefined || scan.startsWith('--'))) {
        return { kind: 'usage', message: ALIGN_USAGE };
      }
      const login = flagValue(rest, '--login');
      if (hasFlag(rest, '--login') && (login === undefined || login.startsWith('--'))) {
        return { kind: 'usage', message: ALIGN_USAGE };
      }
      return {
        kind: 'align',
        targetDir: path.resolve(opts.cwd, positional ?? '.'),
        write: hasFlag(rest, '--write'),
        composeMcp: hasFlag(rest, '--mcp'),
        owned: hasFlag(rest, '--owned'),
        scanDir: scan ? path.resolve(opts.cwd, scan) : undefined,
        login,
        json: hasFlag(rest, '--json')
      };
    }

    case '__complete': {
      const words = rest[0] === '--' ? rest.slice(1) : rest;
      return { kind: 'complete', words };
    }

    case 'completion': {
      const sub = rest[0] && !rest[0].startsWith('--') ? rest[0] : undefined;
      if (sub === 'install') {
        const shellArg = rest[1] && !rest[1].startsWith('--') ? rest[1] : undefined;
        if (shellArg !== undefined && !isCompletionShell(shellArg)) {
          return { kind: 'usage', message: COMPLETION_USAGE };
        }
        return { kind: 'completion-install', shell: shellArg };
      }
      if (!isCompletionShell(sub)) {
        return { kind: 'usage', message: COMPLETION_USAGE };
      }
      return { kind: 'completion', shell: sub };
    }

    case 'doctor': {
      const positional = rest[0] && !rest[0].startsWith('--') ? rest[0] : undefined;
      const repoClassRaw = flagValue(rest, '--class');
      if (hasFlag(rest, '--class') && !isRepoClass(repoClassRaw)) {
        return { kind: 'usage', message: DOCTOR_USAGE };
      }
      const scan = flagValue(rest, '--scan');
      if (hasFlag(rest, '--scan') && (scan === undefined || scan.startsWith('--'))) {
        return { kind: 'usage', message: DOCTOR_USAGE };
      }
      const login = flagValue(rest, '--login');
      if (hasFlag(rest, '--login') && (login === undefined || login.startsWith('--'))) {
        return { kind: 'usage', message: DOCTOR_USAGE };
      }
      return {
        kind: 'doctor',
        targetDir: path.resolve(opts.cwd, positional ?? '.'),
        write: hasFlag(rest, '--write'),
        owned: hasFlag(rest, '--owned'),
        scanDir: scan ? path.resolve(opts.cwd, scan) : undefined,
        repoClass: isRepoClass(repoClassRaw) ? repoClassRaw : undefined,
        installHook: hasFlag(rest, '--hook'),
        login,
        json: hasFlag(rest, '--json')
      };
    }

    case 'ontology': {
      const sub = rest[0];
      if (sub === 'generate' || sub === 'check') {
        return { kind: 'ontology', sub };
      }
      return { kind: 'usage', message: cliUsage('ontology <generate|check>') };
    }

    case 'memory':
      if (rest[0] === 'lint') return { kind: 'memory-lint' };
      return { kind: 'usage', message: cliUsage('memory lint') };

    case 'model': {
      if (rest[0] !== 'resolve') {
        return { kind: 'usage', message: MODEL_RESOLVE_USAGE };
      }
      const modelRest = rest.slice(1);
      const skill = flagValue(modelRest, '--skill');
      const phase = flagValue(modelRest, '--phase');
      if (!skill && !phase) {
        return { kind: 'usage', message: MODEL_RESOLVE_USAGE };
      }
      return {
        kind: 'model-resolve',
        skill,
        phase,
        host: flagValue(modelRest, '--host') ?? 'cursor',
        specComplete: hasFlag(modelRest, '--spec-complete') ? true : undefined,
        blocked: hasFlag(modelRest, '--blocked')
      };
    }

    case 'commit-msg': {
      const message = flagValue(rest, '--message');
      if (hasFlag(rest, '--message') && message === undefined) {
        return { kind: 'usage', message: COMMIT_MSG_USAGE };
      }
      if (message !== undefined) {
        return { kind: 'commit-msg', message, file: undefined };
      }
      const file = firstPositional(rest);
      if (!file) {
        return { kind: 'usage', message: COMMIT_MSG_USAGE };
      }
      return { kind: 'commit-msg', message: undefined, file: path.resolve(opts.cwd, file) };
    }

    case 'tdd-guard': {
      const actionArg = rest[0] && !rest[0].startsWith('--') ? rest[0] : 'hook';
      if (
        actionArg !== 'hook' &&
        actionArg !== 'install' &&
        actionArg !== 'enable' &&
        actionArg !== 'disable'
      ) {
        return { kind: 'usage', message: TDD_GUARD_USAGE };
      }
      const dirArg = rest[1] && !rest[1].startsWith('--') ? rest[1] : '.';
      return {
        kind: 'tdd-guard',
        action: actionArg,
        targetDir: path.resolve(opts.cwd, dirArg)
      };
    }

    case 'site': {
      if (rest[0] !== 'assemble') {
        return { kind: 'usage', message: SITE_ASSEMBLE_USAGE };
      }
      const siteRest = rest.slice(1);
      if (hasFlag(siteRest, '--out') && flagValue(siteRest, '--out') === undefined) {
        return { kind: 'usage', message: SITE_ASSEMBLE_USAGE };
      }
      const destArg = flagValue(siteRest, '--out');
      return {
        kind: 'site-assemble',
        dest: destArg ? path.resolve(opts.cwd, destArg) : undefined
      };
    }

    default:
      return { kind: 'unknown', command };
  }
}
