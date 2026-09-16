import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

export const QUALITY_LOOP_CATALOG_REL = 'lists/quality-loop-automations.yaml';

export const LOOP_REPOS = ['none', 'single', 'environment'] as const;
export type LoopRepo = (typeof LOOP_REPOS)[number];

export type QualityLoopDashboard = {
  automations: string;
  agents: string;
  integrations: string;
  mcp: readonly string[];
};

export type QualityLoopAutomation = {
  id: string;
  name: string;
  trigger: string;
  repo: LoopRepo;
  mcp: readonly string[];
  opensPr: boolean;
  promptHeading: string;
};

export type QualityLoopCatalog = {
  dashboard: QualityLoopDashboard;
  promptPrefixHeading: string;
  automations: readonly QualityLoopAutomation[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stringField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`quality-loop catalog ${key} must be a non-empty string`);
  }
  return value;
}

function stringList(value: unknown, key: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`quality-loop catalog ${key} must be a string list`);
  }
  return value;
}

function isLoopRepo(value: string): value is LoopRepo {
  return (LOOP_REPOS as readonly string[]).includes(value);
}

function parseAutomation(value: unknown, index: number): QualityLoopAutomation {
  if (!isRecord(value)) {
    throw new Error(`quality-loop catalog automations[${index}] must be a mapping`);
  }
  const repo = stringField(value, 'repo');
  if (!isLoopRepo(repo)) {
    throw new Error(`quality-loop catalog automations[${index}].repo must be none|single|environment`);
  }
  if (typeof value.opens_pr !== 'boolean') {
    throw new Error(`quality-loop catalog automations[${index}].opens_pr must be a boolean`);
  }
  return {
    id: stringField(value, 'id'),
    name: stringField(value, 'name'),
    trigger: stringField(value, 'trigger'),
    repo,
    mcp: stringList(value.mcp, `automations[${index}].mcp`),
    opensPr: value.opens_pr,
    promptHeading: stringField(value, 'prompt_heading')
  };
}

export function parseQualityLoopCatalog(raw: string): QualityLoopCatalog {
  const parsed = parseYaml(raw);
  if (!isRecord(parsed)) {
    throw new Error('quality-loop catalog must be a mapping');
  }
  if (!isRecord(parsed.dashboard)) {
    throw new Error('quality-loop catalog dashboard must be a mapping');
  }
  const automations = parsed.automations;
  if (!Array.isArray(automations) || automations.length === 0) {
    throw new Error('quality-loop catalog automations must be a non-empty list');
  }
  return {
    dashboard: {
      automations: stringField(parsed.dashboard, 'automations'),
      agents: stringField(parsed.dashboard, 'agents'),
      integrations: stringField(parsed.dashboard, 'integrations'),
      mcp: stringList(parsed.dashboard.mcp, 'dashboard.mcp')
    },
    promptPrefixHeading: stringField(parsed, 'prompt_prefix_heading'),
    automations: automations.map((item, index) => parseAutomation(item, index))
  };
}

export function extractPromptSections(markdown: string): Map<string, string> {
  const sections = new Map<string, string>();
  const blocks = markdown.split(/^## /m).slice(1);
  for (const block of blocks) {
    const newline = block.indexOf('\n');
    const heading = (newline === -1 ? block : block.slice(0, newline)).trim();
    const fence = block.match(/```text\n([\s\S]*?)\n```/);
    if (!heading || !fence?.[1]) continue;
    sections.set(heading, fence[1].trim());
  }
  return sections;
}

export function loadQualityLoopCatalog(kitRoot: string): QualityLoopCatalog {
  const filePath = path.join(kitRoot, QUALITY_LOOP_CATALOG_REL);
  return parseQualityLoopCatalog(fs.readFileSync(filePath, 'utf8'));
}

export function loadPromptLibrary(kitRoot: string): Map<string, string> {
  return extractPromptSections(fs.readFileSync(path.join(kitRoot, 'templates/quality-loops.md'), 'utf8'));
}

export function promptFor(
  catalog: QualityLoopCatalog,
  prompts: Map<string, string>,
  heading: string
): string {
  const body = prompts.get(heading);
  if (!body) {
    throw new Error(`missing quality-loop prompt: ${heading}`);
  }
  return body;
}

export function automationPrompt(
  catalog: QualityLoopCatalog,
  prompts: Map<string, string>,
  item: QualityLoopAutomation
): string {
  const prefix = promptFor(catalog, prompts, catalog.promptPrefixHeading);
  const body = promptFor(catalog, prompts, item.promptHeading);
  return `${prefix}\n\n${body}`;
}
