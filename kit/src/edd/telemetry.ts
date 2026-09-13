import { isLocalModelId } from './eval-style.js';
import fs from 'fs';
import path from 'path';
import { diagnoseFailures, type FailureTrace } from './failure-trace.js';
import { redactSecrets } from './redact.js';
import type { TrajectoryStep } from './trajectory.js';

export type { FailureTrace };

export interface CaseResult {
  id: string;
  prompt: string;
  passed: boolean;
  latencyMs: number;
  tokens: number;
  routingConfidence?: number;
  failures: string[];
  tags?: string[];
  hallucinated?: boolean;
  /** Populated for failed cases to drive Markdown failure traces. */
  trace?: FailureTrace;
  schemaOk?: boolean;
  routingOk?: boolean;
  /** Ordered agent steps for multi-step diagnosis. */
  trajectory?: TrajectoryStep[];
}

export interface SuiteReport {
  suite: string;
  suitePath: string;
  model: string;
  startedAt: string;
  finishedAt: string;
  total: number;
  passed: number;
  failed: number;
  routingAccuracy: number;
  schemaAdherence: number;
  hallucinationRate: number;
  totalTokens: number;
  avgLatencyMs: number;
  /** Rough USD from tokens. Omitted for scripted/local models, or when the rate is 0. */
  estimatedCostUsd?: number;
  results: CaseResult[];
}

/** Default blended USD per 1k tokens when KIT_EVAL_TOKEN_USD_PER_1K is unset. Override with that env; `0` disables. */
export const DEFAULT_TOKEN_USD_PER_1K = 0.003;

export function tokenUsdPer1k(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.KIT_EVAL_TOKEN_USD_PER_1K;
  if (raw === undefined || raw.trim() === '') return DEFAULT_TOKEN_USD_PER_1K;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_TOKEN_USD_PER_1K;
  return n;
}

function estimateCostUsd(totalTokens: number, model: string): number | undefined {
  if (isLocalModelId(model)) return undefined;
  const per1k = tokenUsdPer1k();
  if (per1k <= 0) return undefined;
  return (totalTokens / 1000) * per1k;
}

export function buildSuiteReport(input: {
  suite: string;
  suitePath: string;
  model: string;
  startedAt: string;
  results: CaseResult[];
}): SuiteReport {
  const finishedAt = new Date().toISOString();
  const total = input.results.length;
  const passed = input.results.filter((r) => r.passed).length;
  const failed = total - passed;
  const routingCases = input.results.filter(
    (r) => (r.tags ?? []).includes('routing') || r.routingOk !== undefined || r.tags === undefined
  );
  const routingPassed = routingCases.filter((r) => r.routingOk !== false && r.passed).length;
  // Prefer explicit routingOk when present
  const routingScored = input.results.filter((r) => r.routingOk !== undefined);
  const routingAccuracy = routingScored.length
    ? (routingScored.filter((r) => r.routingOk).length / routingScored.length) * 100
    : routingCases.length
      ? (routingPassed / routingCases.length) * 100
      : total
        ? (passed / total) * 100
        : 100;

  const schemaScored = input.results.filter((r) => r.schemaOk !== undefined);
  const schemaAdherence = schemaScored.length
    ? (schemaScored.filter((r) => r.schemaOk).length / schemaScored.length) * 100
    : 100;

  const judged = input.results.filter((r) => r.hallucinated !== undefined);
  const hallucinated = judged.filter((r) => r.hallucinated).length;
  const hallucinationRate = judged.length ? (hallucinated / judged.length) * 100 : 0;
  const totalTokens = input.results.reduce((s, r) => s + r.tokens, 0);
  const avgLatencyMs = total ? input.results.reduce((s, r) => s + r.latencyMs, 0) / total : 0;

  return {
    suite: input.suite,
    suitePath: input.suitePath,
    model: input.model,
    startedAt: input.startedAt,
    finishedAt,
    total,
    passed,
    failed,
    routingAccuracy,
    schemaAdherence,
    hallucinationRate,
    totalTokens,
    avgLatencyMs,
    estimatedCostUsd: estimateCostUsd(totalTokens, input.model),
    results: input.results
  };
}

function diagnoseFailure(result: CaseResult): FailureTrace {
  if (result.trace) {
    return {
      ...result.trace,
      diagnosis: redactSecrets(result.trace.diagnosis),
      suggestedFix: redactSecrets(result.trace.suggestedFix),
      llmOutput: result.trace.llmOutput ? redactSecrets(result.trace.llmOutput) : undefined,
      expectedArguments: result.trace.expectedArguments
        ? redactSecrets(result.trace.expectedArguments)
        : undefined,
      actualArguments: result.trace.actualArguments
        ? redactSecrets(result.trace.actualArguments)
        : undefined
    };
  }
  const base = diagnoseFailures(result.failures, result.hallucinated);
  return {
    diagnosis: redactSecrets(base.diagnosis),
    suggestedFix: redactSecrets(base.suggestedFix)
  };
}

