import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { EvalRunner } from './runner.js';
import {
  generateReport,
  publishEvalReportToGithubSummary,
  type SuiteReport
} from './telemetry.js';
import { watchTargets } from './watch.js';
import { loadDataset } from './dataset.js';
import {
  casesFromTraceFile,
  dedupeCases,
  lintCases,
  synthesizeFromSeeds
} from './dataset-hygiene.js';
import { normalizeProdTurn, shadowEvalTurns } from './shadow.js';
import type { EvalCase } from './schema.js';
import { flagValue, hasFlag } from '../cli/flags.js';
import { cliOutcomeExit, cliOutcomeShouldColor } from '../cli/outcome.js';
import { compareMissRates, formatMissRateCompare, missRateOutcome } from './miss_rate.js';
import { resolveCliAgentDriver } from './cli-agent.js';
import { judgeBackendForStyle, resolveEvalRun } from './eval-style.js';
import { resolveJudgeApiKey, resolveJudgeCompletion } from './judge-provider.js';

export interface EddCliOptions {
  repoDir: string;
  args: string[];
}

function printEddHelp(): void {
  console.log(`
Waykit EDD (Eval-Driven Development) commands

Usage: wk eval <subcommand> [options]

Subcommands:
  run      --suite <path> [--model <name>] [--tags a,b] [--out <dir>] [--format md|json]
  watch    --suite <path> [--target <file-or-dir>] [--model <name>]
  report   --format <md|json> --out <dir> [--from <json-report>] [--github-summary]
  ci       --suite <path> [--threshold-routing <pct>] [--model <name>] [--out <dir>]
  shadow   --infile <jsonl> [--sample <rate>] [--out <jsonl>] [--seed <n>]
  dataset  lint|dedupe|synthesize|from-trace [options]
  miss-rate  Compare specialist-launch vs skill-picker prod-derived miss rates

Agent / judge options (run / watch / report / ci):
  --style <name>       local | http | cli  (default: infer; CI uses local)
  --model <name>       One model for agent and judge (local ignores this)
  --cli <name>         When --style cli: cursor-agent | claude | agy | <binary>
  --cli-stdout         Tee CLI stdout to this terminal (still parsed as JSON)
  --base-url <url>     OpenAI-compatible base. Local servers: http://localhost:11434/v1
  --api-key <key>      Override KIT_EVAL_API_KEY / OPENAI_API_KEY (use "local" for Ollama)

Dataset options:
  lint         --dataset <jsonl>
  dedupe       --dataset <jsonl> [--out <jsonl>]
  synthesize   --dataset <jsonl> --count <n> [--out <jsonl>]
  from-trace   --trace <json> [--out <jsonl>]
  miss-rate    Compare evals/edd/subagent_routing.jsonl to evals/suites/routing-matrix.json

Shadow options:
  --infile     NDJSON of prod turns or kit OTel spans (see evals/edd/examples/)
  --sample     Fraction to judge (default 0.05)
  --out        Append shadow_fail cases as JSONL (required to persist fails)
  --seed       Deterministic RNG seed for sampling

Notes:
  - Default style is local (keyword agent + heuristic judge). No API key. --model scripted is an alias.
  - Cases tagged requires-live are skipped on local style; http and cli run them.
  - Cursor as agent and judge: --style cli --cli cursor-agent --model cursor-grok-4.6-medium
  - HTTP agent and judge: KIT_EVAL_API_KEY (or OPENAI_API_KEY) plus --style http --model <provider-model>.
  - Local model servers (Ollama / LM Studio / vLLM): --style http --base-url http://localhost:11434/v1 --model llama3.1
  - One style per run. Agent and judge cannot be mixed.
  - A pause after "agent"/"judges" with --style cli means the CLI is still running. --cli-stdout (or KIT_EVAL_CLI_STDOUT=1) prints stdout live.
  - --github-summary (or GITHUB_ACTIONS=true) publishes the Markdown report to $GITHUB_STEP_SUMMARY.
  - Bare "wk eval" (no subcommand) still runs the skill trigger harness.
`);
}

