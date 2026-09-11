import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isLocalModelId, judgeBackendForStyle, resolveEvalRun, type JudgeBackend } from './eval-style.js';
import { tryParseJsonObject } from './parse-json-object.js';
import { ProviderHttpError, withProviderRetry } from './provider-retry.js';

/**
 * Driven port: complete a judge prompt and return parsed JSON.
 * Implemented by infrastructure; domain judges stay pure.
 */
export type JudgeCompletionPort = (input: {
  model: string;
  baseUrl?: string;
  apiKey?: string;
  prompt: string;
}) => Promise<Record<string, unknown>>;

export type { JudgeBackend } from './eval-style.js';

/** Known local code-assistant CLIs with headless JSON mode. */
export type JudgeCliPreset = 'claude' | 'cursor-agent' | 'cursor' | 'agent' | 'agy' | 'antigravity';

export type ExecFileFn = (
  file: string,
  args: string[],
  options: {
    encoding: 'utf8';
    maxBuffer: number;
    timeout: number;
    onStdout?: (chunk: string) => void;
  }
) => Promise<{ stdout: string; stderr: string }>;

/** Spawn a headless assistant CLI; capture stdout, inherit stderr, optionally tee stdout. */
export const spawnCapturedCli: ExecFileFn = async (file, args, options) => {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { stdio: ['ignore', 'pipe', 'inherit'] });
    const chunks: Buffer[] = [];
    child.stdout?.on('data', (chunk: Buffer | string) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      chunks.push(buf);
      options.onStdout?.(buf.toString('utf8'));
    });
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
    }, options.timeout);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const stdout = Buffer.concat(chunks).toString('utf8');
      if (code === 0) {
        resolve({ stdout, stderr: '' });
        return;
      }
      const err = new Error(`CLI exited ${code ?? 'null'}`) as NodeJS.ErrnoException;
      if (code === null) err.code = 'ETIMEDOUT';
      reject(err);
    });
  });
};

/**
 * OpenAI-compatible `/chat/completions` adapter for LLM-as-judge calls.
 * Used for CI (paid/provider HTTP) and local model servers (Ollama, LM Studio, vLLM).
 */
export const openAiCompatibleJudgeCompletion: JudgeCompletionPort = async (input) => {
  const baseUrl = (input.baseUrl ?? process.env.KIT_EVAL_BASE_URL ?? 'https://api.openai.com/v1').replace(
    /\/$/,
    ''
  );
  const apiKey = input.apiKey || 'local';
  return withProviderRetry(async () => {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: input.model,
        messages: [{ role: 'user', content: input.prompt }],
        temperature: 0,
        response_format: { type: 'json_object' }
      })
    });

    if (!res.ok) {
      const body = await res.text();
      throw new ProviderHttpError('Judge', res.status, body);
    }

    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? '{}';
    try {
      return JSON.parse(content) as Record<string, unknown>;
    } catch {
      return {};
    }
  });
};

/**
 * Normalize CLI envelopes (Claude Code / Cursor Agent / Antigravity) into judge JSON.
 * Accepts a raw judge object, or an envelope whose result/response/content is JSON text.
 */
export function parseJudgeCliStdout(stdout: string): Record<string, unknown> {
  const envelope = tryParseJsonObject(stdout);
  if (!envelope) return {};

  if ('score' in envelope || 'results' in envelope) {
    return envelope;
  }

  for (const key of ['result', 'response', 'content', 'message', 'text', 'output']) {
    const value = envelope[key];
    if (typeof value === 'string') {
      const inner = tryParseJsonObject(value);
      if (inner) return inner;
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      if ('score' in obj || 'results' in obj) return obj;
      if (typeof obj.content === 'string') {
        const nested = tryParseJsonObject(obj.content);
        if (nested) return nested;
      }
      if (typeof obj.text === 'string') {
        const nested = tryParseJsonObject(obj.text);
        if (nested) return nested;
      }
    }
  }

  return envelope;
}

export interface CliJudgePresetConfig {
  command: string;
  buildArgs: (input: { prompt: string; model: string }) => string[];
}

function jsonPromptArgs(prompt: string, model: string): string[] {
  const modelArgs = isLocalModelId(model) ? [] : ['--model', model];
  return ['-p', prompt, '--output-format', 'json', ...modelArgs];
}

function jsonPromptPreset(command: string): CliJudgePresetConfig {
  return {
    command,
    buildArgs: ({ prompt, model }) => jsonPromptArgs(prompt, model)
  };
}

/**
 * Cursor Agent CLI. The editor wrapper (`cursor agent`) execs ~/.local/bin/cursor-agent.
 * Docs sometimes say `agent`; the installed binary name is cursor-agent.
 */
const cursorAgentPreset: CliJudgePresetConfig = {
  command: 'cursor-agent',
  buildArgs: ({ prompt, model }) => [...jsonPromptArgs(prompt, model), '--mode=ask', '--trust']
};

const CURSOR_AGENT_COMMANDS = new Set(['cursor-agent', 'cursor', 'agent']);

export function resolveJudgeCliExecutable(
  command: string,
  options: { homedir?: string; exists?: (filePath: string) => boolean } = {}
): string {
  if (!CURSOR_AGENT_COMMANDS.has(command)) return command;
  const home = options.homedir ?? os.homedir();
  const exists = options.exists ?? ((filePath) => fs.existsSync(filePath));
  const localAgent = path.join(home, '.local', 'bin', 'cursor-agent');
  if (exists(localAgent)) return localAgent;
  const localAlias = path.join(home, '.local', 'bin', 'agent');
  if (exists(localAlias)) return localAlias;
  return 'cursor-agent';
}