function renderSuiteMarkdown(report: SuiteReport): string {
  const date = report.finishedAt.slice(0, 10);
  const passRate = report.total ? (report.passed / report.total) * 100 : 100;
  const cost =
    report.estimatedCostUsd !== undefined
      ? ` (approx. $${report.estimatedCostUsd.toFixed(2)})`
      : '';

  const lines: string[] = [];
  lines.push(`# Agent Eval Report: ${report.suite}`);
  lines.push(`**Date:** ${date}`);
  lines.push(`**Model:** \`${report.model}\``);
  lines.push(`**Overall Pass Rate:** ${passRate.toFixed(1)}% (${report.passed}/${report.total})`);
  lines.push('');
  lines.push('## Performance Metrics');
  lines.push(`* **Total Tokens:** ${report.totalTokens.toLocaleString()}${cost}`);
  lines.push(`* **Average Latency:** ${Math.round(report.avgLatencyMs)}ms`);
  lines.push(`* **Routing Accuracy:** ${report.routingAccuracy.toFixed(1)}%`);
  lines.push(`* **Schema Adherence:** ${report.schemaAdherence.toFixed(1)}%`);
  if (report.hallucinationRate > 0 || report.results.some((r) => r.hallucinated !== undefined)) {
    lines.push(`* **Hallucination Rate:** ${report.hallucinationRate.toFixed(1)}%`);
  }
  lines.push('');

  const failures = report.results.filter((r) => !r.passed);
  if (failures.length === 0) {
    lines.push('## Failure Traces');
    lines.push('');
    lines.push('_No failures in this suite._');
    lines.push('');
  } else {
    lines.push('## Failure Traces');
    lines.push('');
    for (const f of failures) {
      const trace = diagnoseFailure(f);
      lines.push(`### Test ID: \`${f.id}\``);
      if (f.tags?.length) {
        lines.push(`**Tags:** ${f.tags.map((t) => `\`${t}\``).join(', ')}`);
      }
      lines.push(`* **Prompt:** "${redactSecrets(f.prompt)}"`);
      if (trace.expectedTool !== undefined || f.failures.some((x) => x.includes('routing'))) {
        lines.push(`* **Expected Tool:** \`${trace.expectedTool ?? 'see diagnosis'}\``);
        lines.push(
          `* **Actual Tool:** ${
            trace.actualTool ? `\`${trace.actualTool}\`` : '*None (Conversational Response)*'
          }`
        );
      }
      if (trace.expectedArguments !== undefined || trace.actualArguments !== undefined) {
        lines.push(`* **Expected Arguments:** \`${trace.expectedArguments ?? ''}\``);
        lines.push(`* **Actual Arguments:** \`${trace.actualArguments ?? ''}\``);
      }
      if (trace.llmOutput) {
        lines.push(`* **LLM Output:** "${redactSecrets(trace.llmOutput)}"`);
      }
      if (trace.stepIndex !== undefined) {
        lines.push(`* **Failing Step:** \`${trace.stepIndex}\``);
      }
      if (f.trajectory?.length) {
        lines.push('* **Trajectory:**');
        for (const step of f.trajectory) {
          const label =
            step.kind === 'tool'
              ? `tool ${step.toolName ?? '?'}`
              : step.kind === 'halt'
                ? 'halt'
                : 'message';
          const mark = step.failure ? 'FAIL' : 'ok';
          lines.push(`  * step[${step.index}] ${label} (${mark})${step.failure ? ` - ${step.failure}` : ''}`);
        }
      }
      lines.push(`* **Diagnosis:** ${trace.diagnosis}`);
      lines.push(`* **Suggested Fix:** ${trace.suggestedFix}`);
      if (f.failures.length) {
        lines.push(`* **Raw Assertions:** ${redactSecrets(f.failures.join('; '))}`);
      }
      lines.push('');
    }
  }

  lines.push('## Case Summary');
  lines.push('');
  lines.push('| ID | Result | Latency (ms) | Tokens |');
  lines.push('|----|--------|--------------|--------|');
  for (const r of report.results) {
    lines.push(
      `| ${r.id} | ${r.passed ? 'PASS' : 'FAIL'} | ${r.latencyMs.toFixed(1)} | ${r.tokens} |`
    );
  }
  lines.push('');
  return lines.join('\n');
}