export function getEddFlag(args: string[], name: string): string | undefined {
  return flagValue(args, name);
}

export function hasEddFlag(args: string[], name: string): boolean {
  return hasFlag(args, name);
}

/** Publish job summaries from `wk eval report` under Actions (or with --github-summary). */
export function shouldPublishGithubSummary(
  args: string[],
  env: NodeJS.ProcessEnv = process.env
): boolean {
  if (hasEddFlag(args, '--no-github-summary')) return false;
  if (hasEddFlag(args, '--github-summary')) return true;
  // Avoid polluting the real Actions summary while node:test is running in CI.
  if (env.NODE_TEST_CONTEXT) return false;
  return env.GITHUB_ACTIONS === 'true' && Boolean(env.GITHUB_STEP_SUMMARY);
}

export function getEddNumberFlag(args: string[], name: string, fallback: number): number {
  const raw = getEddFlag(args, name);
  if (raw === undefined) return fallback;
  const n = Number(raw);
  if (Number.isNaN(n)) throw new Error(`Invalid number for ${name}: ${raw}`);
  return n;
}

export function defaultEddSuite(repoDir: string): string {
  return path.join(repoDir, 'evals', 'edd', 'architecture_routing.yaml');
}

export function resolveEddSuite(repoDir: string, args: string[]): string {
  return path.resolve(process.cwd(), getEddFlag(args, '--suite') ?? defaultEddSuite(repoDir));
}

export function eddWatchTargets(repoDir: string, args: string[]): string[] {
  const suite = resolveEddSuite(repoDir, args);
  return [
    suite,
    getEddFlag(args, '--target'),
    path.join(repoDir, 'evals', 'edd'),
    path.dirname(suite)
  ].filter((t): t is string => Boolean(t));
}

function rejectRemovedEddFlags(args: string[]): void {
  const pairs: Array<{ flags: string[]; message: string }> = [
    {
      flags: ['--agent', '--judge'],
      message: '--agent and --judge are removed. Pass --style local|http|cli once.'
    },
    {
      flags: ['--agent-cli', '--agentCli', '--judge-cli', '--judgeCli'],
      message: '--agent-cli / --judge-cli are removed. Pass --cli once for agent and judge.'
    },
    {
      flags: ['--judge-model', '--judgeModel'],
      message: '--judge-model is removed. Agent and judge share --model (one model per run).'
    },
    {
      flags: ['--agent-stdout', '--judge-stdout'],
      message: '--agent-stdout / --judge-stdout are removed. Pass --cli-stdout.'
    }
  ];
  for (const { flags, message } of pairs) {
    if (flags.some((flag) => hasEddFlag(args, flag))) {
      throw new Error(message);
    }
  }
}

function createRunner(repoDir: string, args: string[]): EvalRunner {
  rejectRemovedEddFlags(args);
  const model = getEddFlag(args, '--model') ?? process.env.KIT_EVAL_MODEL ?? 'scripted';
  const tagsRaw = getEddFlag(args, '--tags');
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : undefined;
  const systemPromptPath =
    getEddFlag(args, '--system-prompt') ?? path.join(repoDir, 'evals', 'edd', 'system_prompt.md');
  const baseUrl =
    getEddFlag(args, '--base-url') ?? process.env.KIT_EVAL_BASE_URL ?? process.env.OPENAI_BASE_URL;
  const apiKeyFromEnv =
    getEddFlag(args, '--api-key') ??
    process.env.KIT_EVAL_API_KEY ??
    process.env.OPENAI_API_KEY ??
    process.env.ANTHROPIC_API_KEY;
  const run = resolveEvalRun({
    style: getEddFlag(args, '--style'),
    model,
    apiKey: apiKeyFromEnv,
    baseUrl,
    cli: getEddFlag(args, '--cli')
  });
  const cliStdout = hasEddFlag(args, '--cli-stdout') || process.env.KIT_EVAL_CLI_STDOUT === '1';
  const onStdout = cliStdout
    ? (chunk: string) => {
        process.stderr.write(chunk);
      }
    : undefined;
  const driver = resolveCliAgentDriver({
    style: run.style,
    cli: run.cli,
    model: run.model,
    onStdout
  });
  const complete = resolveJudgeCompletion({
    style: run.style,
    cli: run.cli,
    model: run.model,
    apiKey: apiKeyFromEnv,
    baseUrl,
    onStdout
  });
  const judgeBackend = judgeBackendForStyle(run.style);
  const apiKey = resolveJudgeApiKey(apiKeyFromEnv, baseUrl, judgeBackend);
  return new EvalRunner({
    model: run.model,
    style: run.style,
    driver,
    tags,
    systemPromptPath: fs.existsSync(systemPromptPath) ? systemPromptPath : undefined,
    apiKey,
    baseUrl,
    judgeBackend,
    complete
  });
}

