import fs from 'fs';
import path from 'path';
import { resolveRepoDir } from '../shared/paths.js';
import { splitYamlFrontmatter, yamlDashedList, yamlScalar } from '../shared/yaml_frontmatter.js';
import { printCliOutcome } from '../cli/outcome.js';

const defaultRepoDir: string = resolveRepoDir(import.meta.url);

interface TestCase {
  id: string;
  name: string;
  target_skill?: string;
  prompt: string;
  assertions: {
    required_triggers?: string[];
    required_patterns?: string[];
    forbidden_patterns?: string[];
    required_output_sections?: string[];
  };
}

interface EvalSuite {
  suite: string;
  description?: string;
  test_cases: TestCase[];
}

interface SkillMeta {
  name: string;
  triggers: string[];
  body: string;
}

function loadSkillsMeta(skillsDir: string): Map<string, SkillMeta> {
  const map = new Map<string, SkillMeta>();
  if (!fs.existsSync(skillsDir)) return map;

  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;

    const content = fs.readFileSync(skillPath, 'utf8');
    const split = splitYamlFrontmatter(content);
    if (!split) continue;

    const name = yamlScalar(split.yaml, 'name')?.trim() || entry.name;
    const triggers = (yamlDashedList(split.yaml, 'triggers') ?? []).map((item) => item.toLowerCase());

    map.set(name, {
      name,
      triggers,
      body: content
    });
  }
  return map;
}

function findEvalSuites(evalsDir: string, skillsDir: string): string[] {
  const files: string[] = [];
  const suitesDir = path.join(evalsDir, 'suites');

  if (fs.existsSync(suitesDir)) {
    const entries = fs.readdirSync(suitesDir);
    for (const file of entries) {
      if (file.endsWith('.json')) files.push(path.join(suitesDir, file));
    }
  }

  // Also collect skills/*/evals/eval.json
  if (fs.existsSync(skillsDir)) {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const evalPath = path.join(skillsDir, entry.name, 'evals', 'eval.json');
      if (fs.existsSync(evalPath)) files.push(evalPath);
    }
  }

  return files;
}

export function runEvals(rootDir: string = defaultRepoDir): boolean {
  const evalsDir = path.join(rootDir, 'evals');
  const skillsDir = path.join(rootDir, 'skills');

  console.log('=== Waykit - Skill-trigger harness (registration / prompt hygiene) ===\n');

  const skillsMap = loadSkillsMeta(skillsDir);
  console.log(`Loaded ${skillsMap.size} kit skills from skills/\n`);

  const suiteFiles = findEvalSuites(evalsDir, skillsDir);
  let totalCases = 0;
  let passedCases = 0;
  let failedCases = 0;

  for (const suiteFile of suiteFiles) {
    const relPath = path.relative(rootDir, suiteFile);
    try {
      const raw = fs.readFileSync(suiteFile, 'utf8');
      const suite: EvalSuite = JSON.parse(raw);

      console.log(`Evaluating suite: ${relPath} (${suite.test_cases.length} test cases)`);

      for (const testCase of suite.test_cases) {
        totalCases++;
        let casePassed = true;
        const failureReasons: string[] = [];
        const promptLower = testCase.prompt.toLowerCase();

        if (testCase.target_skill) {
          const skillMeta = skillsMap.get(testCase.target_skill);
          if (!skillMeta) {
            casePassed = false;
            failureReasons.push(`Target skill "${testCase.target_skill}" is not registered in skills/`);
          } else if (skillMeta.triggers.length === 0) {
            casePassed = false;
            failureReasons.push(`Target skill "${testCase.target_skill}" has no registered triggers in SKILL.md frontmatter`);
          }
        }

        if (testCase.assertions.forbidden_patterns) {
          for (const forbidden of testCase.assertions.forbidden_patterns) {
            if (promptLower.includes(forbidden.toLowerCase()) && !forbidden.toLowerCase().includes('```')) {
              casePassed = false;
              failureReasons.push(`Prompt contains forbidden pattern "${forbidden}"`);
            }
          }
        }

        const haystack = testCase.target_skill ? skillsMap.get(testCase.target_skill)?.body : undefined;
        const needles = [
          ...(testCase.assertions.required_patterns ?? []),
          ...(testCase.assertions.required_output_sections ?? [])
        ];
        if (needles.length > 0) {
          if (!testCase.target_skill) {
            casePassed = false;
            failureReasons.push('required_patterns / required_output_sections need target_skill');
          } else if (haystack === undefined) {
            casePassed = false;
            failureReasons.push(`Target skill "${testCase.target_skill}" has no SKILL.md body to check`);
          } else {
            const hayLower = haystack.toLowerCase();
            for (const needle of needles) {
              if (!hayLower.includes(needle.toLowerCase())) {
                casePassed = false;
                failureReasons.push(
                  `Skill "${testCase.target_skill}" body missing required pattern "${needle}"`
                );
              }
            }
          }
        }

        if (casePassed) {
          passedCases++;
          console.log(`  ✓ [PASS] ${testCase.id}: ${testCase.name}`);
        } else {
          failedCases++;
          console.error(`  ❌ [FAIL] ${testCase.id}: ${testCase.name}`);
          failureReasons.forEach(r => console.error(`     - ${r}`));
        }
      }
      console.log('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`❌ Error parsing suite ${relPath}: ${msg}`);
      failedCases++;
    }
  }

  const accuracy = totalCases > 0 ? ((passedCases / totalCases) * 100).toFixed(1) : '100.0';
  console.log(`Evaluation Summary: ${totalCases} test case(s) evaluated across ${suiteFiles.length} suite(s).`);
  console.log(`Passed: ${passedCases} | Failed: ${failedCases} | Accuracy: ${accuracy}%\n`);

  if (failedCases > 0) {
    printCliOutcome('fail', 'eval', `${failedCases} skill-trigger case(s) failed`);
    return false;
  }

  printCliOutcome('ok', 'eval', 'skill-trigger harness');
  return true;
}
