import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { compareMissRates, FREEZE_GENERATE_MAX } from '../edd/miss_rate.js';
import { compareLocale, sortedLocale, sortLocaleInPlace } from '../shared/locale_sort.js';
import { KIT_SKILL_DIR_PREFIX } from './verify_skills_layout.js';

export const SUBAGENT_ALLOWLIST_REL = 'skills/subagents.yaml';
export const SUBAGENT_DOCS_REL = 'docs/subagents.md';
export const STAY_SKILL_PREFIXES = ['lang-', 'framework-', 'profile-'] as const;

export type SubagentRuntime = 'subagent' | 'skill' | 'parent';
export type SubagentBucket = 'isolation' | 'audit' | 'sequential';

export interface SubagentRoleEntry {
  runtime: SubagentRuntime;
  bucket?: SubagentBucket;
  readonly?: boolean;
}

export interface SubagentAllowlistCatalog {
  expandKill: string;
  /** How to measure the freeze: from-trace misses vs skill-picker routing. */
  expandKillIndicator: string;
  staySkillPrefixes: string[];
  /** Kit default. Session override: WK_SUBAGENTS=0 (skills-only) or WK_SUBAGENTS=1 (launch). */
  skillsOnly: boolean;
  tdd: { skill: string; gears: 'same-session'; escapeHatch: string };
  generate: {
    isolation: string[];
    audit: string[];
    sequential: string[];
    parent: string[];
  };
  roles: Record<string, SubagentRoleEntry>;
}

export interface SubagentAllowlistResult {
  ok: boolean;
  errors: string[];
  catalog: SubagentAllowlistCatalog | null;
  runtimeFor: (skill: string) => SubagentRuntime | null;
}

const GENERATE_BUCKETS = ['isolation', 'audit', 'sequential'] as const;

function listSkillDirs(repoDir: string): string[] {
  const skillsDir = path.join(repoDir, 'skills');
  if (!fs.existsSync(skillsDir)) return [];
  return fs
    .readdirSync(skillsDir)
    .filter((base) => KIT_SKILL_DIR_PREFIX.test(base))
    .filter((base) => fs.existsSync(path.join(skillsDir, base, 'SKILL.md')))
    .sort(compareLocale);
}

function asStringArray(raw: unknown, label: string): string[] {
  if (!Array.isArray(raw) || raw.some((item) => typeof item !== 'string')) {
    throw new Error(`${label} must be a string array`);
  }
  return raw as string[];
}

export function loadSubagentAllowlist(repoDir: string): SubagentAllowlistCatalog {
  const yamlPath = path.join(repoDir, SUBAGENT_ALLOWLIST_REL);
  if (!fs.existsSync(yamlPath)) {
    throw new Error(`Missing ${SUBAGENT_ALLOWLIST_REL}`);
  }
  return parseCatalog(parseYaml(fs.readFileSync(yamlPath, 'utf8')));
}