/** Preset argv builders for known headless assistant CLIs. */
export const JUDGE_CLI_PRESETS: Record<JudgeCliPreset, CliJudgePresetConfig> = {
  claude: jsonPromptPreset('claude'),
  agent: cursorAgentPreset,
  cursor: cursorAgentPreset,
  'cursor-agent': cursorAgentPreset,
  agy: jsonPromptPreset('agy'),
  antigravity: jsonPromptPreset('agy')
};

export function resolveAssistantCli(options: {
  cli: string;
  command?: string;
  buildArgs?: (input: { prompt: string; model: string }) => string[];
  homedir?: string;
  exists?: (filePath: string) => boolean;
}): { command: string; buildArgs: (input: { prompt: string; model: string }) => string[] } {
  const preset = JUDGE_CLI_PRESETS[options.cli as JudgeCliPreset];
  return {
    command: resolveJudgeCliExecutable(options.command ?? preset?.command ?? options.cli, {
      homedir: options.homedir,
      exists: options.exists
    }),
    buildArgs: options.buildArgs ?? preset?.buildArgs ?? ((input) => jsonPromptArgs(input.prompt, input.model))
  };
}

export function isSpawnEnoent(err: unknown): boolean {
  return Boolean(err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT');
}

export function assistantCliMissingMessage(role: 'Judge' | 'Agent', command: string): string {
  if (CURSOR_AGENT_COMMANDS.has(command) || command.endsWith(`${path.sep}cursor-agent`)) {
    return (
      `${role} CLI (cursor-agent) not found (ENOENT). ` +
      'Install from https://cursor.com/install — binary is ~/.local/bin/cursor-agent ' +
      `(also invoked as \`cursor agent\`). Put ~/.local/bin on PATH, then retry --cli cursor-agent.`
    );
  }
  return `${role} CLI (${command}) not found on PATH (ENOENT). Install the CLI and ensure it is on PATH.`;
}

export interface CreateCliJudgeCompletionOptions {
  /** Preset name (`claude`, `cursor-agent`, `agy`) or a bare binary on PATH. */
  cli?: string;
  command?: string;
  buildArgs?: (input: { prompt: string; model: string }) => string[];
  /** Injectable for tests. */
  execFile?: ExecFileFn;
  /** Soft timeout per judge call (ms). */
  timeoutMs?: number;
  homedir?: string;
  exists?: (filePath: string) => boolean;
  /** Mirror child stdout while it is still captured for JSON parsing. */
  onStdout?: (chunk: string) => void;
}

/**
 * Shell-out JudgeCompletionPort for local code assistants with headless JSON mode.
 * Prefer for local/dev-loop judging; keep HTTP for CI merge gates.
 */
export function createCliJudgeCompletion(options: CreateCliJudgeCompletionOptions = {}): JudgeCompletionPort {
  const { command, buildArgs } = resolveAssistantCli({
    cli: options.cli ?? 'cursor-agent',
    command: options.command,
    buildArgs: options.buildArgs,
    homedir: options.homedir,
    exists: options.exists
  });
  const execFile = options.execFile ?? spawnCapturedCli;
  const timeoutMs = options.timeoutMs ?? 120_000;

  return async (input) => {
    const args = buildArgs({ prompt: input.prompt, model: input.model });
    try {
      const { stdout } = await execFile(command, args, {
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
        timeout: timeoutMs,
        onStdout: options.onStdout
      });
      return parseJudgeCliStdout(stdout);
    } catch (err) {
      if (isSpawnEnoent(err)) {
        throw new Error(assistantCliMissingMessage('Judge', command));
      }
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Judge CLI (${command}) failed: ${message}`);
    }
  };
}

export interface ResolveJudgeOptions {
  /** Explicit style; default is inferred from key/baseUrl/model. */
  style?: string;
  /** CLI preset or binary when style is `cli`. */
  cli?: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  /** Override port (tests / custom adapters). */
  complete?: JudgeCompletionPort;
  execFile?: ExecFileFn;
  /** When set, tee judge CLI stdout (still parsed as JSON). */
  onStdout?: (chunk: string) => void;
}

/**
 * Infer judge backend from the run style. Agent and judge always share that style.
 */
export function resolveJudgeBackend(options: ResolveJudgeOptions): JudgeBackend {
  if (options.complete) return 'http';
  const run = resolveEvalRun({
    style: options.style,
    model: options.model,
    apiKey: options.apiKey,
    baseUrl: options.baseUrl,
    cli: options.cli
  });
  return judgeBackendForStyle(run.style);
}

/** Resolve the concrete JudgeCompletionPort for the chosen backend (undefined for heuristic). */
export function resolveJudgeCompletion(options: ResolveJudgeOptions): JudgeCompletionPort | undefined {
  if (options.complete) return options.complete;
  const backend = resolveJudgeBackend(options);
  if (backend === 'heuristic') return undefined;
  if (backend === 'cli') {
    return createCliJudgeCompletion({
      cli: options.cli,
      execFile: options.execFile,
      onStdout: options.onStdout
    });
  }
  return openAiCompatibleJudgeCompletion;
}

/** Dummy bearer accepted by most local OpenAI-compatible servers when no real key is set. */
export function resolveJudgeApiKey(apiKey?: string, baseUrl?: string, backend?: JudgeBackend): string | undefined {
  if (apiKey) return apiKey;
  if (backend === 'cli') return 'cli';
  if (baseUrl || backend === 'http') return 'local';
  return undefined;
}
