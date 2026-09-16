import path from 'node:path';
import { printCliOutcome, type CliOutcome } from '../cli/outcome.js';
import { originNameWithOwner } from '../doctor/fs.js';
import { loadQualityLoopCatalog } from './catalog.js';
import { setupQualityLoops } from './setup.js';
import { printLoopsStatus, reportLoopsStatus, type LoopsStatusReport } from './status.js';

export type LoopsRunResult = {
  outcome: CliOutcome;
  report: LoopsStatusReport;
  written: string[];
  preview: string | undefined;
};

export function resolveLoopsRepo(targetDir: string): string {
  return originNameWithOwner(targetDir) ?? path.basename(path.resolve(targetDir));
}

export function runLoops(opts: {
  action: 'status' | 'setup';
  targetDir: string;
  write: boolean;
  kitRepoDir: string;
  repo?: string;
}): LoopsRunResult {
  const catalog = loadQualityLoopCatalog(opts.kitRepoDir);
  const repo = opts.repo ?? resolveLoopsRepo(opts.targetDir);
  if (opts.action === 'setup') {
    const setup = setupQualityLoops({
      catalog,
      kitRoot: opts.kitRepoDir,
      targetDir: opts.targetDir,
      write: opts.write,
      repo
    });
    const report = reportLoopsStatus({ catalog, targetDir: opts.targetDir });
    return {
      outcome: opts.write ? (setup.written.length > 0 ? 'ok' : report.outcome) : 'warn',
      report,
      written: setup.written,
      preview: setup.preview
    };
  }
  const report = reportLoopsStatus({ catalog, targetDir: opts.targetDir });
  return { outcome: report.outcome, report, written: [], preview: undefined };
}

export function printLoopsResult(
  result: LoopsRunResult,
  action: 'status' | 'setup',
  write: boolean
): void {
  if (action === 'setup' && !write && result.preview) {
    console.log(result.preview);
    printCliOutcome('warn', 'loops setup', 'preview only; pass --write to fill .cursor/waykit-loops');
    return;
  }
  if (result.written.length > 0) {
    console.log(`wrote: ${result.written.join(', ')}`);
  }
  printLoopsStatus(result.report);
}

export function loopsResultToFindings(result: LoopsRunResult): Array<{
  id: string;
  status: 'ok' | 'fail';
  path: string;
  detail: string;
}> {
  return result.report.rows.map((row) => ({
    id: row.id,
    status: row.recordedId ? 'ok' : 'fail',
    path: `.cursor/waykit-loops/${row.id}.md`,
    detail: row.recordedId ?? result.report.summary
  }));
}
