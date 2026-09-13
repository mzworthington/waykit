import type { AgentToolCall, EvalCase } from './schema.js';

export function parseToolArguments(
  raw: string | Record<string, unknown>
): Record<string, unknown> | null {
  if (typeof raw === 'object' && raw !== null) return raw;
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function cloudflareRequestSignature(code: string): string | null {
  if (!/cloudflare\.request\s*\(/.test(code)) return null;
  const method = /method:\s*["'](\w+)["']/.exec(code);
  const path = /path:\s*`([^`]+)`/.exec(code) ?? /path:\s*["']([^"']+)["']/.exec(code);
  if (!method || !path) return null;
  return `${method[1]!.toUpperCase()} ${path[1]}`;
}

function argumentValuesMatch(key: string, expected: unknown, actual: unknown): boolean {
  if (expected !== null && typeof expected === 'object') {
    return JSON.stringify(actual) === JSON.stringify(expected);
  }
  if (actual === expected) return true;
  if (key === 'name' && typeof expected === 'string' && typeof actual === 'string') {
    return sopNameAliases(expected).has(actual);
  }
  if (key === 'query' && typeof expected === 'string' && typeof actual === 'string') {
    return actual.includes(expected);
  }
  if (key === 'code' && typeof expected === 'string' && typeof actual === 'string') {
    return codeValuesMatch(expected, actual);
  }
  return false;
}

function codeValuesMatch(expected: string, actual: string): boolean {
  const expectedRequest = cloudflareRequestSignature(expected);
  const actualRequest = cloudflareRequestSignature(actual);
  if (expectedRequest && actualRequest) return expectedRequest === actualRequest;
  const tokens = expected.split(/\s+/).filter(Boolean);
  const required = tokens.filter((token) => !(token === 'list' && /spec\.paths/.test(actual)));
  return required.length > 0 && required.every((token) => actual.includes(token));
}

function sopNameAliases(stem: string): Set<string> {
  const aliases: Record<string, string[]> = {
    'cloudflare-analytics-ops': ['cloudflare-ops'],
    'cloudflare-ops': ['cloudflare-analytics-ops']
  };
  return new Set([stem, ...(aliases[stem] ?? [])]);
}

function containsExpectedArgs(
  parsed: Record<string, unknown>,
  expected: Record<string, unknown>,
  label: string
): string[] {
  const failures: string[] = [];
  for (const [key, value] of Object.entries(expected)) {
    const actual = parsed[key];
    if (!argumentValuesMatch(key, value, actual)) {
      failures.push(
        `${label} expected ${key}=${JSON.stringify(value)}, got ${JSON.stringify(actual)}`
      );
    }
  }
  return failures;
}

/**
 * Pure `argument_correctness` metric: expected argument meaning, not JSON shape.
 */
export function evaluateArgumentCorrectness(input: {
  testCase: EvalCase;
  toolCalls: AgentToolCall[];
}): string[] {
  const { testCase, toolCalls } = input;
  if (testCase.expect?.no_tool) {
    return [];
  }

  if (testCase.expect?.tools?.length) {
    const failures: string[] = [];
    for (let i = 0; i < testCase.expect.tools.length; i++) {
      const expected = testCase.expect.tools[i]!;
      const call = toolCalls[i];
      if (!call) {
        failures.push(`argument: missing tool call at index ${i}`);
        continue;
      }
      if (!expected.arguments_contains) continue;
      const parsed = parseToolArguments(call.arguments);
      if (!parsed) {
        failures.push(`argument: call[${i}] arguments are not valid JSON`);
        continue;
      }
      failures.push(
        ...containsExpectedArgs(parsed, expected.arguments_contains, `argument: call[${i}]`)
      );
    }
    return failures;
  }

  const expectedArgs = testCase.expect?.arguments_contains;
  if (!expectedArgs) {
    return [];
  }
  const call = toolCalls[0];
  if (!call) {
    return ['argument: no tool call to validate'];
  }
  const parsed = parseToolArguments(call.arguments);
  if (!parsed) {
    return ['argument: tool arguments are not valid JSON'];
  }
  return containsExpectedArgs(parsed, expectedArgs, 'argument:');
}
