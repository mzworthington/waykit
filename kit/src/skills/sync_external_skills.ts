import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { parseExternalLockFile } from './parse_external_lock.js';
import { ghSkillPinArgs } from './skill_pin.js';

export function cursorUserSkillsDir(): string {
  return path.join(os.homedir(), '.cursor', 'skills');
}

export interface CommandRunner {
  exists(bin: string): boolean;
  skillAvailable(): boolean;
  run(bin: string, args: string[]): { status: number };
  userSkillsDir?: () => string;
  /** Extra Agent Skills dirs (Claude, Antigravity). Tests omit this so we never write the real home. */
  mirrorSkillDirs?: () => string[];
}

export function defaultMirrorSkillDirs(homedir: string = os.homedir()): string[] {
  return [path.join(homedir, '.claude', 'skills'), path.join(homedir, '.gemini', 'skills')];
}

export function mirrorUserSkills(sourceDir: string, destDirs: string[]): string[] {
  if (!fs.existsSync(sourceDir) || destDirs.length === 0) return [];
  const linked: string[] = [];
  for (const dest of destDirs) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(sourceDir)) {
      const from = path.join(sourceDir, name);
      if (!fs.statSync(from).isDirectory()) continue;
      const to = path.join(dest, name);
      if (fs.existsSync(to)) continue;
      fs.symlinkSync(from, to);
      linked.push(to);
    }
  }
  return linked;
}

export const defaultCommandRunner: CommandRunner = {
  exists(bin: string): boolean {
    const result = spawnSync('sh', ['-c', `command -v ${JSON.stringify(bin)}`], { encoding: 'utf8' });
    return result.status === 0 && Boolean(result.stdout?.trim());
  },
  skillAvailable(): boolean {
    const result = spawnSync('gh', ['skill', '--help'], { stdio: 'pipe' });
    return result.status === 0;
  },
  run(bin: string, args: string[]): { status: number } {
    const result = spawnSync(bin, args, { stdio: 'inherit' });
    return { status: result.status ?? 1 };
  },
  userSkillsDir: cursorUserSkillsDir,
  mirrorSkillDirs: () => defaultMirrorSkillDirs()
};

function resolveUserSkillsDir(runner: CommandRunner): string {
  return runner.userSkillsDir?.() ?? cursorUserSkillsDir();
}

function ghSkillUpdateArgs(names: string[], skillsDir: string, dryRun: boolean): string[] {
  const cmd = ['skill', 'update', '--dir', skillsDir];
  if (dryRun) cmd.push('--dry-run');
  cmd.push(...names);
  return cmd;
}

export interface SyncArgs {
  mode: 'install' | 'update';
  dryRun: boolean;
  force: boolean;
  help: boolean;
}

export function parseSyncArgs(args: string[]): SyncArgs {
  const parsed: SyncArgs = { mode: 'install', dryRun: false, force: false, help: false };
  for (const arg of args) {
    switch (arg) {
      case '-h':
      case '--help':
        parsed.help = true;
        break;
      case '--install':
        parsed.mode = 'install';
        break;
      case '--update':
        parsed.mode = 'update';
        break;
      case '--dry-run':
        parsed.dryRun = true;
        break;
      case '--force':
        parsed.force = true;
        break;
      default:
        throw new Error(`unknown option: ${arg}`);
    }
  }
  return parsed;
}

function usage(): void {
  console.log(`Usage: wk sync [--install|--update|--dry-run] [--force]

  --install   Install skills from skills/external.lock.json (default)
  --update    Update lockfile skills in ~/.cursor/skills (not --all agents)
  --dry-run   Report actions without changing files
  --force     Pass --force to gh skill install (overwrite local copies)

Skills install to Cursor user scope (~/.cursor/skills), then Waykit symlinks
each skill into ~/.claude/skills and ~/.gemini/skills so Claude Code and
Antigravity see the same lockfile set. \`wk sync --update\` only refreshes
lockfile ids in the Cursor dir, then re-mirrors.
Lockfile pins are git version tags or \`latest\` (tagged release, then HEAD),
not commit SHAs. Upgrade path: edit the lockfile, re-run --install, or
run --update to pull upstream changes.

Requires: gh CLI v2.90+ with \`gh skill\` (preview). After a successful install or update (not --dry-run), \`wk\` also refreshes kit subagent stubs in ~/.cursor/agents and ~/.claude/agents.`);
}

export function syncExternalSkills(
  repoDir: string,
  args: string[],
  runner: CommandRunner = defaultCommandRunner
): number {
  let parsed: SyncArgs;
  try {
    parsed = parseSyncArgs(args);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`ERROR: ${message}`);
    usage();
    return 1;
  }

  if (parsed.help) {
    usage();
    return 0;
  }

  if (!runner.exists('gh')) {
    console.error('ERROR: gh CLI is required (https://cli.github.com/)');
    return 1;
  }
  if (!runner.skillAvailable()) {
    console.error('ERROR: gh skill is unavailable. Upgrade GitHub CLI to v2.90+.');
    return 1;
  }

  const lockFile = path.join(repoDir, 'skills', 'external.lock.json');
  let entries;
  try {
    entries = parseExternalLockFile(lockFile);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`ERROR: ${message}`);
    return 1;
  }

  if (entries.length === 0) {
    console.log(`No skills declared in ${lockFile}`);
    return 0;
  }

  if (parsed.mode === 'update') {
    const names = entries.map((e) => e.id);
    const cmd = ghSkillUpdateArgs(names, resolveUserSkillsDir(runner), parsed.dryRun);
    if (parsed.dryRun) {
      console.log(`DRY-RUN: gh ${cmd.join(' ')}`);
      runner.run('gh', cmd);
      return 0;
    }
    console.log(`Updating: ${names.join(' ')}`);
    const status = runner.run('gh', cmd).status;
    if (status !== 0) return status;
    mirrorAfterSync(runner);
    return 0;
  }

  for (const entry of entries) {
    const cmd = [
      'skill',
      'install',
      entry.repository,
      entry.skill,
      '--agent',
      entry.agent,
      '--scope',
      entry.scope,
      ...ghSkillPinArgs(entry.pin)
    ];
    if (parsed.force) cmd.push('--force');

    if (parsed.dryRun) {
      console.log(`DRY-RUN: gh ${cmd.join(' ')}`);
      continue;
    }

    console.log(`Installing ${entry.id} from ${entry.repository} (${entry.skill})`);
    const result = runner.run('gh', cmd);
    if (result.status !== 0) return result.status;
  }

  if (parsed.dryRun) return 0;

  mirrorAfterSync(runner);
  console.log('');
  console.log(`OK: external skills synced from ${lockFile}`);
    console.log('Upgrade later with: wk sync --update');
  return 0;
}

function mirrorAfterSync(runner: CommandRunner): void {
  const dests = runner.mirrorSkillDirs?.() ?? [];
  const linked = mirrorUserSkills(resolveUserSkillsDir(runner), dests);
  for (const dest of linked) {
    console.log(`Mirrored skill -> ${dest}`);
  }
}
