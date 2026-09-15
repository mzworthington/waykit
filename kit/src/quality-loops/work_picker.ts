import { parse as parseYaml } from 'yaml';

export type WorkPickerAllowlist = {
  auto_play: readonly string[];
  wait_unless_auto_work: readonly string[];
  block: readonly string[];
  override: readonly string[];
};

export type BoardTicket = {
  id: string;
  state: string;
  workType: string;
  labels: readonly string[];
};

export type PlayRole = 'agent-debug' | 'agent-security' | 'agent-perf-opt' | 'write-role';

export type WorkPick =
  | {
      action: 'claim';
      ticketId: string;
      assign: 'host-agent';
      playRole: PlayRole;
      pr: 'draft';
      merge: false;
      forcePush: false;
      skipHooks: false;
    }
  | { action: 'none' };

const READY = new Set(['Backlog', 'Todo']);

function stringList(value: unknown, key: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`work-picker allowlist ${key} must be a string list`);
  }
  return value;
}

export function parseWorkPickerAllowlist(raw: string): WorkPickerAllowlist {
  const parsed = parseYaml(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('work-picker allowlist must be a mapping');
  }
  const record = parsed as Record<string, unknown>;
  return {
    auto_play: stringList(record.auto_play, 'auto_play'),
    wait_unless_auto_work: stringList(record.wait_unless_auto_work, 'wait_unless_auto_work'),
    block: stringList(record.block, 'block'),
    override: stringList(record.override, 'override')
  };
}

function hasAny(labels: readonly string[], names: readonly string[]): boolean {
  return labels.some((label) => names.includes(label));
}

function playRoleFor(workType: string): PlayRole {
  if (workType === 'Bug') return 'agent-debug';
  if (workType === 'Security') return 'agent-security';
  if (workType === 'Performance') return 'agent-perf-opt';
  return 'write-role';
}

function isPlayable(ticket: BoardTicket, allowlist: WorkPickerAllowlist): boolean {
  if (!READY.has(ticket.state)) return false;
  if (hasAny(ticket.labels, allowlist.block)) return false;
  if (hasAny(ticket.labels, allowlist.override)) return true;
  return allowlist.auto_play.includes(ticket.workType);
}

export type WorkPassPlan = {
  failingTestFirst: true;
  confirmRed: true;
  smallestChange: true;
  pr: 'draft';
  merge: false;
  forcePush: false;
  skipHooks: false;
  beforeComplete: 'repo-pre-commit-hook' | 'n/a';
  pathFilteredTest: false;
  ignoreCiLogInstructions: true;
};

export function planWorkPass(input: { filesChanged: boolean }): WorkPassPlan {
  return {
    failingTestFirst: true,
    confirmRed: true,
    smallestChange: true,
    pr: 'draft',
    merge: false,
    forcePush: false,
    skipHooks: false,
    beforeComplete: input.filesChanged ? 'repo-pre-commit-hook' : 'n/a',
    pathFilteredTest: false,
    ignoreCiLogInstructions: true
  };
}

export function pickWork(
  tickets: readonly BoardTicket[],
  allowlist: WorkPickerAllowlist
): WorkPick {
  const chosen = tickets.find((ticket) => isPlayable(ticket, allowlist));
  if (!chosen) return { action: 'none' };
  return {
    action: 'claim',
    ticketId: chosen.id,
    assign: 'host-agent',
    playRole: playRoleFor(chosen.workType),
    pr: 'draft',
    merge: false,
    forcePush: false,
    skipHooks: false
  };
}
