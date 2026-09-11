import type { TestOutcome } from './decide_write.js';

export type HookHost = 'cursor' | 'claude';

export type ParsedHookEvent =
  | { kind: 'write'; host: HookHost; path: string; contents?: string; cwd?: string }
  | { kind: 'test-run'; host: HookHost; command: string; outcome: TestOutcome; output?: string }
  | { kind: 'shell-bypass'; host: HookHost; command: string }
  | { kind: 'session'; host: HookHost }
  | { kind: 'stop'; host: HookHost; loopCount: number }
  | { kind: 'ignore'; host: HookHost };

interface LooseHook {
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output?: unknown;
  cwd?: string;
  command?: string;
  output?: string;
  prompt?: string;
  status?: string;
  loop_count?: number;
}

const TEST_COMMAND =
  /\b(vitest|jest|pytest|phpunit|rspec|minitest|playwright)\b|\bgo\s+test\b|\bcargo\s+(test|nextest)\b|\b(?:pnpm|npm|yarn|bun)(?:\s+run)?\s+test\b|\bnode(?:\s+\S+)*\s+--test\b/;

const BYPASS_COMMAND = /\b(sed\s+-i|perl\s+-pi|python[^\n]*open\([^)]*['\"]w|tee\s+\S+\.(ts|js|py|go))\b/;

export function parseHookEvent(raw: string): ParsedHookEvent {
  let body: LooseHook;
  try {
    body = JSON.parse(raw) as LooseHook;
  } catch {
    return { kind: 'ignore', host: 'cursor' };
  }
  const eventName = body.hook_event_name ?? '';
  const host: HookHost = hookHost(eventName);
  const claudeEvent = eventName === 'PreToolUse' || eventName === 'UserPromptSubmit' || eventName === 'SessionStart';
  if (claudeEvent) {
    if (eventName === 'SessionStart' || eventName === 'UserPromptSubmit') {
      return { kind: 'session', host: 'claude' };
    }
  }
  if (eventName === 'sessionStart' || eventName === 'beforeSubmitPrompt') {
    return { kind: 'session', host: 'cursor' };
  }
  if (eventName === 'stop' || eventName === 'Stop' || eventName === 'subagentStop') {
    const loopCount = typeof body.loop_count === 'number' && body.loop_count >= 0 ? body.loop_count : 0;
    return { kind: 'stop', host, loopCount };
  }

  const toolName = body.tool_name ?? '';
  const input = body.tool_input ?? {};
  const command = stringField(input.command) ?? body.command ?? '';

  if (eventName === 'afterShellExecution' || eventName === 'PostToolUse' || eventName === 'postToolUse') {
    const shellCommand = command || stringField(input.command) || '';
    if (TEST_COMMAND.test(shellCommand)) {
      const output = body.output ?? stringifyOutput(body.tool_output);
      return {
        kind: 'test-run',
        host,
        command: shellCommand,
        outcome: inferOutcome(output, body.tool_output),
        output
      };
    }
    return { kind: 'ignore', host };
  }

  if (isShellTool(toolName) || eventName === 'beforeShellExecution') {
    if (BYPASS_COMMAND.test(command)) {
      return { kind: 'shell-bypass', host, command };
    }
    return { kind: 'ignore', host };
  }

  if (isWriteTool(toolName) || eventName === 'afterFileEdit') {
    const path = stringField(input.path) ?? stringField(input.file_path) ?? stringField(input.target_notebook);
    if (!path) return { kind: 'ignore', host };
    const contents =
      stringField(input.contents) ?? stringField(input.content) ?? stringField(input.new_string);
    return { kind: 'write', host, path, contents, cwd: body.cwd };
  }

  return { kind: 'ignore', host };
}

function hookHost(eventName: string): HookHost {
  const first = eventName[0];
  if (first && first === first.toUpperCase() && first !== first.toLowerCase()) return 'claude';
  return 'cursor';
}

export function isTestCommand(command: string): boolean {
  return TEST_COMMAND.test(command);
}

function isWriteTool(name: string): boolean {
  return /^(Write|StrReplace|Delete|EditNotebook|Edit|MultiEdit)$/i.test(name);
}

function isShellTool(name: string): boolean {
  return /^(Shell|Bash)$/i.test(name);
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function stringifyOutput(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === undefined) return '';
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function inferOutcome(output: string, toolOutput: unknown): TestOutcome {
  const blob = `${output}\n${stringifyOutput(toolOutput)}`.toLowerCase();
  if (/\b(fail|failed|failure|error)\b/.test(blob) && !/\b0 failed\b/.test(blob)) return 'fail';
  if (/\b(pass|passed|ok)\b/.test(blob) || /\bexitcode["']?\s*[:=]\s*0\b/.test(blob)) return 'pass';
  if (typeof toolOutput === 'object' && toolOutput !== null && 'exitCode' in toolOutput) {
    const code = (toolOutput as { exitCode?: unknown }).exitCode;
    if (code === 0) return 'pass';
    if (typeof code === 'number' && code !== 0) return 'fail';
  }
  return 'unknown';
}