function parseCatalog(raw: unknown): SubagentAllowlistCatalog {
  if (!raw || typeof raw !== 'object') {
    throw new Error('subagents.yaml must be a mapping');
  }
  const doc = raw as Record<string, unknown>;
  if (typeof doc.expandKill !== 'string' || doc.expandKill.trim() === '') {
    throw new Error('expandKill must be a non-empty string');
  }
  if (typeof doc.expandKillIndicator !== 'string' || doc.expandKillIndicator.trim() === '') {
    throw new Error('expandKillIndicator must be a non-empty string');
  }
  if (!/from-trace/i.test(doc.expandKillIndicator)) {
    throw new Error('expandKillIndicator must name wk eval dataset from-trace');
  }
  const staySkillPrefixes = asStringArray(doc.staySkillPrefixes, 'staySkillPrefixes');
  const tddRaw = doc.tdd;
  if (!tddRaw || typeof tddRaw !== 'object') {
    throw new Error('tdd must be a mapping');
  }
  const tdd = tddRaw as Record<string, unknown>;
  if (typeof tdd.skill !== 'string' || typeof tdd.escapeHatch !== 'string') {
    throw new Error('tdd.skill and tdd.escapeHatch must be strings');
  }
  if (tdd.gears !== 'same-session') {
    throw new Error('tdd.gears must be same-session');
  }
  let skillsOnly = false;
  if (doc.skillsOnly !== undefined) {
    if (typeof doc.skillsOnly !== 'boolean') {
      throw new Error('skillsOnly must be a boolean');
    }
    skillsOnly = doc.skillsOnly;
  }
  const rolesRaw = doc.roles;
  if (!rolesRaw || typeof rolesRaw !== 'object') {
    throw new Error('roles must be a mapping');
  }
  const roles: Record<string, SubagentRoleEntry> = {};
  for (const [name, value] of Object.entries(rolesRaw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') {
      throw new Error(`roles.${name} must be a mapping`);
    }
    const entry = value as Record<string, unknown>;
    if (entry.runtime !== 'subagent' && entry.runtime !== 'skill' && entry.runtime !== 'parent') {
      throw new Error(`roles.${name}.runtime must be subagent, skill, or parent`);
    }
    const parsed: SubagentRoleEntry = { runtime: entry.runtime };
    if (entry.bucket !== undefined) {
      if (!GENERATE_BUCKETS.includes(entry.bucket as (typeof GENERATE_BUCKETS)[number])) {
        throw new Error(`roles.${name}.bucket must be isolation, audit, or sequential`);
      }
      parsed.bucket = entry.bucket as SubagentBucket;
    }
    if (entry.readonly !== undefined) {
      if (typeof entry.readonly !== 'boolean') {
        throw new Error(`roles.${name}.readonly must be a boolean`);
      }
      parsed.readonly = entry.readonly;
    }
    roles[name] = parsed;
  }
  const generate = deriveGenerate(roles);
  if (doc.generate !== undefined) {
    if (!doc.generate || typeof doc.generate !== 'object') {
      throw new Error('generate must be a mapping when set');
    }
    const generateIn = doc.generate as Record<string, unknown>;
    const listed = {
      isolation: asStringArray(generateIn.isolation, 'generate.isolation'),
      audit: asStringArray(generateIn.audit, 'generate.audit'),
      sequential: asStringArray(generateIn.sequential, 'generate.sequential'),
      parent: asStringArray(generateIn.parent, 'generate.parent')
    };
    if (!sameGenerate(listed, generate)) {
      throw new Error(
        'generate isolation+audit+sequential+parent must match roles (or omit generate and let it derive)'
      );
    }
  }
  return {
    expandKill: doc.expandKill,
    expandKillIndicator: doc.expandKillIndicator,
    staySkillPrefixes,
    skillsOnly,
    tdd: {
      skill: tdd.skill,
      gears: 'same-session',
      escapeHatch: tdd.escapeHatch
    },
    generate,
    roles
  };
}

export function deriveGenerate(
  roles: Record<string, SubagentRoleEntry>
): SubagentAllowlistCatalog['generate'] {
  const isolation: string[] = [];
  const audit: string[] = [];
  const sequential: string[] = [];
  const parent: string[] = [];
  for (const [name, entry] of Object.entries(roles)) {
    if (entry.runtime === 'parent') parent.push(name);
    if (entry.runtime !== 'subagent') continue;
    if (entry.bucket === 'isolation') isolation.push(name);
    else if (entry.bucket === 'audit') audit.push(name);
    else if (entry.bucket === 'sequential') sequential.push(name);
  }
  sortLocaleInPlace(isolation);
  sortLocaleInPlace(audit);
  sortLocaleInPlace(sequential);
  sortLocaleInPlace(parent);
  return { isolation, audit, sequential, parent };
}

function sameGenerate(
  a: SubagentAllowlistCatalog['generate'],
  b: SubagentAllowlistCatalog['generate']
): boolean {
  const key = (g: SubagentAllowlistCatalog['generate']) =>
    [...g.isolation].sort(compareLocale).join(',') +
    '|' +
    [...g.audit].sort(compareLocale).join(',') +
    '|' +
    [...g.sequential].sort(compareLocale).join(',') +
    '|' +
    [...g.parent].sort(compareLocale).join(',');
  return key(a) === key(b);
}

