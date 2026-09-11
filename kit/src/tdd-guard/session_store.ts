import fs from 'node:fs';
import path from 'node:path';
import type { TestOutcome } from './decide_write.js';

export interface TddGuardState {
  disabled: boolean;
  lastTestOutcome?: TestOutcome;
  lastTestCommand?: string;
  lastTestAt?: string;
}

export function tddGuardDir(projectRoot: string): string {
  return path.join(projectRoot, '.waykit', 'tdd-guard');
}

export function tddGuardStatePath(projectRoot: string): string {
  return path.join(tddGuardDir(projectRoot), 'state.json');
}

export function loadTddGuardState(projectRoot: string): TddGuardState {
  const file = tddGuardStatePath(projectRoot);
  if (!fs.existsSync(file)) return { disabled: false };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<TddGuardState>;
    return {
      disabled: parsed.disabled === true,
      lastTestOutcome: parsed.lastTestOutcome,
      lastTestCommand: parsed.lastTestCommand,
      lastTestAt: parsed.lastTestAt
    };
  } catch {
    return { disabled: false };
  }
}

export function saveTddGuardState(projectRoot: string, state: TddGuardState): void {
  const dir = tddGuardDir(projectRoot);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(tddGuardStatePath(projectRoot), `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

export function setTddGuardDisabled(projectRoot: string, disabled: boolean): TddGuardState {
  const next = { ...loadTddGuardState(projectRoot), disabled };
  saveTddGuardState(projectRoot, next);
  return next;
}
