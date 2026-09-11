import { classifyPath, countTestCases, type PathKind } from './classify_path.js';

export type TestOutcome = 'fail' | 'pass' | 'unknown';

export interface DecideWriteInput {
  path: string;
  previousContents?: string;
  nextContents?: string;
  lastTestOutcome: TestOutcome | undefined;
  disabled: boolean;
  kind?: PathKind;
}

export interface WriteDecision {
  permission: 'allow' | 'deny';
  agentMessage?: string;
  userMessage?: string;
}

export function decideWrite(input: DecideWriteInput): WriteDecision {
  if (input.disabled) return { permission: 'allow' };
  const kind = input.kind ?? classifyPath(input.path);
  if (kind === 'exempt') return { permission: 'allow' };

  if (kind === 'test') {
    const previous = countTestCases(input.previousContents ?? '');
    const next = countTestCases(input.nextContents ?? '');
    if (next - previous > 1) {
      return deny(
        'TDD Guard: one test at a time. Split this write so only one new catalog case is introduced, then run it and confirm red.'
      );
    }
    return { permission: 'allow' };
  }

  if (input.lastTestOutcome === 'fail') {
    return { permission: 'allow' };
  }

  const creating = input.previousContents === undefined;
  if (input.lastTestOutcome === 'pass' && creating) {
    return deny(
      'TDD Guard: new production files need a failing test first. Write one test, run it, confirm it fails for the missing behavior, then add this file.'
    );
  }

  if (input.lastTestOutcome === 'pass') {
    return { permission: 'allow' };
  }

  return deny(
    'TDD Guard: production changes need a failing test run first. Write one test, run it, and confirm failure before implementing.'
  );
}

function deny(message: string): WriteDecision {
  return { permission: 'deny', agentMessage: message, userMessage: message };
}