async function cmdRun(repoDir: string, args: string[]): Promise<number> {
  const suite = resolveEddSuite(repoDir, args);
  const runner = createRunner(repoDir, args);
  const report = await runner.runSuite(suite);
  const out = getEddFlag(args, '--out');
  if (out) {
    const outDir = path.resolve(process.cwd(), out);
    const format = (getEddFlag(args, '--format') as 'md' | 'json' | undefined) ?? 'md';
    const written = [
      ...runner.writeReports(format, outDir),
      ...(format === 'md' ? runner.writeReports('json', outDir) : [])
    ];
    console.log(`Wrote report(s): ${written.join(', ')}`);
  }
  return report.failed > 0 ? 1 : 0;
}

async function cmdWatch(repoDir: string, args: string[]): Promise<number> {
  const suite = resolveEddSuite(repoDir, args);
  const model = getEddFlag(args, '--model') ?? 'scripted';
  const targets = eddWatchTargets(repoDir, args);

  const runOnce = async (reason: string) => {
    console.log(`\n[edd watch] re-run (${reason}) model=${model}`);
    const runner = createRunner(repoDir, args);
    try {
      await runner.runSuite(suite);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[edd watch] suite error: ${msg}`);
    }
  };

  await runOnce('initial');
  console.log(`[edd watch] watching: ${targets.join(', ')} (Ctrl+C to stop)`);
  watchTargets({
    targets,
    onChange: async (file) => {
      await runOnce(file);
    }
  });

  await new Promise(() => {
    /* run until interrupted */
  });
  return 0;
}

async function cmdReport(repoDir: string, args: string[]): Promise<number> {
  const format = (getEddFlag(args, '--format') as 'md' | 'json' | undefined) ?? 'md';
  const outDir = path.resolve(process.cwd(), getEddFlag(args, '--out') ?? 'out/reports');
  const fromPath = getEddFlag(args, '--from');

  let reports: SuiteReport[];
  if (fromPath) {
    const abs = path.resolve(process.cwd(), fromPath);
    const raw = JSON.parse(fs.readFileSync(abs, 'utf8')) as SuiteReport | SuiteReport[];
    reports = Array.isArray(raw) ? raw : [raw];
  } else {
    const runner = createRunner(repoDir, args);
    reports = await runner.runSuites([resolveEddSuite(repoDir, args)]);
  }

  const written = generateReport(reports, { format, outDir });
  console.log(`Wrote Markdown/JSON evaluation report(s):\n${written.map((w) => `  - ${w}`).join('\n')}`);

  if (format === 'md' && shouldPublishGithubSummary(args)) {
    const mdPath = written.find((p) => p.endsWith('eval-report.md') || p.endsWith('edd-report.md'));
    if (mdPath && fs.existsSync(mdPath)) {
      const published = publishEvalReportToGithubSummary(reports, fs.readFileSync(mdPath, 'utf8'));
      if (published) {
        console.log('Published EDD report to GitHub Actions job summary');
      } else if (hasEddFlag(args, '--github-summary')) {
        console.warn('GITHUB_STEP_SUMMARY is unset; skipped job summary publish');
      }
    }
  }
  return 0;
}

async function cmdCi(repoDir: string, args: string[]): Promise<number> {
  const suite = resolveEddSuite(repoDir, args);
  const threshold = getEddNumberFlag(args, '--threshold-routing', 95);
  const outDir = path.resolve(process.cwd(), getEddFlag(args, '--out') ?? 'out/reports');
  const runner = createRunner(repoDir, args);
  const report = await runner.runSuite(suite);
  const written = runner.writeReports('md', outDir);
  runner.writeReports('json', outDir);
  console.log(`CI artifacts: ${written.join(', ')}`);
  console.log(`Routing accuracy: ${report.routingAccuracy.toFixed(1)}% (threshold ${threshold}%)`);

  if (report.routingAccuracy < threshold) {
    console.error(
      `EDD CI gate failed: routing accuracy ${report.routingAccuracy.toFixed(1)}% < ${threshold}%`
    );
    return 1;
  }
  if (report.failed > 0) {
    console.error(`EDD CI gate failed: ${report.failed} case(s) failed`);
    return 1;
  }
  console.log('EDD CI gate passed');
  return 0;
}

async function readJsonlRows(filePath: string): Promise<Array<{ line: number; raw: unknown }>> {
  const absolute = path.resolve(filePath);
  const stream = fs.createReadStream(absolute, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  const rows: Array<{ line: number; raw: unknown }> = [];
  let lineNo = 0;
  for await (const line of rl) {
    lineNo += 1;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    rows.push({ line: lineNo, raw: JSON.parse(trimmed) });
  }
  return rows;
}

function writeJsonl(filePath: string, cases: EvalCase[]): void {
  const abs = path.resolve(filePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, cases.map((c) => JSON.stringify(c)).join('\n') + '\n', 'utf8');
}

/** Deterministic [0,1) RNG from a 32-bit seed (mulberry32). */
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

async function cmdShadow(_repoDir: string, args: string[]): Promise<number> {
  const infile = getEddFlag(args, '--infile');
  if (!infile) {
    console.error('shadow requires --infile <jsonl>');
    printEddHelp();
    return 1;
  }
  const sample = getEddNumberFlag(args, '--sample', 0.05);
  if (sample < 0 || sample > 1) {
    console.error(`Invalid --sample ${sample}; expected 0..1`);
    return 1;
  }
  const out = getEddFlag(args, '--out');
  const seedRaw = getEddFlag(args, '--seed');
  const rand = seedRaw !== undefined ? mulberry32(Number(seedRaw)) : Math.random;

  const rows = await readJsonlRows(infile);
  const turns = rows.map((r) => normalizeProdTurn(r.raw));
  const { results, fails, sampled, failed } = shadowEvalTurns(turns, { sampleRate: sample, rand });

  if (out && fails.length) {
    const abs = path.resolve(out);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.appendFileSync(abs, fails.map((c) => JSON.stringify(c)).join('\n') + '\n', 'utf8');
    console.log(`shadow: appended ${fails.length} fail(s) -> ${abs}`);
  }

  console.log(
    `shadow: turns=${turns.length} sampled=${sampled} failed=${failed} sampleRate=${sample}`
  );
  for (const r of results.filter((x) => x.sampled && x.passed === false)) {
    console.log(`  FAIL ${r.id}: ${r.reasoning ?? 'judge failed'}`);
  }
  return failed > 0 ? 1 : 0;
}

async function cmdDataset(_repoDir: string, args: string[]): Promise<number> {
  const action = args[0];
  const rest = args.slice(1);
  if (!action || action === 'help' || action === '--help') {
    printEddHelp();
    return action ? 0 : 1;
  }

  try {
    if (action === 'lint') {
      const dataset = getEddFlag(rest, '--dataset');
      if (!dataset) throw new Error('dataset lint requires --dataset <jsonl>');
      const rows = await readJsonlRows(dataset);
      const issues = lintCases(rows);
      if (!issues.length) {
        console.log(`dataset lint: ok (${rows.length} cases)`);
        return 0;
      }
      for (const issue of issues) {
        console.error(`line ${issue.line}${issue.id ? ` id=${issue.id}` : ''}: ${issue.message}`);
      }
      return 1;
    }

    if (action === 'dedupe') {
      const dataset = getEddFlag(rest, '--dataset');
      if (!dataset) throw new Error('dataset dedupe requires --dataset <jsonl>');
      const cases = await loadDataset(dataset);
      const { kept, removed } = dedupeCases(cases);
      const out = getEddFlag(rest, '--out') ?? dataset;
      writeJsonl(out, kept);
      console.log(`dataset dedupe: kept ${kept.length}, removed ${removed.length} -> ${out}`);
      return 0;
    }

    if (action === 'synthesize') {
      const dataset = getEddFlag(rest, '--dataset');
      const count = getEddNumberFlag(rest, '--count', 1);
      if (!dataset) throw new Error('dataset synthesize requires --dataset <jsonl>');
      const seeds = await loadDataset(dataset);
      const generated = synthesizeFromSeeds(seeds, count);
      const out = getEddFlag(rest, '--out');
      if (!out) throw new Error('dataset synthesize requires --out <jsonl>');
      writeJsonl(out, generated);
      console.log(`dataset synthesize: wrote ${generated.length} paraphrases -> ${out}`);
      return 0;
    }

    if (action === 'from-trace') {
      const tracePath = getEddFlag(rest, '--trace');
      if (!tracePath) throw new Error('dataset from-trace requires --trace <json>');
      const raw = JSON.parse(fs.readFileSync(path.resolve(tracePath), 'utf8')) as unknown;
      const row = casesFromTraceFile(raw);
      const out = getEddFlag(rest, '--out');
      if (out) {
        const abs = path.resolve(out);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.appendFileSync(abs, `${JSON.stringify(row)}\n`, 'utf8');
        console.log(`dataset from-trace: appended ${row.id} -> ${abs}`);
      } else {
        console.log(JSON.stringify(row));
      }
      return 0;
    }

    console.error(`Unknown dataset action: ${action}`);
    printEddHelp();
    return 1;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`dataset ${action}: ${msg}`);
    return 1;
  }
}

/**
 * Handle `wk eval …` when a subcommand is present.
 * Returns null when the caller should fall back to the legacy trigger harness.
 */
export async function handleEddEvalCli(options: EddCliOptions): Promise<number | null> {
  const { repoDir, args } = options;
  const sub = args[0];

  if (!sub || sub.startsWith('--')) {
    return null;
  }

  if (sub === 'help' || sub === '--help' || sub === '-h') {
    printEddHelp();
    return 0;
  }

  const rest = args.slice(1);
  switch (sub) {
    case 'run':
      return cmdRun(repoDir, rest);
    case 'watch':
      return cmdWatch(repoDir, rest);
    case 'report':
      return cmdReport(repoDir, rest);
    case 'ci':
      return cmdCi(repoDir, rest);
    case 'dataset':
      return cmdDataset(repoDir, rest);
    case 'shadow':
      return cmdShadow(repoDir, rest);
    case 'miss-rate': {
      const cmp = compareMissRates(repoDir);
      console.log(formatMissRateCompare(cmp, { color: cliOutcomeShouldColor() }));
      return cliOutcomeExit(missRateOutcome(cmp).outcome);
    }
    default:
      if (sub.endsWith('.yaml') || sub.endsWith('.yml') || sub === 'all') {
        return null;
      }
      console.error(`Unknown eval subcommand: ${sub}`);
      printEddHelp();
      return 1;
  }
}
