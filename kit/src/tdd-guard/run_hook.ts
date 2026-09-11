import fs from 'node:fs';
import path from 'node:path';
import { decideWrite } from './decide_write.js';
import { formatHookResponse, type HookDecision } from './format_hook_response.js';
import { parseHookEvent } from './parse_hook_event.js';
import { loadTddGuardState, saveTddGuardState } from './session_store.js';

const STOP_REMINDER =
  'Before COMPLETE, run agent-pre-commit: the repo hook (or every command it names for the changed paths), not a path-filtered test.';

const SESSION_CONTEXT =
  'Waykit TDD Guard is on. Write one failing functional test, run it, confirm red, then the smallest production change. Do not batch production. Toggle with `wk tdd-guard disable` / `enable`. Rules: SOPs/tdd-guard.md.';

export interface RunTddGuardHookOptions {
  stdin: string;
  cwd: string;
  env?: NodeJS.ProcessEnv;
  readFile?: (filePath: string) => string | undefined;
}

export interface RunTddGuardHookResult {
  stdout: string;
  exitCode: number;
}

export function runTddGuardHook(options: RunTddGuardHookOptions): RunTddGuardHookResult {
  const env = options.env ?? process.env;
  const eventName = eventNameOf(options.stdin);
  const event = parseHookEvent(options.stdin);
  const projectRoot = projectRootOf(options.stdin, options.cwd);
  const disabled =
    env.WAYKIT_TDD_GUARD === '0' || env.WAYKIT_TDD_GUARD === 'false' || loadTddGuardState(projectRoot).disabled;

  if (event.kind === 'ignore') {
    return jsonResult(event.host, eventName, { permission: 'allow' });
  }

  if (event.kind === 'session') {
    return jsonResult(event.host, eventName, {
      permission: 'allow',
      additionalContext: SESSION_CONTEXT
    });
  }

  if (event.kind === 'stop') {
    const state = loadTddGuardState(projectRoot);
    const remind =
      !disabled && event.loopCount === 0 && (state.lastTestOutcome === 'fail' || state.lastTestOutcome === 'pass');
    return jsonResult(event.host, eventName, {
      permission: 'allow',
      additionalContext: remind ? STOP_REMINDER : undefined,
      followupMessage: remind ? STOP_REMINDER : undefined
    });
  }

  if (event.kind === 'shell-bypass' && !disabled) {
    return jsonResult(event.host, eventName, {
      permission: 'deny',
      agentMessage:
        'TDD Guard: do not patch production files from the shell. Use Write or StrReplace so the red-green hook can run.',
      userMessage: 'TDD Guard blocked a shell write bypass.'
    });
  }

  if (event.kind === 'test-run') {
    const state = loadTddGuardState(projectRoot);
    saveTddGuardState(projectRoot, {
      ...state,
      lastTestOutcome: event.outcome,
      lastTestCommand: event.command,
      lastTestAt: new Date().toISOString()
    });
    return jsonResult(event.host, eventName, { permission: 'allow' });
  }

  if (event.kind === 'write') {
    const abs = path.isAbsolute(event.path) ? event.path : path.resolve(projectRoot, event.path);
    const previous = options.readFile
      ? options.readFile(abs)
      : fs.existsSync(abs)
        ? fs.readFileSync(abs, 'utf8')
        : undefined;
    const state = loadTddGuardState(projectRoot);
    const decision = decideWrite({
      path: event.path,
      previousContents: previous,
      nextContents: event.contents,
      lastTestOutcome: state.lastTestOutcome,
      disabled
    });
    return jsonResult(event.host, eventName, {
      permission: decision.permission,
      agentMessage: decision.agentMessage,
      userMessage: decision.userMessage
    });
  }

  return jsonResult('cursor', eventName, { permission: 'allow' });
}

function jsonResult(
  host: 'cursor' | 'claude',
  eventName: string,
  decision: HookDecision
): RunTddGuardHookResult {
  return {
    stdout: formatHookResponse(host, eventName, decision),
    exitCode: 0
  };
}

function projectRootOf(raw: string, fallback: string): string {
  try {
    const parsed = JSON.parse(raw) as { cwd?: string; workspace_roots?: string[] };
    if (typeof parsed.cwd === 'string' && parsed.cwd.length > 0) return parsed.cwd;
    const root = parsed.workspace_roots?.[0];
    if (typeof root === 'string' && root.length > 0) return root;
  } catch {
    /* use fallback */
  }
  return fallback;
}

function eventNameOf(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { hook_event_name?: string };
    return parsed.hook_event_name ?? 'preToolUse';
  } catch {
    return 'preToolUse';
  }
}
