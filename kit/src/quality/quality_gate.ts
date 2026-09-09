import fs from 'node:fs';
import path from 'node:path';
import { exportIDERules } from '../bootstrap/export_ide_rules.js';
import { runEvals } from '../edd/run_evals.js';
import { handleEddEvalCli, type EddCliOptions } from '../edd/edd_cli.js';
import { scanSkillSecurity, type ScanSkillSecurityResult } from '../skills/scan_skill_security.js';
import { validateEvals, type ValidateEvalsResult } from '../edd/validate_evals.js';
import {
  printRoleSkillLineBudgetResult,
  verifyRoleSkillLineBudget,
  type RoleSkillLineBudgetResult
} from '../skills/verify_role_skill_line_budget.js';
import {
  verifySkillsLayout,
  printSkillsLayoutResult,
  type SkillsLayoutResult
} from '../skills/verify_skills_layout.js';
import {
  printSubagentAllowlistResult,
  verifySubagentAllowlist,
  type SubagentAllowlistResult
} from '../skills/verify_subagent_allowlist.js';
import {
  printSubagentStubResult,
  verifySubagentStubs,
  type SubagentStubVerifyResult
} from '../skills/generate_subagent_stubs.js';
import {
  measureContextBudget,
  printContextBudget,
  type ContextBudgetResult
} from './measure_context_budget.js';
import { printJsonReport, type JsonFinding } from '../cli/json_report.js';
import { cliOutcomeFromOk, printCliOutcome } from '../cli/outcome.js';
import { checkOntology, type OntologyCheckResult } from '../ontology/index.js';

/** Default EDD suites for this kit. Forks may delete vendor-specific suites; missing files are skipped. */
export const EDD_CI_SUITES = [
  'evals/edd/architecture_routing.yaml',
  'evals/edd/model_routing.yaml',
  'evals/edd/subagent_routing.yaml',
  'evals/edd/subagent_routing_skills_only.yaml',
  'evals/edd/kit_knowledge.yaml',
  'evals/edd/memory_ontology.yaml',
  'evals/edd/cloudflare_ops.yaml',
  'evals/edd/safety.yaml',
  'evals/edd/architecture_self_correction.yaml',
  'evals/edd/architecture_terminal.yaml'
] as const;

/** Suites that exist on disk (so forks can drop vendor suites without breaking `wk check`). */
export function resolveEddCiSuites(
  repoDir: string,
  candidates: readonly string[] = EDD_CI_SUITES
): string[] {
  return candidates.filter((rel) => fs.existsSync(path.join(repoDir, rel)));
}

export interface KitCheckDeps {
  scan?: (repoDir: string) => ScanSkillSecurityResult;
  validate?: (repoDir: string) => ValidateEvalsResult;
  verifyLayout?: (repoDir: string) => SkillsLayoutResult;
  printLayout?: (result: SkillsLayoutResult) => void;
  verifyRoleBudget?: (repoDir: string) => RoleSkillLineBudgetResult;
  printRoleBudget?: (result: RoleSkillLineBudgetResult) => void;
  verifySubagents?: (repoDir: string) => SubagentAllowlistResult;
  printSubagents?: (result: SubagentAllowlistResult) => void;
  verifyStubs?: (repoDir: string) => SubagentStubVerifyResult;
  printStubs?: (result: SubagentStubVerifyResult) => void;
  exportRules?: (targetDir: string, checkOnly: boolean) => boolean;
  evals?: (repoDir: string) => boolean;
  edd?: (options: EddCliOptions) => Promise<number | null>;
  budget?: (repoDir: string) => ContextBudgetResult;
  printBudget?: (result: ContextBudgetResult) => void;
  ontologyCheck?: (repoDir: string) => OntologyCheckResult;
  eddSuites?: (repoDir: string) => string[];
}