export function generateReport(
  reports: SuiteReport[],
  options: { format: 'md' | 'json'; outDir: string }
): string[] {
  fs.mkdirSync(options.outDir, { recursive: true });
  const written: string[] = [];

  if (options.format === 'json') {
    const outPath = path.join(options.outDir, 'edd-report.json');
    let merged: SuiteReport[] = reports;
    if (fs.existsSync(outPath)) {
      try {
        const prev = JSON.parse(fs.readFileSync(outPath, 'utf8')) as SuiteReport[];
        if (Array.isArray(prev)) {
          const byPath = new Map(prev.map((r) => [r.suitePath, r]));
          for (const r of reports) byPath.set(r.suitePath, r);
          merged = [...byPath.values()];
        }
      } catch {
        merged = reports;
      }
    }
    fs.writeFileSync(outPath, JSON.stringify(merged, null, 2) + '\n', 'utf8');
    written.push(outPath);
    return written;
  }

  const parts: string[] = [];
  for (const report of reports) {
    parts.push(renderSuiteMarkdown(report));
  }
  const body = parts.join('\n---\n\n');

  const outPath = path.join(options.outDir, 'edd-report.md');
  fs.writeFileSync(outPath, body, 'utf8');
  written.push(outPath);

  // Stable PR-facing alias (docs and examples refer to eval-report.md)
  const alias = path.join(options.outDir, 'eval-report.md');
  fs.copyFileSync(outPath, alias);
  written.push(alias);
  return written;
}

export function printReportSummary(report: SuiteReport): void {
  console.log(`\nSuite: ${report.suite}`);
  console.log(`  Passed: ${report.passed}/${report.total}`);
  console.log(`  Routing accuracy: ${report.routingAccuracy.toFixed(1)}%`);
  console.log(`  Schema adherence: ${report.schemaAdherence.toFixed(1)}%`);
  const cost =
    report.estimatedCostUsd !== undefined ? ` | approx. $${report.estimatedCostUsd.toFixed(4)}` : '';
  console.log(`  Tokens: ${report.totalTokens} | Avg latency: ${report.avgLatencyMs.toFixed(1)}ms${cost}`);
  for (const r of report.results) {
    const mark = r.passed ? '✓' : '✗';
    console.log(`  ${mark} ${r.id}${r.failures.length ? ` - ${r.failures.join('; ')}` : ''}`);
  }
}

/** Compact multi-suite table for GitHub Actions job summaries. */
export function renderGithubSummaryOverview(reports: SuiteReport[]): string {
  const lines: string[] = [
    '## EDD overview',
    '',
    '| Suite | Pass rate | Routing | Schema | Tokens | Avg latency | Failed cases |',
    '|-------|-----------|---------|--------|--------|-------------|--------------|'
  ];
  const failedCases: Array<{ suite: string; id: string; failures: string[] }> = [];
  for (const report of reports) {
    const passRate = report.total ? (report.passed / report.total) * 100 : 100;
    const failedIds = report.results.filter((r) => !r.passed).map((r) => r.id);
    for (const r of report.results.filter((row) => !row.passed)) {
      failedCases.push({ suite: report.suite, id: r.id, failures: r.failures });
    }
    lines.push(
      `| ${report.suite} | ${passRate.toFixed(1)}% (${report.passed}/${report.total}) | ${report.routingAccuracy.toFixed(1)}% | ${report.schemaAdherence.toFixed(1)}% | ${report.totalTokens.toLocaleString()} | ${Math.round(report.avgLatencyMs)}ms | ${failedIds.length ? failedIds.map((id) => `\`${id}\``).join(', ') : '—'} |`
    );
  }
  lines.push('');
  if (failedCases.length) {
    lines.push('### Failed cases');
    lines.push('');
    for (const f of failedCases) {
      const reason = f.failures.length ? `: ${redactSecrets(f.failures.join('; '))}` : '';
      lines.push(`- \`${f.suite}\` / \`${f.id}\`${reason}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * Append Markdown to `$GITHUB_STEP_SUMMARY` when running under Actions.
 * Returns true when content was written.
 */
export function appendGithubStepSummary(markdown: string, env: NodeJS.ProcessEnv = process.env): boolean {
  const summaryPath = env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return false;
  const body = markdown.endsWith('\n') ? markdown : `${markdown}\n`;
  fs.appendFileSync(summaryPath, body, 'utf8');
  return true;
}

/** Publish overview + full eval Markdown into the Actions job summary. */
export function publishEvalReportToGithubSummary(
  reports: SuiteReport[],
  markdownBody: string,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const chunk = `${renderGithubSummaryOverview(reports)}\n<details>\n<summary>Full eval report</summary>\n\n${markdownBody}\n</details>\n`;
  return appendGithubStepSummary(chunk, env);
}
