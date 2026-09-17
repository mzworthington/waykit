export type UnitTestOutcome = 'pass' | 'fail' | 'skip' | 'todo';

export interface UnitTestCaseResult {
  name: string;
  file: string;
  line?: number;
  outcome: UnitTestOutcome;
  durationMs: number;
  errorMessage?: string;
}

export interface UnitTestReportStats {
  passed: number;
  failed: number;
  skipped: number;
  todo: number;
  total: number;
  durationMs: number;
}

export function relativizeTestFile(file: string | undefined, cwd?: string): string;

export function outcomeFromTestEvent(event: {
  type: string;
  data: {
    skip?: boolean | string;
    todo?: boolean | string;
    details?: { type?: string; error?: { failureType?: string; message?: string } };
  };
}): UnitTestOutcome | null;

export function summarizeUnitTests(cases: UnitTestCaseResult[]): UnitTestReportStats;

export function formatUnitTestErrorMessage(message?: string, maxChars?: number): string;

export function githubErrorAnnotations(cases: UnitTestCaseResult[]): string[];

export function renderUnitTestReportMarkdown(
  cases: UnitTestCaseResult[],
  options?: { cwd?: string; title?: string }
): string;
