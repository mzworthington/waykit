import fs from 'fs';
import path from 'path';
import Ajv, { type ValidateFunction } from 'ajv';
import { printCliOutcome } from '../cli/outcome.js';

interface Assertions {
  required_triggers?: string[];
  required_patterns?: string[];
  forbidden_patterns?: string[];
  required_output_sections?: string[];
}

interface TestCase {
  id: string;
  name: string;
  description?: string;
  target_skill: string;
  prompt: string;
  context?: {
    detected_stack?: string[];
    active_phase?: string;
    files_present?: string[];
  };
  assertions: Assertions;
}

interface EvalSuite {
  suite: string;
  description: string;
  version: string;
  test_cases: TestCase[];
}

interface SkillFrontmatter {
  triggers: string[];
}

interface EvalFileInfo {
  relPath: string;
  absPath: string;
}

export interface ValidateEvalsResult {
  ok: boolean;
  errors: number;
  totalSuites: number;
  totalTests: number;
}

const ROUTING_SUITE = 'routing-matrix.json';
const LIFECYCLE_SUITE = 'lifecycle-roles.json';
const STACK_SUITE = 'stack-profiles.json';

function loadSchemaValidator(schemaPath: string): ValidateFunction | null {
  if (!fs.existsSync(schemaPath)) {
    console.warn(`  ⚠️ Schema file not found at ${schemaPath} - falling back to structural checks only`);
    return null;
  }

  try {
    const schema: Record<string, unknown> = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as Record<string, unknown>;
    const ajv = new Ajv({ allErrors: true });
    return ajv.compile(schema);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`  ⚠️ Failed to compile schema: ${message} - falling back to structural checks only`);
    return null;
  }
}

function parseYamlFrontmatter(content: string): SkillFrontmatter | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) return null;
  const yamlText = match[1];
  const triggersMatch = yamlText.match(/triggers:\s*\n((?:\s*-\s*.*\n?)+)/);
  if (!triggersMatch) return { triggers: [] };
  const triggers = triggersMatch[1]
    .split('\n')
    .map((line: string) => line.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean);
  return { triggers };
}

function findEvalFiles(repoDir: string): EvalFileInfo[] {
  const files: EvalFileInfo[] = [];
  const skillsDir = path.join(repoDir, 'skills');
  const centralSuitesDir = path.join(repoDir, 'evals', 'suites');

  if (fs.existsSync(centralSuitesDir)) {
    for (const f of fs.readdirSync(centralSuitesDir)) {
      if (f.endsWith('.json')) {
        files.push({ relPath: `evals/suites/${f}`, absPath: path.join(centralSuitesDir, f) });
      }
    }
  }

  if (fs.existsSync(skillsDir)) {
    for (const skillDirName of fs.readdirSync(skillsDir)) {
      const skillEvalsDir = path.join(skillsDir, skillDirName, 'evals');
      if (fs.existsSync(skillEvalsDir) && fs.statSync(skillEvalsDir).isDirectory()) {
        for (const f of fs.readdirSync(skillEvalsDir)) {
          if (f.endsWith('.json')) {
            files.push({ relPath: `skills/${skillDirName}/evals/${f}`, absPath: path.join(skillEvalsDir, f) });
          }
        }
      }
    }
  }

  return files;
}

function listSkillNames(skillsDir: string): string[] {
  if (!fs.existsSync(skillsDir)) return [];
  return fs.readdirSync(skillsDir).filter((name) => fs.existsSync(path.join(skillsDir, name, 'SKILL.md')));
}

function checkCentralSuiteCoverage(
  skillsDir: string,
  suitesDir: string,
  suiteTargets: Map<string, Set<string>>
): number {
  let errors = 0;
  const skills = listSkillNames(skillsDir);
  const agentSkills = skills.filter((name) => name.startsWith('agent-'));
  const stackSkills = skills.filter(
    (name) => name.startsWith('lang-') || name.startsWith('framework-') || name.startsWith('profile-')
  );

  const checks: Array<{ file: string; skills: string[]; label: string }> = [
    { file: ROUTING_SUITE, skills: agentSkills, label: 'routing-matrix' },
    { file: LIFECYCLE_SUITE, skills: agentSkills, label: 'lifecycle-roles' },
    { file: STACK_SUITE, skills: stackSkills, label: 'stack-profiles' }
  ];

  for (const check of checks) {
    const absPath = path.join(suitesDir, check.file);
    if (!fs.existsSync(absPath) || !suiteTargets.has(check.file)) continue;
    const covered = suiteTargets.get(check.file) ?? new Set<string>();
    for (const skill of check.skills) {
      if (!covered.has(skill)) {
        console.error(`  ❌ Skill ${skill} has no ${check.label} case`);
        errors++;
      }
    }
  }

  return errors;
}