export async function runKitCheck(
  repoDir: string,
  deps: KitCheckDeps = {},
  opts: { json?: boolean } = {}
): Promise<number> {
  const scan = deps.scan ?? scanSkillSecurity;
  const validate = deps.validate ?? validateEvals;
  const verifyLayout = deps.verifyLayout ?? verifySkillsLayout;
  const printLayout = deps.printLayout ?? printSkillsLayoutResult;
  const verifyRoleBudget = deps.verifyRoleBudget ?? verifyRoleSkillLineBudget;
  const printRoleBudget = deps.printRoleBudget ?? printRoleSkillLineBudgetResult;
  const verifySubagents = deps.verifySubagents ?? verifySubagentAllowlist;
  const printSubagents = deps.printSubagents ?? printSubagentAllowlistResult;
  const verifyStubs = deps.verifyStubs ?? verifySubagentStubs;
  const printStubs = deps.printStubs ?? printSubagentStubResult;
  const exportRules = deps.exportRules ?? exportIDERules;
  const evals = deps.evals ?? runEvals;
  const edd = deps.edd ?? handleEddEvalCli;
  const budget = deps.budget ?? measureContextBudget;
  const printBudget = deps.printBudget ?? printContextBudget;
  const ontologyCheck = deps.ontologyCheck ?? checkOntology;
  const eddSuites = deps.eddSuites ?? resolveEddCiSuites;
  const json = opts.json === true;
  const findings: JsonFinding[] = [];
  const stdout = console.log.bind(console);

  const finish = (ok: boolean): number => {
    if (json) printJsonReport({ ok, command: 'check', findings }, stdout);
    else {
      printCliOutcome(
        cliOutcomeFromOk(ok),
        'check',
        ok ? 'audit, ontology, evals, EDD, context budget' : 'a gate failed (see above)'
      );
    }
    return ok ? 0 : 1;
  };

  if (json) {
    console.log = () => undefined;
  } else {
    console.log('=== wk check ===');
    console.log('');
  }

  try {
  const auditOk = scan(repoDir).ok;
  findings.push({ id: 'audit', status: auditOk ? 'ok' : 'fail', path: repoDir });
  if (!auditOk) return finish(false);

  const validateOk = validate(repoDir).ok;
  findings.push({ id: 'validate', status: validateOk ? 'ok' : 'fail', path: repoDir });
  if (!validateOk) return finish(false);

  const layout = verifyLayout(repoDir);
  if (!json) printLayout(layout);
  findings.push({
    id: 'layout',
    status: layout.ok ? 'ok' : 'fail',
    path: repoDir,
    detail: layout.invalid.length ? layout.invalid.join(',') : undefined
  });
  if (!layout.ok) return finish(false);

  const roleBudget = verifyRoleBudget(repoDir);
  if (!json) printRoleBudget(roleBudget);
  findings.push({
    id: 'role-line-budget',
    status: roleBudget.ok ? 'ok' : 'fail',
    path: repoDir
  });
  if (!roleBudget.ok) return finish(false);

  const subagents = verifySubagents(repoDir);
  if (!json) printSubagents(subagents);
  findings.push({
    id: 'subagent-allowlist',
    status: subagents.ok ? 'ok' : 'fail',
    path: repoDir,
    detail: subagents.errors.length ? subagents.errors.join('; ') : undefined
  });
  if (!subagents.ok) return finish(false);

  const stubs = verifyStubs(repoDir);
  if (!json) printStubs(stubs);
  findings.push({
    id: 'subagent-stubs',
    status: stubs.ok ? 'ok' : 'fail',
    path: repoDir,
    detail: stubs.errors.length ? stubs.errors.join('; ') : undefined
  });
  if (!stubs.ok) return finish(false);

  const ontology = ontologyCheck(repoDir);
  findings.push({ id: 'ontology', status: ontology.ok ? 'ok' : 'fail', path: repoDir });
  if (!ontology.ok) {
    if (!json) {
      for (const msg of ontology.messages) console.error(msg);
    }
    return finish(false);
  }
  if (!json) printCliOutcome('ok', 'ontology check', 'live-derived index');

  const rulesOk = exportRules(repoDir, true);
  findings.push({ id: 'ide-rules', status: rulesOk ? 'ok' : 'fail', path: repoDir });
  if (!rulesOk) return finish(false);
  if (!json) printCliOutcome('ok', 'export-rules', 'host pointers present');

  const evalsOk = evals(repoDir);
  findings.push({ id: 'skill-trigger-evals', status: evalsOk ? 'ok' : 'fail', path: repoDir });
  if (!evalsOk) return finish(false);

  const suites = eddSuites(repoDir);
  if (suites.length === 0 && !json) {
    console.log('No EDD CI suites present on disk; skipping EDD gate.');
  }
  for (const suite of suites) {
    const code = await edd({
      repoDir,
      args: [
        'ci',
        '--suite',
        suite,
        '--threshold-routing',
        '95',
        '--style',
        'local',
        '--model',
        'scripted',
        '--out',
        'out/reports'
      ]
    });
    const eddOk = code === 0;
    findings.push({
      id: `edd:${suite}`,
      status: eddOk ? 'ok' : 'fail',
      path: path.join(repoDir, suite)
    });
    if (!eddOk) return finish(false);
  }

  const budgetResult = budget(repoDir);
  if (!json) printBudget(budgetResult);
  findings.push({
    id: 'context-budget',
    status: budgetResult.ok ? 'ok' : 'fail',
    path: repoDir
  });
  if (!budgetResult.ok) return finish(false);

  return finish(true);
  } finally {
    console.log = stdout;
  }
}
