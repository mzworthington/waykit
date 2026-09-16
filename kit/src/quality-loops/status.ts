import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { QualityLoopCatalog } from './catalog.js';
import { printCliOutcome, type CliOutcome } from '../cli/outcome.js';

export const LOOPS_PACK_REL = '.cursor/waykit-loops';
export const LOOPS_OVERLAY_REL = `${LOOPS_PACK_REL}/overlay.yaml`;

export type LoopsOverlay = {
  project: string | undefined;
  automations: Map<string, string>;
};

export type LoopsStatusRow = {
  id: string;
  name: string;
  trigger: string;
  cron: string | undefined;
  maxItemsPerRun: number;
  mcp: readonly string[];
  opensPr: boolean;
  recordedId: string | undefined;
};

export type LoopsStatusReport = {
  outcome: CliOutcome;
  packPresent: boolean;
  summary: string;
  mcpHint: string;
  rows: LoopsStatusRow[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseLoopsOverlay(raw: string): LoopsOverlay {
  const parsed = parseYaml(raw);
  if (!isRecord(parsed)) {
    throw new Error('waykit-loops overlay must be a mapping');
  }
  const automations = new Map<string, string>();
  if (parsed.automations !== undefined) {
    if (!isRecord(parsed.automations)) {
      throw new Error('waykit-loops overlay automations must be a mapping');
    }
    for (const [id, value] of Object.entries(parsed.automations)) {
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (trimmed === '') continue;
      automations.set(id, trimmed);
    }
  }
  return {
    project: typeof parsed.project === 'string' && parsed.project.trim() !== '' ? parsed.project : undefined,
    automations
  };
}

export function readLoopsOverlay(targetDir: string): LoopsOverlay {
  const filePath = path.join(targetDir, LOOPS_OVERLAY_REL);
  if (!fs.existsSync(filePath)) {
    return { project: undefined, automations: new Map() };
  }
  return parseLoopsOverlay(fs.readFileSync(filePath, 'utf8'));
}

export function packPresent(targetDir: string): boolean {
  return fs.existsSync(path.join(targetDir, LOOPS_PACK_REL));
}

export function reportLoopsStatus(opts: {
  catalog: QualityLoopCatalog;
  targetDir: string;
}): LoopsStatusReport {
  const overlay = readLoopsOverlay(opts.targetDir);
  const present = packPresent(opts.targetDir);
  const rows: LoopsStatusRow[] = opts.catalog.automations.map((item) => ({
    id: item.id,
    name: item.name,
    trigger: item.trigger,
    cron: item.cron,
    maxItemsPerRun: item.maxItemsPerRun,
    mcp: item.mcp,
    opensPr: item.opensPr,
    recordedId: overlay.automations.get(item.id)
  }));
  const missingIds = rows.filter((row) => !row.recordedId).length;
  const spending = opts.catalog.dashboard.spending ?? 'https://cursor.com/dashboard?tab=spending';
  const mcpHint = [
    `Connect ${opts.catalog.dashboard.mcp.join(', ')} on ${opts.catalog.dashboard.agents}.`,
    `wk mcp --install rewrites local host files only; it does not wake Cloud Agent sessions.`,
    `Create or inspect Automations at ${opts.catalog.dashboard.automations}.`,
    `Cursor has no per-Automation token cap; set a monthly Cloud Agent spend limit at ${spending}.`
  ].join(' ');

  if (!present) {
    return {
      outcome: 'fail',
      packPresent: false,
      summary: `missing ${LOOPS_PACK_REL} pack`,
      mcpHint,
      rows
    };
  }
  if (missingIds > 0) {
    return {
      outcome: 'warn',
      packPresent: true,
      summary: `${missingIds} automation(s) have no recorded id; paste UUIDs into ${LOOPS_OVERLAY_REL} after creating them`,
      mcpHint,
      rows
    };
  }
  return {
    outcome: 'ok',
    packPresent: true,
    summary: `${rows.length} quality-loop automations recorded`,
    mcpHint,
    rows
  };
}

export function printLoopsStatus(
  report: LoopsStatusReport,
  log: (msg: string) => void = console.log,
  error: (msg: string) => void = console.error
): void {
  log(`Quality-loop Automations (${report.rows.length})`);
  if (!report.packPresent) {
    log(`This project is missing ${LOOPS_PACK_REL}.`);
    log('Write the pack, then open AUTOMATE.md (or Cursor /automate) to create each Automation.');
    log(report.mcpHint);
    log('next:');
    log('  wk loops setup --write');
    printCliOutcome(report.outcome, 'loops', report.summary, { log, error });
    return;
  }
  for (const row of report.rows) {
    const mark = row.recordedId ? 'ok  ' : 'miss';
    const pr = row.opensPr ? 'draft PR' : 'no PR';
    const id = row.recordedId ?? 'no recorded id';
    const cadence = row.cron ? `${row.trigger} ${row.cron}` : `${row.trigger} · cap ${row.maxItemsPerRun}`;
    log(`  ${mark}  ${row.id}  ${cadence} · ${row.mcp.join(', ')} · ${pr} · ${id}`);
  }
  log(report.mcpHint);
  printCliOutcome(report.outcome, 'loops', report.summary, { log, error });
}
