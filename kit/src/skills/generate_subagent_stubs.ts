import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { splitYamlFrontmatter } from '../shared/yaml_frontmatter.js';
import {
  listGenerateSubagents,
  loadSubagentAllowlist,
  type SubagentAllowlistCatalog
} from './verify_subagent_allowlist.js';

export const AGENTS_DIR_REL = 'agents';
export const SUBAGENT_STUB_LINE_BUDGET = 40;

export interface RenderSubagentStubInput {
  name: string;
  description: string;
  readonly: boolean;
  sameSessionTdd: boolean;
}

function countLines(text: string): number {
  if (text.length === 0) return 0;
  const parts = text.split('\n');
  return text.endsWith('\n') ? parts.length - 1 : parts.length;
}

export function parseSkillDescription(skillMd: string): string {
  const split = splitYamlFrontmatter(skillMd);
  if (!split) {
    throw new Error('SKILL.md is missing YAML frontmatter');
  }
  const parsed = parseYaml(split.yaml);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('SKILL.md frontmatter must be a mapping');
  }
  const description = (parsed as { description?: unknown }).description;
  if (typeof description !== 'string' || description.trim() === '') {
    throw new Error('SKILL.md description must be a non-empty string');
  }
  return description.replace(/\s+/g, ' ').trim();
}

export function renderSubagentStub(input: RenderSubagentStubInput): string {
  const tdd = input.sameSessionTdd
    ? [
        '',
        'Gear 1 (domain + mocked ports) and gear 2 (thin adapter) stay in this **same session**. Do not split gear 1 and gear 2. `agent-adapter` is an escape hatch only when gear 2 is too large.'
      ]
    : [];
  const body = [
    `You are the Waykit \`${input.name}\` specialist in an isolated host subagent.`,
    '',
    `Load the playbook at \`skills/${input.name}/SKILL.md\` (or \`~/.agents/skills/${input.name}/SKILL.md\`). Prefer kit-knowledge for SOP slices. Do not bulk-read CODING_PHILOSOPHY.md and do not paste SOP or philosophy text into this file.`,
    '',
    `Resolve the model class with \`wk model resolve --skill ${input.name}\`. Keep \`model: inherit\` unless the parent passes a catalog slug. Do not hardcode vendor model ids.`,
    '',
    'The parent must pass: Linear id if any, relevant handover paths, Definition of Done, and Next agent. Write COMPLETE or BLOCKED to the handover. Return a short summary only.',
    ...tdd,
    ''
  ].join('\n');
  return [
    '---',
    `name: ${input.name}`,
    `description: ${JSON.stringify(input.description)}`,
    'model: inherit',
    `readonly: ${input.readonly}`,
    '---',
    '',
    body
  ].join('\n');
}

function stubPath(repoDir: string, name: string): string {
  return path.join(repoDir, AGENTS_DIR_REL, `${name}.md`);
}

function skillPath(repoDir: string, name: string): string {
  return path.join(repoDir, 'skills', name, 'SKILL.md');
}

export function expectedSubagentStubs(repoDir: string, catalog?: SubagentAllowlistCatalog): Map<string, string> {
  const loaded = catalog ?? loadSubagentAllowlist(repoDir);
  const out = new Map<string, string>();
  for (const name of listGenerateSubagents(loaded)) {
    const skillMd = fs.readFileSync(skillPath(repoDir, name), 'utf8');
    const entry = loaded.roles[name];
    out.set(
      `${name}.md`,
      renderSubagentStub({
        name,
        description: parseSkillDescription(skillMd),
        readonly: entry?.readonly === true,
        sameSessionTdd: name === loaded.tdd.skill
      })
    );
  }
  return out;
}

export function generateSubagentStubs(repoDir: string): string[] {
  const dir = path.join(repoDir, AGENTS_DIR_REL);
  fs.mkdirSync(dir, { recursive: true });
  const expected = expectedSubagentStubs(repoDir);
  for (const [file, body] of expected) {
    fs.writeFileSync(path.join(dir, file), body);
  }
  return [...expected.keys()];
}

export interface SubagentStubVerifyResult {
  ok: boolean;
  errors: string[];
}

export function verifySubagentStubs(repoDir: string): SubagentStubVerifyResult {
  const errors: string[] = [];
  let expected: Map<string, string>;
  try {
    expected = expectedSubagentStubs(repoDir);
  } catch (err) {
    return { ok: false, errors: [err instanceof Error ? err.message : String(err)] };
  }

  const dir = path.join(repoDir, AGENTS_DIR_REL);
  if (!fs.existsSync(dir)) {
    return { ok: false, errors: [`Missing ${AGENTS_DIR_REL}/ (run wk agents generate)`] };
  }

  const onDisk = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort();
  for (const file of onDisk) {
    if (!expected.has(file)) {
      errors.push(`Unexpected agent stub ${AGENTS_DIR_REL}/${file}`);
    }
  }
  for (const [file, body] of expected) {
    const full = path.join(dir, file);
    if (!fs.existsSync(full)) {
      errors.push(`Missing ${AGENTS_DIR_REL}/${file} (run wk agents generate)`);
      continue;
    }
    const actual = fs.readFileSync(full, 'utf8');
    const lines = countLines(actual);
    if (lines > SUBAGENT_STUB_LINE_BUDGET) {
      errors.push(`${AGENTS_DIR_REL}/${file} exceeds stub line budget (${lines} > ${SUBAGENT_STUB_LINE_BUDGET})`);
    }
    if (actual !== body) {
      errors.push(`${AGENTS_DIR_REL}/${file} is stale (run wk agents generate)`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function printSubagentStubResult(result: SubagentStubVerifyResult): void {
  if (!result.ok) {
    for (const msg of result.errors) {
      console.error(`ERROR: ${msg}`);
    }
    console.error('');
    console.error('Subagent stub check FAILED. See agents/ and wk agents generate.');
    return;
  }
  console.log('OK: host subagent stubs match the allowlist and stay under the line budget');
}
