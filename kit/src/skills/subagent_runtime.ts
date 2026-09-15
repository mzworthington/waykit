import os from 'node:os';
import path from 'node:path';
import { resolveModel } from '../models/catalog.js';
import { userSubagentInstallDirs } from './install_subagent_stubs.js';
import { formatCliOutcome } from '../cli/outcome.js';
import {
  compareMissRates,
  freezeExpandKillLine,
  missRateOutcome,
  type MissRateCompare
} from '../edd/miss_rate.js';
import { sortedLocale } from '../shared/locale_sort.js';
import {
  listGenerateSubagents,
  loadSubagentAllowlist,
  resolveSkillsOnlyMode
} from './verify_subagent_allowlist.js';

export interface SubagentStatus {
  skillsOnly: boolean;
  catalogSkillsOnly: boolean;
  envRaw: string | null;
  generate: string[];
  installDirs: string[];
  expandKill: string;
  expandKillIndicator: string;
  missRate: MissRateCompare;
}

export interface LaunchPromptInput {
  skill: string;
  project: string;
  linearId?: string;
  handoverPaths: string[];
  definitionOfDone?: string;
  nextAgent?: string;
  modelClass?: string;
  modelSlug?: string;
  readonly: boolean;
}

export function subagentStatus(opts: {
  repoDir: string;
  env?: NodeJS.ProcessEnv;
  homedir?: string;
}): SubagentStatus {
  const catalog = loadSubagentAllowlist(opts.repoDir);
  const env = opts.env ?? process.env;
  const raw = env.WK_SUBAGENTS?.trim() || null;
  const missRate = compareMissRates(opts.repoDir);
  return {
    catalogSkillsOnly: catalog.skillsOnly,
    skillsOnly: resolveSkillsOnlyMode({ catalogSkillsOnly: catalog.skillsOnly, env }),
    envRaw: raw,
    generate: sortedLocale(listGenerateSubagents(catalog)),
    installDirs: userSubagentInstallDirs(opts.homedir ?? os.homedir()),
    expandKill: freezeExpandKillLine(missRate, catalog.expandKill.trim()),
    expandKillIndicator: catalog.expandKillIndicator.trim(),
    missRate
  };
}

export function formatSubagentStatus(status: SubagentStatus, opts?: { color?: boolean }): string {
  const mode = status.skillsOnly ? 'skills-only' : 'launch';
  const envLine = status.envRaw === null ? 'unset (follow catalog)' : status.envRaw;
  const miss = missRateOutcome(status.missRate);
  const summary = `${mode}, ${miss.summary}`;
  return [
    formatCliOutcome(miss.outcome, 'agents status', summary, { color: opts?.color }),
    `mode: ${mode}`,
    `catalog.skillsOnly: ${status.catalogSkillsOnly}`,
    `WK_SUBAGENTS: ${envLine}`,
    `generate: ${status.generate.join(', ')}`,
    `install: ${status.installDirs.join(', ')}`,
    `expand-kill: ${status.expandKill}`,
    `expand-kill-indicator: ${status.expandKillIndicator}`,
    `miss-rate: ${status.missRate.verdict}`,
    `miss-rate-specialist: ${status.missRate.specialist.enough ? `${(status.missRate.specialist.rate! * 100).toFixed(1)}%` : 'not-enough'}`,
    `miss-rate-skill-picker: ${status.missRate.picker.enough ? `${(status.missRate.picker.rate! * 100).toFixed(1)}%` : 'not-enough'}`,
    'prompt: wk agents launch-prompt --skill <id> --project <name>'
  ].join('\n');
}

export function renderLaunchPrompt(input: LaunchPromptInput): string {
  const linear = input.linearId?.trim() || 'none';
  const paths =
    input.handoverPaths.length > 0
      ? input.handoverPaths.join(', ')
      : `~/.agents/handover/${input.project}/`;
  const dod = input.definitionOfDone?.trim() || 'Phase Definition of Done from the matching SKILL.md';
  const next = input.nextAgent?.trim() || 'agent-orchestrator';
  const modelClass = input.modelClass ?? 'inherit';
  const slug = input.modelSlug ? ` (${input.modelSlug})` : '';
  return [
    `Launch Waykit specialist \`${input.skill}\` as a **host** subagent.`,
    '',
    '`launch_specialist` is an **eval adapter** only (`evals/edd/tools/launch_specialist.json`). Do not call that tool in Cursor or Claude. Open the stub as a Cursor Task or Claude agent.',
    '',
    `Stub: ~/.cursor/agents/${input.skill}.md (Claude: ~/.claude/agents/${input.skill}.md)`,
    `Model class: ${modelClass}${slug}. Resolve with \`wk model resolve --skill ${input.skill}\`. Do not hardcode vendor ids.`,
    `Readonly: ${input.readonly}`,
    '',
    'Parent must pass:',
    `- Linear id: ${linear}`,
    `- Handover paths: ${paths}`,
    `- Definition of Done: ${dod}`,
    `- Next agent: ${next}`,
    '',
    `Load \`skills/${input.skill}/SKILL.md\` in the child. Do not paste SKILL.md into this prompt.`,
    'Write COMPLETE or BLOCKED to the handover on disk. Return a short summary only. The parent reads disk, not the chat summary.'
  ].join('\n');
}

export function buildLaunchPrompt(opts: {
  repoDir: string;
  skill: string;
  project: string;
  linearId?: string;
  handoverPaths: string[];
  definitionOfDone?: string;
  nextAgent?: string;
  host?: string;
}): string {
  const catalog = loadSubagentAllowlist(opts.repoDir);
  const entry = catalog.roles[opts.skill];
  if (entry?.runtime !== 'subagent') {
    throw new Error(`${opts.skill} is not on the host-subagent generate list`);
  }
  let modelClass: string | undefined;
  let modelSlug: string | undefined;
  try {
    const resolved = resolveModel(opts.repoDir, { skill: opts.skill, host: opts.host ?? 'cursor' });
    modelClass = resolved.class;
    modelSlug = resolved.model;
  } catch {
    // Kit checkout without models/ is still a valid prompt.
  }
  return renderLaunchPrompt({
    skill: opts.skill,
    project: opts.project,
    linearId: opts.linearId,
    handoverPaths: opts.handoverPaths,
    definitionOfDone: opts.definitionOfDone,
    nextAgent: opts.nextAgent,
    modelClass,
    modelSlug,
    readonly: entry.readonly === true
  });
}

export function defaultProjectName(cwd: string): string {
  const base = path.basename(path.resolve(cwd));
  return base.length > 0 ? base : 'demo';
}
