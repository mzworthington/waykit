import fs from 'fs';
import path from 'path';

export const ROLE_SKILL_BODY_LINE_BUDGET = 150;

export const ROLE_SKILL_LINE_BUDGET_ALLOWLIST = [] as const;

export interface RoleSkillLineCount {
  skill: string;
  lines: number;
  budget: number;
}

export interface RoleSkillLineBudgetResult {
  ok: boolean;
  budget: number;
  violations: RoleSkillLineCount[];
  allowed: RoleSkillLineCount[];
}

export interface RoleSkillLineBudgetOptions {
  budget?: number;
  allowlist?: readonly string[];
}

function countLines(text: string): number {
  if (text.length === 0) return 0;
  const parts = text.split('\n');
  return text.endsWith('\n') ? parts.length - 1 : parts.length;
}

function parseSkillMarkdown(content: string): { kind: string | null; body: string } {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) {
    return { kind: null, body: content };
  }
  const kindMatch = match[1].match(/^kind:\s*(.+)$/m);
  const kind = kindMatch ? kindMatch[1].trim() : null;
  return { kind, body: content.slice(match[0].length) };
}

export function verifyRoleSkillLineBudget(
  repoDir: string,
  options: RoleSkillLineBudgetOptions = {}
): RoleSkillLineBudgetResult {
  const budget = options.budget ?? ROLE_SKILL_BODY_LINE_BUDGET;
  const allowlist = new Set(options.allowlist ?? ROLE_SKILL_LINE_BUDGET_ALLOWLIST);
  const violations: RoleSkillLineCount[] = [];
  const allowed: RoleSkillLineCount[] = [];
  const skillsDir = path.join(repoDir, 'skills');

  if (!fs.existsSync(skillsDir)) {
    return { ok: true, budget, violations, allowed };
  }

  for (const base of fs.readdirSync(skillsDir).sort()) {
    const skillMd = path.join(skillsDir, base, 'SKILL.md');
    if (!fs.existsSync(skillMd)) continue;
    const parsed = parseSkillMarkdown(fs.readFileSync(skillMd, 'utf8'));
    if (parsed.kind !== 'role') continue;
    const lines = countLines(parsed.body);
    if (lines <= budget) continue;
    const entry = { skill: base, lines, budget };
    if (allowlist.has(base)) {
      allowed.push(entry);
    } else {
      violations.push(entry);
    }
  }

  return { ok: violations.length === 0, budget, violations, allowed };
}

export function printRoleSkillLineBudgetResult(result: RoleSkillLineBudgetResult): void {
  for (const item of result.violations) {
    console.error(
      `ERROR: role skill over line budget: ${item.skill} (${item.lines} lines; budget ${item.budget})`
    );
  }
  for (const item of result.allowed) {
    console.log(
      `ALLOWED: role skill over line budget: ${item.skill} (${item.lines} lines; budget ${item.budget}; allowlisted)`
    );
  }
  if (!result.ok) return;
  if (result.allowed.length === 0) {
    console.log(`OK: role skill bodies within ${result.budget}-line budget`);
    return;
  }
  console.log(
    `OK: role skill bodies within ${result.budget}-line budget (allowlisted overages reported)`
  );
}
