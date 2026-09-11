import fs from 'fs';
import os from 'os';
import path from 'path';
import { exportIDERules } from '../bootstrap/export_ide_rules.js';
import { initProject } from '../bootstrap/init_project.js';
import { ghGitHubPort } from '../doctor/github.js';
import { alignProject, printAlignResult } from '../align/align_project.js';
import { printAlignOwnedResult, runAlignOwned } from '../align/align_owned.js';
import { printDoctorResult, runDoctor } from '../doctor/run.js';
import { evaluateOwnership, shouldInstallInitHooks } from '../doctor/ownership.js';
import { composeMCP, restoreProjectMcp } from '../bootstrap/compose_mcp.js';
import { profileToRestore } from '../bootstrap/mcp_profile_stamp.js';
import { debugCiFailed } from '../debug/debug_ci_failed.js';
import { initDebugBoardSession } from '../debug/init_debug_board.js';
import { handleEddEvalCli } from '../edd/edd_cli.js';
import { runEvals } from '../edd/run_evals.js';
import { validateEvals } from '../edd/validate_evals.js';
import {
  checkOntology,
  lintMemoryGraph,
  regenerateOntologyIndex
} from '../ontology/index.js';
import { measureContextBudget, printContextBudget } from '../quality/measure_context_budget.js';
import { runKitCheck } from '../quality/quality_gate.js';
import { renderAnalyticsSummary } from '../quality/telemetry_analytics.js';
import { assemblePagesSite, defaultPagesSiteDest } from '../site/assemble.js';
import { scanSkillSecurity } from '../skills/scan_skill_security.js';
import { parseSyncArgs, syncExternalSkills } from '../skills/sync_external_skills.js';
import {
  printRoleSkillLineBudgetResult,
  verifyRoleSkillLineBudget
} from '../skills/verify_role_skill_line_budget.js';
import { printSkillsLayoutResult, verifySkillsLayout } from '../skills/verify_skills_layout.js';
import {
  printSubagentAllowlistResult,
  verifySubagentAllowlist
} from '../skills/verify_subagent_allowlist.js';
import {
  generateSubagentStubs,
  printSubagentStubResult,
  verifySubagentStubs
} from '../skills/generate_subagent_stubs.js';
import { installUserSubagentStubs } from '../skills/install_subagent_stubs.js';
import {
  buildLaunchPrompt,
  defaultProjectName,
  formatSubagentStatus,
  subagentStatus
} from '../skills/subagent_runtime.js';
import { resolveModel } from '../models/catalog.js';
import { validateConventionalCommit } from '../commits/conventional.js';
import { installTddGuardHooks } from '../tdd-guard/install_hooks.js';
import { runTddGuardHook } from '../tdd-guard/run_hook.js';
import { setTddGuardDisabled } from '../tdd-guard/session_store.js';
import {
  completeKitLine,
  installCompletions,
  listMcpProfileNames,
  renderCompletion
} from './completion.js';
import { printKitVersion } from '../version/print_kit_version.js';
import { errorMessage, printKitHelp } from './help.js';
import { shouldShowInteractiveMenu } from './interactiveMenu.js';
import { promptInteractiveMenu } from './runInteractiveMenu.js';
import { formatUnknownCommand } from './suggest.js';
import {
  alignOwnedResultToJson,
  alignResultToJson,
  doctorResultToJson,
  printJsonReport
} from './json_report.js';
import { cliOutcomeExit, cliOutcomeFromOk, cliOutcomeShouldColor, printCliOutcome } from './outcome.js';
import type { KitCommand } from './parse.js';

export interface RunKitContext {
  repoDir: string;
  env?: NodeJS.ProcessEnv;
  homedir?: string;
  cwd?: string;
  stdoutIsTTY?: boolean;
  promptMenu?: (input: { cwd: string; repoDir: string }) => Promise<KitCommand>;
}

function status(ok: boolean): number {
  return ok ? 0 : 1;
}

function memoryGraphPath(ctx: RunKitContext): string {
  const env = ctx.env ?? process.env;
  const home = ctx.homedir ?? os.homedir();
  return env.MEMORY_FILE_PATH?.trim() || path.join(home, '.agents', 'sync', 'mcp-memory.jsonl');
}

