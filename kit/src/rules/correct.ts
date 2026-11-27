import fs from 'node:fs';
import path from 'node:path';

export const ENFORCERS = ['structure', 'type', 'check', 'test', 'judgment'] as const;

export type Enforcer = (typeof ENFORCERS)[number];

export interface Correction {
  rule: string;
  scope: 'kit' | 'project';
  available: readonly Enforcer[];
}

export interface AppliedRule {
  rule: string;
  enforcer: Enforcer;
  scope: 'kit' | 'project';
  learningDoc: boolean;
  adr: boolean;
}

export function applyCorrection(correction: Correction): AppliedRule {
  const enforcer = ENFORCERS.find((item) => correction.available.includes(item));
  if (!enforcer) {
    throw new Error('no enforcer can hold this correction');
  }
  const judgment = enforcer === 'judgment';
  return {
    rule: correction.rule,
    enforcer,
    scope: correction.scope,
    learningDoc: judgment,
    adr: judgment
  };
}

export function recordRule(applied: AppliedRule, roots: { kitRoot: string; repoDir: string }): string {
  const root = applied.scope === 'kit' ? roots.kitRoot : roots.repoDir;
  const file = path.join(root, 'rules.md');
  const row = `| ${applied.rule} | ${applied.enforcer} |\n`;
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, `| Rule | Enforces |\n| --- | --- |\n${row}`, 'utf8');
  } else {
    fs.appendFileSync(file, row, 'utf8');
  }
  return file;
}

export const RULE_TABLE_HEADER = '| Rule | Enforces |\n| --- | --- |\n';

export function seedProjectRuleTable(repoDir: string): void {
  const file = path.join(repoDir, 'rules.md');
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, RULE_TABLE_HEADER, 'utf8');
  }
}

export function finishSession(repoDir: string, applied: readonly AppliedRule[]): void {
  const judgments = applied.filter((item) => item.enforcer === 'judgment');
  if (judgments.length === 0) {
    return;
  }
  const body = judgments.map((item) => item.rule).join('\n');
  const lessonDir = path.join(repoDir, 'lessons');
  fs.mkdirSync(lessonDir, { recursive: true });
  fs.writeFileSync(path.join(lessonDir, 'judgment.md'), `${body}\n`, 'utf8');
  const adrDir = path.join(repoDir, 'docs', 'ADRs');
  fs.mkdirSync(adrDir, { recursive: true });
  fs.writeFileSync(path.join(adrDir, '0001-judgment.md'), `${body}\n`, 'utf8');
}