export function validateEvals(repoDir: string): ValidateEvalsResult {
  const skillsDir = path.join(repoDir, 'skills');
  const schemaPath = path.join(repoDir, 'evals', 'schema.json');
  const validate = loadSchemaValidator(schemaPath);
  const evalFiles = findEvalFiles(repoDir);

  let totalSuites = 0;
  let totalTests = 0;
  let errors = 0;
  const suiteTargets = new Map<string, Set<string>>();

  console.log('=== Waykit - Skill Evals Validation ===');
  console.log('');

  for (const fileInfo of evalFiles) {
    totalSuites++;
    console.log(`Checking suite: ${fileInfo.relPath}...`);

    let data: EvalSuite;
    try {
      data = JSON.parse(fs.readFileSync(fileInfo.absPath, 'utf8')) as EvalSuite;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Invalid JSON in ${fileInfo.relPath}: ${message}`);
      errors++;
      continue;
    }

    if (validate) {
      const valid = validate(data);
      if (!valid && validate.errors) {
        for (const schemaError of validate.errors) {
          console.error(`  ❌ Schema violation in ${fileInfo.relPath}: ${schemaError.instancePath} ${schemaError.message}`);
        }
        errors++;
        continue;
      }
    } else if (!data.suite || !data.version || !Array.isArray(data.test_cases)) {
      console.error(`  ❌ Suite ${fileInfo.relPath} missing required fields (suite, version, test_cases)`);
      errors++;
      continue;
    }

    const suiteFileName = path.basename(fileInfo.absPath);
    if (fileInfo.relPath.startsWith('evals/suites/') && Array.isArray(data.test_cases)) {
      const targets = suiteTargets.get(suiteFileName) ?? new Set<string>();
      for (const test of data.test_cases) {
        if (test.target_skill) targets.add(test.target_skill);
      }
      suiteTargets.set(suiteFileName, targets);
    }

    for (const test of data.test_cases) {
      totalTests++;
      const targetSkill = test.target_skill;
      const skillPath = path.join(skillsDir, targetSkill, 'SKILL.md');

      if (!fs.existsSync(skillPath)) {
        console.error(`  ❌ Test ${test.id} references non-existent skill: ${targetSkill} (${skillPath})`);
        errors++;
        continue;
      }

      const skillContent = fs.readFileSync(skillPath, 'utf8');
      const frontmatter = parseYamlFrontmatter(skillContent);
      const skillTriggers = frontmatter?.triggers ? frontmatter.triggers.map((t: string) => t.toLowerCase()) : [];

      if (test.assertions && Array.isArray(test.assertions.required_triggers)) {
        for (const reqTrigger of test.assertions.required_triggers) {
          const normalizedReq = reqTrigger.toLowerCase();
          const found = skillTriggers.some((st: string) => st.includes(normalizedReq) || normalizedReq.includes(st));
          if (!found) {
            console.error(
              `  ⚠️ Test ${test.id}: required trigger "${reqTrigger}" not found in ${targetSkill} frontmatter triggers: [${skillTriggers.join(', ')}]`
            );
          }
        }
      }

      const promptLower = test.prompt.toLowerCase();
      const forbidden = test.assertions?.forbidden_patterns ?? [];
      for (const pattern of forbidden) {
        if (pattern.toLowerCase().includes('```')) continue;
        if (promptLower.includes(pattern.toLowerCase())) {
          console.error(
            `  ❌ Test ${test.id}: prompt contains forbidden pattern "${pattern}" (skill-trigger evals would fail)`
          );
          errors++;
        }
      }
    }

    console.log(`  ✓ ${fileInfo.relPath} passed structure check (${data.test_cases.length} test cases)`);
  }

  errors += checkCentralSuiteCoverage(skillsDir, path.join(repoDir, 'evals', 'suites'), suiteTargets);

  console.log('');
  console.log(`Validation Complete: ${totalSuites} suite(s), ${totalTests} test case(s) checked.`);

  if (errors > 0) {
    printCliOutcome('fail', 'validate', `${errors} error(s)`);
  } else {
    printCliOutcome('ok', 'validate', `${totalSuites} suite(s), ${totalTests} test case(s)`);
  }

  return { ok: errors === 0, errors, totalSuites, totalTests };
}