function maybeInstallUserSubagentStubsAfterSync(
  repoDir: string,
  args: string[],
  homedir: string
): void {
  let parsed;
  try {
    parsed = parseSyncArgs(args);
  } catch {
    return;
  }
  if (parsed.help || parsed.dryRun) return;
  const result = installUserSubagentStubs({ kitRepoDir: repoDir, homedir });
  printCliOutcome(
    'ok',
    'agents install',
    `${result.written.length} file(s) in ~/.cursor/agents and ~/.claude/agents`
  );
}

export async function runKitCommand(command: KitCommand, ctx: RunKitContext): Promise<number> {
  const { repoDir } = ctx;

  switch (command.kind) {
    case 'menu': {
      const env = ctx.env ?? process.env;
      const stdoutIsTTY = ctx.stdoutIsTTY ?? process.stdout.isTTY === true;
      if (!shouldShowInteractiveMenu({ stdoutIsTTY, env })) {
        printKitHelp();
        return 0;
      }
      const cwd = ctx.cwd ?? process.cwd();
      const next = ctx.promptMenu
        ? await ctx.promptMenu({ cwd, repoDir })
        : await promptInteractiveMenu({ cwd, repoDir });
      return runKitCommand(next, ctx);
    }

    case 'help':
      printKitHelp(console.log, command.topic);
      return 0;

    case 'unknown':
      console.error(formatUnknownCommand(command.command));
      return 1;

    case 'usage':
      console.error(command.message);
      return 2;

    case 'init': {
      let installHook = command.installHook;
      if (installHook) {
        const ownership = evaluateOwnership(ghGitHubPort().viewFromCwd(command.targetDir));
        if (!shouldInstallInitHooks(ownership, true)) {
          console.log(`Skipping git hooks (${ownership.reason}). Install hooks only on repos you admin.`);
          installHook = false;
        }
      }
      initProject({
        targetDir: command.targetDir,
        mcpProfile: command.mcpProfile,
        installMCP: command.installMCP,
        installIDE: command.installIDE,
        installHook,
        hosts: command.hosts
      });
      return 0;
    }

    case 'doctor': {
      const result = runDoctor({
        targetDir: command.targetDir,
        write: command.write,
        owned: command.owned,
        scanDir: command.scanDir,
        repoClass: command.repoClass,
        installHook: command.installHook,
        login: command.login,
        kitRepoDir: repoDir,
        github: ghGitHubPort()
      });
      if (command.json) {
        printJsonReport(doctorResultToJson(result));
      } else {
        printDoctorResult(result);
      }
      if (result.error) return 1;
      return status(result.ok);
    }

    case 'mcp': {
      if (command.profile === 'restore' && !command.install && !command.outputFile) {
        restoreProjectMcp({
          hosts: command.hosts,
          projectDir: process.cwd()
        });
        return 0;
      }
      const profile =
        command.profile === 'restore' ? profileToRestore(process.cwd()) : command.profile;
      composeMCP(profile, command.outputFile, command.install, {
        hosts: command.hosts,
        installProject: command.project,
        projectDir: command.project ? process.cwd() : undefined
      });
      return 0;
    }

    case 'audit':
      return status(scanSkillSecurity(repoDir).ok);

    case 'validate':
      return status(validateEvals(repoDir).ok);

    case 'eval': {
      const eddCode = await handleEddEvalCli({ repoDir, args: command.rest });
      if (eddCode !== null) return eddCode;
      return status(runEvals());
    }

    case 'export-rules': {
      const ok = exportIDERules(command.dir, command.check);
      if (command.check) {
        printCliOutcome(cliOutcomeFromOk(ok), 'export-rules', ok ? 'host pointers present' : 'missing host pointer');
      }
      return status(ok);
    }

    case 'metrics':
      renderAnalyticsSummary();
      return 0;

    case 'verify': {
      const layout = verifySkillsLayout(repoDir);
      printSkillsLayoutResult(layout);
      const budget = verifyRoleSkillLineBudget(repoDir);
      printRoleSkillLineBudgetResult(budget);
      const subagents = verifySubagentAllowlist(repoDir);
      printSubagentAllowlistResult(subagents);
      const stubs = verifySubagentStubs(repoDir);
      printSubagentStubResult(stubs);
      const ok = layout.ok && budget.ok && subagents.ok && stubs.ok;
      printCliOutcome(
        cliOutcomeFromOk(ok),
        'verify',
        ok ? 'layout, line budget, allowlist, stubs' : 'see errors above'
      );
      return status(ok);
    }

    case 'sync': {
      const code = syncExternalSkills(repoDir, command.rest);
      if (code !== 0) return code;
      maybeInstallUserSubagentStubsAfterSync(repoDir, command.rest, ctx.homedir ?? os.homedir());
      return 0;
    }

    case 'measure-context': {
      const result = measureContextBudget(repoDir);
      printContextBudget(result);
      return status(result.ok);
    }

    case 'debug-board':
      try {
        const result = initDebugBoardSession({
          repoDir,
          project: command.project,
          title: command.title
        });
        console.log(`Wrote ${result.boardPath}`);
        console.log(`Handover: ${result.handoverPath}`);
        return 0;
      } catch (err: unknown) {
        console.error(`ERROR: ${errorMessage(err)}`);
        return 1;
      }

    case 'debug-ci':
      return debugCiFailed(command.rest);

    case 'check':
      return runKitCheck(repoDir, {}, { json: command.json });

    case 'align': {
      if (command.owned) {
        const result = runAlignOwned({
          targetDir: command.targetDir,
          write: command.write,
          composeMcp: command.composeMcp,
          scanDir: command.scanDir,
          login: command.login,
          kitRepoDir: repoDir,
          github: ghGitHubPort()
        });
        if (command.json) {
          printJsonReport(alignOwnedResultToJson(result));
        } else {
          printAlignOwnedResult(result);
        }
        if (result.error) return 1;
        return status(result.ok);
      }
      const result = alignProject({
        targetDir: command.targetDir,
        kitRepoDir: repoDir,
        write: command.write,
        composeMcp: command.composeMcp
      });
      if (command.write) {
        installUserSubagentStubs({
          kitRepoDir: repoDir,
          homedir: ctx.homedir ?? os.homedir()
        });
      }
      if (command.json) {
        printJsonReport(alignResultToJson(result));
      } else {
        printAlignResult(result);
      }
      return status(result.ok);
    }

    case 'version': {
      const outcome = printKitVersion({
        kitRepoDir: repoDir,
        homedir: ctx.homedir,
        check: command.check
      });
      return cliOutcomeExit(outcome);
    }

    case 'complete': {
      const replies = completeKitLine(command.words, { mcpProfiles: listMcpProfileNames(repoDir) });
      if (replies.length > 0) process.stdout.write(`${replies.join('\n')}\n`);
      return 0;
    }

    case 'completion':
      process.stdout.write(renderCompletion(command.shell));
      return 0;

    case 'completion-install': {
      const result = installCompletions({
        homedir: ctx.homedir ?? os.homedir(),
        shells: command.shell ? [command.shell] : undefined
      });
      for (const file of result.files) console.log(`Wrote ${file}`);
      console.log(result.snippet);
      return 0;
    }

    case 'agents-generate': {
      const files = generateSubagentStubs(repoDir);
      printCliOutcome('ok', 'agents generate', `${files.length} stub(s) under agents/`);
      return 0;
    }

    case 'agents-install': {
      const result = installUserSubagentStubs({
        kitRepoDir: repoDir,
        homedir: ctx.homedir ?? os.homedir()
      });
      printCliOutcome(
        'ok',
        'agents install',
        `${result.written.length} file(s) in ~/.cursor/agents and ~/.claude/agents`
      );
      return 0;
    }

    case 'agents-status': {
      const status = subagentStatus({
        repoDir,
        env: ctx.env ?? process.env,
        homedir: ctx.homedir ?? os.homedir()
      });
      if (command.json) {
        console.log(JSON.stringify(status));
        return 0;
      }
      console.log(formatSubagentStatus(status, { color: cliOutcomeShouldColor() }));
      return cliOutcomeExit(status.missRate.verdict === 'freeze' || status.missRate.verdict === 'not-enough' ? 'warn' : 'ok');
    }

    case 'agents-launch-prompt': {
      try {
        const body = buildLaunchPrompt({
          repoDir,
          skill: command.skill,
          project: command.project.trim() || defaultProjectName(process.cwd()),
          linearId: command.linearId,
          handoverPaths: command.handoverPaths,
          nextAgent: command.nextAgent,
          definitionOfDone: command.definitionOfDone
        });
        console.log(body);
        return 0;
      } catch (err: unknown) {
        console.error(`ERROR: ${errorMessage(err)}`);
        return 1;
      }
    }

    case 'ontology':
      if (command.sub === 'generate') {
        const result = regenerateOntologyIndex(repoDir);
        printCliOutcome('ok', 'ontology generate', 'wrote gitignored cache and homepage index');
        console.log(result.path);
        console.log(result.sitePath);
        return 0;
      }
      {
        const result = checkOntology(repoDir);
        for (const msg of result.messages) console.error(msg);
        printCliOutcome(
          cliOutcomeFromOk(result.ok),
          'ontology check',
          result.ok ? 'live-derived index' : 'broken refs or stale cache (see above)'
        );
        return status(result.ok);
      }

    case 'model-resolve': {
      try {
        const resolved = resolveModel(repoDir, {
          skill: command.skill,
          phase: command.phase,
          host: command.host,
          specComplete: command.specComplete,
          blocked: command.blocked
        });
        console.log(JSON.stringify(resolved));
        return 0;
      } catch (err: unknown) {
        console.error(`ERROR: ${errorMessage(err)}`);
        return 1;
      }
    }

    case 'memory-lint': {
      const result = lintMemoryGraph(repoDir, memoryGraphPath(ctx));
      const outcome = result.legacyUnknown.length > 0 ? 'warn' : 'ok';
      printCliOutcome(
        outcome,
        'memory lint',
        result.legacyUnknown.length > 0
          ? `${result.legacyUnknown.length} legacy entit(y/ies) outside allowlist`
          : 'entity types within allowlist'
      );
      for (const msg of result.messages) console.log(msg);
      for (const e of result.legacyUnknown) {
        console.log(`- ${e.name} (${e.entityType})`);
      }
      return cliOutcomeExit(outcome);
    }

    case 'commit-msg': {
      let raw = command.message;
      if (raw === undefined) {
        const file = command.file;
        if (!file) {
          console.error('Usage: wk commit-msg [--message <subject>] [file]');
          return 2;
        }
        try {
          raw = fs.readFileSync(file, 'utf8');
        } catch (err: unknown) {
          console.error(`ERROR: ${errorMessage(err)}`);
          return 1;
        }
      }
      const result = validateConventionalCommit(raw);
      if (!result.ok) {
        printCliOutcome('fail', 'commit-msg', result.error ?? 'not conventional');
        return 1;
      }
      printCliOutcome('ok', 'commit-msg', 'conventional subject');
      return 0;
    }

    case 'tdd-guard': {
      if (command.action === 'install') {
        const written = installTddGuardHooks(command.targetDir);
        printCliOutcome('ok', 'tdd-guard install', `${written.cursorHooks} + ${written.claudeSettings}`);
        return 0;
      }
      if (command.action === 'disable' || command.action === 'enable') {
        setTddGuardDisabled(command.targetDir, command.action === 'disable');
        printCliOutcome('ok', `tdd-guard ${command.action}`, command.targetDir);
        return 0;
      }
      const stdin = fs.readFileSync(0, 'utf8');
      const result = runTddGuardHook({ stdin, cwd: command.targetDir });
      process.stdout.write(`${result.stdout}\n`);
      return result.exitCode;
    }

    case 'site-assemble': {
      const dest = command.dest ?? defaultPagesSiteDest(repoDir);
      try {
        const result = assemblePagesSite({ kitRoot: repoDir, dest });
        printCliOutcome('ok', 'site assemble', `${result.fileCount} files -> ${result.dest}`);
        return 0;
      } catch (err: unknown) {
        console.error(`ERROR: ${errorMessage(err)}`);
        return 1;
      }
    }
  }
}
