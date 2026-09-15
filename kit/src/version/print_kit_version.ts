import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { cliOutcomeShouldColor, formatCliOutcome, type CliOutcome } from '../cli/outcome.js';
import { trustedBin, trustedSpawnEnv } from '../shared/trusted_bin.js';
import {
  formatKitVersion,
  isOriginWeeksAhead,
  kitVersionOutcome,
  type KitVersionSnapshot,
  type StaleCheck
} from './kit_version.js';

function git(repoDir: string, args: string[]): string | undefined {
  const result = spawnSync(trustedBin('git'), args, {
    encoding: 'utf8',
    cwd: repoDir,
    env: trustedSpawnEnv()
  });
  if (result.status !== 0) return undefined;
  const out = (result.stdout ?? '').trim();
  return out || undefined;
}

function readPackageVersion(kitRepoDir: string): string {
  try {
    const raw = fs.readFileSync(path.join(kitRepoDir, 'package.json'), 'utf8');
    const pkg = JSON.parse(raw) as { version?: unknown };
    return typeof pkg.version === 'string' && pkg.version.length > 0 ? pkg.version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

function inspectAgents(kitRepoDir: string, homedir: string): Pick<
  KitVersionSnapshot,
  'agentsPath' | 'agentsIsSymlink' | 'agentsResolvesToKit'
> {
  const agentsPath = path.join(homedir, '.agents');
  try {
    const st = fs.lstatSync(agentsPath);
    if (!st.isSymbolicLink()) {
      return { agentsPath, agentsIsSymlink: false, agentsResolvesToKit: false };
    }
    const resolvedAgents = fs.realpathSync(agentsPath);
    const resolvedKit = fs.realpathSync(kitRepoDir);
    return {
      agentsPath,
      agentsIsSymlink: true,
      agentsResolvesToKit: resolvedAgents === resolvedKit
    };
  } catch {
    return { agentsPath, agentsIsSymlink: false, agentsResolvesToKit: false };
  }
}

export function readKitVersionSnapshot(kitRepoDir: string, homedir: string = os.homedir()): KitVersionSnapshot {
  const inspect = inspectAgents(kitRepoDir, homedir);
  return {
    packageVersion: readPackageVersion(kitRepoDir),
    gitDescribe: git(kitRepoDir, ['describe', '--tags', '--always', '--dirty']),
    kitRepoDir,
    ...inspect
  };
}

export function readStaleCheck(kitRepoDir: string): StaleCheck {
  const aheadRaw = git(kitRepoDir, ['rev-list', '--count', 'HEAD..@{upstream}']);
  const aheadCount = aheadRaw !== undefined ? Number.parseInt(aheadRaw, 10) : 0;
  const localTip = git(kitRepoDir, ['log', '-1', '--format=%ct']);
  const originTip = git(kitRepoDir, ['log', '-1', '--format=%ct', '@{upstream}']);
  return {
    aheadCount: Number.isFinite(aheadCount) ? aheadCount : 0,
    localTipUnix: localTip !== undefined ? Number.parseInt(localTip, 10) : undefined,
    originTipUnix: originTip !== undefined ? Number.parseInt(originTip, 10) : undefined
  };
}

export function printKitVersion(opts: {
  kitRepoDir: string;
  homedir?: string;
  check: boolean;
  log?: (msg: string) => void;
}): CliOutcome {
  const log = opts.log ?? console.log;
  const snap = readKitVersionSnapshot(opts.kitRepoDir, opts.homedir ?? os.homedir());
  const stale = opts.check ? isOriginWeeksAhead(readStaleCheck(opts.kitRepoDir)) : false;
  const { outcome, summary } = kitVersionOutcome(snap, stale);
  log(formatCliOutcome(outcome, 'version', summary, { color: cliOutcomeShouldColor() }));
  log(formatKitVersion(snap, { stale }).trimEnd());
  return outcome;
}