function prefixStay(name: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => name.startsWith(prefix));
}

/**
 * Session override for whether the parent launches host subagents.
 * `WK_SUBAGENTS=0` (also off/false/skills) stays in the parent.
 * `WK_SUBAGENTS=1` (also on/true/launch) launches. Unset follows the catalog.
 */
export function resolveSkillsOnlyMode(opts: {
  catalogSkillsOnly: boolean;
  env?: NodeJS.ProcessEnv;
}): boolean {
  const raw = (opts.env ?? process.env).WK_SUBAGENTS?.trim().toLowerCase();
  if (raw === '0' || raw === 'off' || raw === 'false' || raw === 'skills' || raw === 'skills-only') {
    return true;
  }
  if (raw === '1' || raw === 'on' || raw === 'true' || raw === 'launch' || raw === 'subagents') {
    return false;
  }
  return opts.catalogSkillsOnly;
}

export function listGenerateSubagents(catalog: SubagentAllowlistCatalog | null): string[] {
  if (!catalog) return [];
  return Object.entries(catalog.roles)
    .filter(([, entry]) => entry.runtime === 'subagent')
    .map(([name]) => name);
}

export function verifySubagentAllowlist(repoDir: string): SubagentAllowlistResult {
  const errors: string[] = [];
  const yamlPath = path.join(repoDir, SUBAGENT_ALLOWLIST_REL);
  const docsPath = path.join(repoDir, SUBAGENT_DOCS_REL);
  let catalog: SubagentAllowlistCatalog | null = null;

  const runtimeFor = (skill: string): SubagentRuntime | null => {
    if (catalog && prefixStay(skill, catalog.staySkillPrefixes)) return 'skill';
    return catalog?.roles[skill]?.runtime ?? null;
  };

  if (!fs.existsSync(yamlPath)) {
    return { ok: false, errors: [`Missing ${SUBAGENT_ALLOWLIST_REL}`], catalog: null, runtimeFor };
  }

  try {
    catalog = parseCatalog(parseYaml(fs.readFileSync(yamlPath, 'utf8')));
  } catch (err) {
    return {
      ok: false,
      errors: [err instanceof Error ? err.message : String(err)],
      catalog: null,
      runtimeFor
    };
  }

  if (!/skill picker/i.test(catalog.expandKill)) {
    errors.push('expandKill must name the skill picker freeze');
  }

  for (const prefix of STAY_SKILL_PREFIXES) {
    if (!catalog.staySkillPrefixes.includes(prefix)) {
      errors.push(`staySkillPrefixes must include ${prefix}`);
    }
  }

  const skills = listSkillDirs(repoDir);
  for (const name of skills) {
    if (prefixStay(name, catalog.staySkillPrefixes)) {
      const listed = catalog.roles[name];
      if (listed && listed.runtime !== 'skill') {
        errors.push(`${name} is a stack profile and must stay a skill, not ${listed.runtime}`);
      }
      continue;
    }
    if (!catalog.roles[name]) {
      errors.push(`Unclassified kit skill: ${name}`);
    }
  }

  const tdd = catalog.roles[catalog.tdd.skill];
  if (tdd?.runtime !== 'subagent' || tdd.bucket !== 'sequential') {
    errors.push(`${catalog.tdd.skill} must be a sequential subagent with gears same-session`);
  }
  const hatch = catalog.roles[catalog.tdd.escapeHatch];
  if (hatch?.runtime !== 'skill') {
    errors.push(`${catalog.tdd.escapeHatch} must stay a skill (TDD escape hatch, not a second TDD agent)`);
  }

  const expectedSub = [
    ...catalog.generate.isolation,
    ...catalog.generate.audit,
    ...catalog.generate.sequential
  ].sort(compareLocale);
  const actualSub = sortedLocale(listGenerateSubagents(catalog));
  if (expectedSub.join(',') !== actualSub.join(',')) {
    errors.push(
      `generate isolation+audit+sequential must match roles with runtime subagent (expected ${expectedSub.join(', ')})`
    );
  }

  for (const name of catalog.generate.isolation) {
    const entry = catalog.roles[name];
    if (entry?.runtime !== 'subagent' || entry.bucket !== 'isolation') {
      errors.push(`${name} must be isolation subagent`);
    }
  }
  for (const name of catalog.generate.audit) {
    const entry = catalog.roles[name];
    if (entry?.runtime !== 'subagent' || entry.bucket !== 'audit' || entry.readonly !== true) {
      errors.push(`${name} must be a readonly audit subagent`);
    }
  }
  for (const name of catalog.generate.sequential) {
    const entry = catalog.roles[name];
    if (entry?.runtime !== 'subagent' || entry.bucket !== 'sequential') {
      errors.push(`${name} must be a sequential subagent`);
    }
  }
  if (catalog.generate.parent.join(',') !== 'agent-orchestrator') {
    errors.push('generate.parent must be agent-orchestrator only');
  }
  if (catalog.roles['agent-orchestrator']?.runtime !== 'parent') {
    errors.push('agent-orchestrator must be runtime parent, not a generated specialist');
  }

  if (!fs.existsSync(docsPath)) {
    errors.push(`Missing ${SUBAGENT_DOCS_REL}`);
  } else {
    const docs = fs.readFileSync(docsPath, 'utf8');
    for (const needle of ['isolation', 'audit', 'sequential', 'parent', 'skill picker']) {
      if (!docs.toLowerCase().includes(needle)) {
        errors.push(`${SUBAGENT_DOCS_REL} must mention ${needle}`);
      }
    }
    if (!/gear 1/i.test(docs) || !docs.includes('agent-adapter')) {
      errors.push(`${SUBAGENT_DOCS_REL} must keep TDD gear 1+2 in one agent and name agent-adapter`);
    }
    if (!/skills-only/i.test(docs) || !docs.includes('WK_SUBAGENTS')) {
      errors.push(`${SUBAGENT_DOCS_REL} must name skills-only mode and WK_SUBAGENTS`);
    }
    if (!docs.includes('launch-prompt') || !/eval adapter/i.test(docs)) {
      errors.push(`${SUBAGENT_DOCS_REL} must name wk agents launch-prompt and the eval adapter`);
    }
    if (!/wk eval miss-rate/i.test(docs)) {
      errors.push(`${SUBAGENT_DOCS_REL} must name wk eval miss-rate`);
    }
  }

  const miss = compareMissRates(repoDir);
  if (miss.verdict === 'freeze') {
    const generateCount = listGenerateSubagents(catalog).length;
    if (generateCount > FREEZE_GENERATE_MAX) {
      errors.push(
        `miss-rate freeze: generate list has ${generateCount} specialists (cap ${FREEZE_GENERATE_MAX}); do not add a role`
      );
    }
    if (miss.verdict === 'freeze' && /before adding roles/i.test(catalog.expandKill)) {
      errors.push('miss-rate freeze: expandKill still tells maintainers to add roles');
    }
    if (miss.verdict === 'freeze' && !/^Freeze /i.test(catalog.expandKill.trim())) {
      errors.push('miss-rate freeze: expandKill must start with Freeze');
    }
  }

  return { ok: errors.length === 0, errors, catalog, runtimeFor };
}

export function printSubagentAllowlistResult(result: SubagentAllowlistResult): void {
  if (!result.ok) {
    for (const msg of result.errors) {
      console.error(`ERROR: ${msg}`);
    }
    console.error('');
    console.error('Subagent allowlist check FAILED. See skills/subagents.yaml and docs/subagents.md.');
    return;
  }
  const names = listGenerateSubagents(result.catalog);
  console.log(`OK: subagent allowlist (${names.length} generate stubs, orchestrator parent, profiles stay skills)`);
}
