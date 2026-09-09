import fs from 'fs';
import path from 'path';

/** Committed kit skills only. Upstream vendors belong in ~/.cursor/skills. */
export const KIT_SKILL_DIR_PREFIX = /^(agent|profile|lang|framework)-/;
const SKIP = new Set(['README.md', 'external.lock.json', 'subagents.yaml']);

export interface SkillsLayoutResult {
  ok: boolean;
  invalid: string[];
}

export function verifySkillsLayout(repoDir: string): SkillsLayoutResult {
  const skillsDir = path.join(repoDir, 'skills');
  const invalid: string[] = [];

  if (!fs.existsSync(skillsDir)) {
    return { ok: true, invalid };
  }

  for (const base of fs.readdirSync(skillsDir)) {
    if (SKIP.has(base)) continue;
    if (!KIT_SKILL_DIR_PREFIX.test(base)) {
      invalid.push(base);
    }
  }

  return { ok: invalid.length === 0, invalid };
}

export function printSkillsLayoutResult(result: SkillsLayoutResult): void {
  for (const name of result.invalid) {
    console.error(`ERROR: non-kit skill directory: skills/${name}`);
    console.error('       Remove it or reinstall upstream skills to ~/.cursor/skills:');
    console.error('       wk sync --install');
  }
  if (!result.ok) {
    console.error('');
    console.error(`Found ${result.invalid.length} invalid skill(s). See skills/README.md (Kit vs external).`);
    return;
  }
  console.log('OK: skills/ contains only kit-authored prefixes (agent-, profile-, lang-, framework-)');
}
