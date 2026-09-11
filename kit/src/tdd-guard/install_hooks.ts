import fs from 'node:fs';
import path from 'node:path';

const HOOK_COMMAND = '.cursor/hooks/waykit-tdd-guard.sh';

const HOOK_SCRIPT = `#!/usr/bin/env bash
set -euo pipefail
if [ -x "$HOME/.agents/bin/kit" ]; then
  exec "$HOME/.agents/bin/kit" tdd-guard
fi
if command -v wk >/dev/null 2>&1; then
  exec wk tdd-guard
fi
printf '%s\\n' '{"permission":"allow","additional_context":"Waykit TDD Guard skipped: wk not on PATH"}'
`;

export interface InstallTddGuardHooksResult {
  cursorHooks: string;
  hookScript: string;
  claudeSettings: string;
}

export interface InstallTddGuardHooksOptions {
  cursorDir?: string;
  claudeDir?: string;
}

export function installTddGuardHooks(
  targetDir: string,
  options: InstallTddGuardHooksOptions = {}
): InstallTddGuardHooksResult {
  const cursorDir = options.cursorDir ?? path.join(targetDir, '.cursor');
  const hooksDir = path.join(cursorDir, 'hooks');
  fs.mkdirSync(hooksDir, { recursive: true });

  const hookScript = path.join(hooksDir, 'waykit-tdd-guard.sh');
  fs.writeFileSync(hookScript, HOOK_SCRIPT, { mode: 0o755 });

  const cursorHooksPath = path.join(cursorDir, 'hooks.json');
  const cursorConfig = mergeCursorHooks(readJson(cursorHooksPath));
  fs.writeFileSync(cursorHooksPath, `${JSON.stringify(cursorConfig, null, 2)}\n`, 'utf8');

  const claudeDir = options.claudeDir ?? path.join(targetDir, '.claude');
  fs.mkdirSync(claudeDir, { recursive: true });
  const claudePath = path.join(claudeDir, 'settings.json');
  const claudeConfig = mergeClaudeHooks(readJson(claudePath));
  fs.writeFileSync(claudePath, `${JSON.stringify(claudeConfig, null, 2)}\n`, 'utf8');

  return { cursorHooks: cursorHooksPath, hookScript, claudeSettings: claudePath };
}

function waykitHookEntry(): { command: string; matcher?: string } {
  return { command: HOOK_COMMAND };
}

function mergeCursorHooks(existing: Record<string, unknown>): Record<string, unknown> {
  const hooks = asObject(existing.hooks);
  const entry = waykitHookEntry();
  return {
    ...existing,
    version: existing.version ?? 1,
    hooks: {
      ...hooks,
      preToolUse: upsertCursorList(hooks.preToolUse, { ...entry, matcher: 'Write|StrReplace|Delete|EditNotebook|Shell' }),
      beforeShellExecution: upsertCursorList(hooks.beforeShellExecution, entry),
      afterShellExecution: upsertCursorList(hooks.afterShellExecution, entry),
      postToolUse: upsertCursorList(hooks.postToolUse, { ...entry, matcher: 'Shell' }),
      sessionStart: upsertCursorList(hooks.sessionStart, entry),
      beforeSubmitPrompt: upsertCursorList(hooks.beforeSubmitPrompt, entry),
      stop: upsertCursorList(hooks.stop, { ...entry, loop_limit: 1 })
    }
  };
}

function mergeClaudeHooks(existing: Record<string, unknown>): Record<string, unknown> {
  const hooks = asObject(existing.hooks);
  const commandHook = { type: 'command', command: 'wk tdd-guard' };
  return {
    ...existing,
    hooks: {
      ...hooks,
      PreToolUse: upsertClaudeList(hooks.PreToolUse, {
        matcher: 'Write|Edit|MultiEdit|TodoWrite|Bash',
        hooks: [commandHook]
      }),
      UserPromptSubmit: upsertClaudeList(hooks.UserPromptSubmit, { hooks: [commandHook] }),
      SessionStart: upsertClaudeList(hooks.SessionStart, {
        matcher: 'startup|resume|clear',
        hooks: [commandHook]
      }),
      Stop: upsertClaudeList(hooks.Stop, { hooks: [commandHook] })
    }
  };
}

function upsertCursorList(
  value: unknown,
  entry: { command: string; matcher?: string; loop_limit?: number }
): unknown[] {
  const list = Array.isArray(value) ? [...value] : [];
  if (list.some((item) => asObject(item).command === entry.command)) return list;
  list.push(entry);
  return list;
}

function upsertClaudeList(value: unknown, entry: Record<string, unknown>): unknown[] {
  const list = Array.isArray(value) ? [...value] : [];
  const serialized = JSON.stringify(entry);
  if (list.some((item) => JSON.stringify(item) === serialized)) return list;
  if (list.some((item) => JSON.stringify(item).includes('tdd-guard'))) return list;
  list.push(entry);
  return list;
}

function readJson(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {};
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
