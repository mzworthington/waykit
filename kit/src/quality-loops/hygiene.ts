export const WORK_TYPES = [
  'Bug',
  'Feature',
  'Performance',
  'UX',
  'Security',
  'Improvement'
] as const;

export type WorkType = (typeof WORK_TYPES)[number];

export type TicketStatusType = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled';

export interface HygieneTicket {
  id: string;
  title: string;
  body: string;
  statusType: TicketStatusType;
  labels: string[];
  createdAt?: string;
  fingerprint?: string;
  gatedPosthogBet?: boolean;
}

export type HygieneAction =
  | { type: 'skip'; ticketId: string; reason: 'completed' | 'canceled' | 'gated-posthog-bet' }
  | { type: 'keep-playable'; ticketId: string }
  | { type: 'mark-duplicate'; ticketId: string; of: string }
  | { type: 'relate-child'; ticketId: string; parentId: string }
  | { type: 'relate'; ticketId: string; otherId: string }
  | { type: 'rewrite'; ticketId: string; workType: WorkType; body: string }
  | { type: 'comment'; ticketId: string; body: string };

const STOP = new Set([
  'a',
  'an',
  'and',
  'as',
  'for',
  'from',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with'
]);

const FINGERPRINT_RE = /(?:fingerprint[:\s*`]*|`)((?:[a-z0-9._-]+:){2}[a-z0-9._:/-]+)/i;
const THEN_LINE_RE = /^[-*]\s*(?:\[[ x]\]\s*)?given\b.+\bthen\b.+/gim;

export function extractFingerprint(ticket: HygieneTicket): string | undefined {
  if (ticket.fingerprint?.trim()) return ticket.fingerprint.trim();
  const match = ticket.body.match(FINGERPRINT_RE);
  return match?.[1];
}

export function hasStory(body: string): boolean {
  return /\bas an?\b/i.test(body) && /\bi want\b/i.test(body) && /\bso that\b/i.test(body);
}

export function hasObservableThen(body: string): boolean {
  return /\bgiven\b/i.test(body) && /\bwhen\b/i.test(body) && /\bthen\b/i.test(body);
}

export function workTypeLabel(labels: string[]): WorkType | undefined {
  return WORK_TYPES.find((type) => labels.includes(type));
}

export function needsInvestRewrite(ticket: HygieneTicket): boolean {
  if (ticket.statusType !== 'backlog' && ticket.statusType !== 'unstarted') return false;
  return !hasStory(ticket.body) || !hasObservableThen(ticket.body) || !workTypeLabel(ticket.labels);
}

export function inferWorkType(ticket: HygieneTicket): WorkType | undefined {
  const labeled = workTypeLabel(ticket.labels);
  if (labeled) return labeled;
  const text = `${ticket.title}\n${ticket.body}`.toLowerCase();
  if (/\b(xss|csrf|cve|vulnerab|secret|authn|authz|injection)\b/.test(text)) return 'Security';
  if (/\b(lighthouse|latency|p95|slow|performance|cls|lcp)\b/.test(text)) return 'Performance';
  if (/\b(crash|fail|error|referenceerror|regression|broken|exception|500)\b/.test(text) || /error/i.test(text)) {
    return 'Bug';
  }
  if (/\b(ui copy|page layout|wireframe|a11y|accessibility|keyboard)\b/.test(text)) return 'UX';
  if (/\b(i want|capability|new flow|new screen)\b/.test(text) && /\bso that\b/.test(text)) {
    return 'Feature';
  }
  if (/\b(improve|docs|hygiene|maintain|cleanup|chore)\b/.test(text)) return 'Improvement';
  return undefined;
}

export function rewriteInvestBody(ticket: HygieneTicket, workType: WorkType): string {
  const fingerprint = extractFingerprint(ticket) ?? 'source:unknown:pending';
  const evidence = extractEvidence(ticket.body);
  const then = firstThen(ticket.body) ?? `the ${ticket.title.trim()} outcome is observable on the board`;
  return [
    '## Story',
    '',
    `As an operator, I want ${capabilityFromTitle(ticket.title)}, so that work is playable from the board.`,
    '',
    '## Hypothesis',
    '',
    'n/a — contract',
    '',
    '## Acceptance criteria',
    '',
    `- [ ] Given the reported gap is still present, when the fix ships, then ${then}.`,
    '',
    '## Out of scope',
    '',
    '* Playing this ticket from the hygiene pass',
    '* Opening a PR from hygiene',
    '',
    '## Notes',
    '',
    `Fingerprint: \`${fingerprint}\``,
    `Work type: ${workType}`,
    evidence ? `Evidence:\n${evidence}` : 'Rewritten by backlog hygiene.'
  ].join('\n');
}

export function planBacklogHygiene(tickets: HygieneTicket[]): HygieneAction[] {
  const actions: HygieneAction[] = [];
  const skipped = new Set<string>();

  for (const ticket of tickets) {
    if (ticket.statusType === 'completed') {
      actions.push({ type: 'skip', ticketId: ticket.id, reason: 'completed' });
      skipped.add(ticket.id);
      continue;
    }
    if (ticket.statusType === 'canceled') {
      actions.push({ type: 'skip', ticketId: ticket.id, reason: 'canceled' });
      skipped.add(ticket.id);
      continue;
    }
    if (ticket.gatedPosthogBet || isGatedPosthogBet(ticket)) {
      actions.push({ type: 'skip', ticketId: ticket.id, reason: 'gated-posthog-bet' });
      skipped.add(ticket.id);
    }
  }

  const open = tickets.filter((ticket) => !skipped.has(ticket.id));
  const used = new Set<string>();

  for (let i = 0; i < open.length; i += 1) {
    const left = open[i]!;
    if (used.has(left.id)) continue;
    for (let j = i + 1; j < open.length; j += 1) {
      const right = open[j]!;
      if (used.has(right.id)) continue;
      const decision = pairDecision(left, right);
      if (decision === 'unsure') {
        actions.push({
          type: 'comment',
          ticketId: left.id,
          body: `Hygiene is unsure whether ${right.id} is the same work. Left both open.`
        });
        used.add(left.id);
        used.add(right.id);
        continue;
      }
      if (decision === 'duplicate') {
        const { survivor, duplicate } = pickSurvivor(left, right);
        actions.push({ type: 'keep-playable', ticketId: survivor.id });
        actions.push({ type: 'mark-duplicate', ticketId: duplicate.id, of: survivor.id });
        used.add(left.id);
        used.add(right.id);
        continue;
      }
      if (decision === 'child') {
        const parent = isRicher(left, right) ? left : right;
        const child = parent.id === left.id ? right : left;
        actions.push({ type: 'relate-child', ticketId: child.id, parentId: parent.id });
        used.add(child.id);
        continue;
      }
      if (decision === 'relate') {
        actions.push({ type: 'relate', ticketId: right.id, otherId: left.id });
        used.add(right.id);
      }
    }
  }

  for (const ticket of open) {
    if (used.has(ticket.id) && actions.some((action) => action.ticketId === ticket.id && action.type === 'mark-duplicate')) {
      continue;
    }
    if (!needsInvestRewrite(ticket)) continue;
    const workType = inferWorkType(ticket);
    if (!workType) {
      if (!actions.some((action) => action.ticketId === ticket.id && action.type === 'comment')) {
        actions.push({
          type: 'comment',
          ticketId: ticket.id,
          body: 'Hygiene is unsure which Work type fits. Left the ticket open; did not cancel.'
        });
      }
      continue;
    }
    actions.push({
      type: 'rewrite',
      ticketId: ticket.id,
      workType,
      body: rewriteInvestBody(ticket, workType)
    });
  }

  return actions;
}

function isGatedPosthogBet(ticket: HygieneTicket): boolean {
  return /mzw-58/i.test(ticket.body) && /\bgated\b/i.test(ticket.body);
}

function pairDecision(left: HygieneTicket, right: HygieneTicket): 'duplicate' | 'child' | 'relate' | 'unsure' | 'none' {
  const sameFingerprint = Boolean(
    extractFingerprint(left) && extractFingerprint(left) === extractFingerprint(right)
  );
  const titleScore = jaccard(tokens(left.title), tokens(right.title));
  const bodyScore = jaccard(tokens(left.body), tokens(right.body));
  const nearDuplicate = (titleScore >= 0.75 && bodyScore >= 0.7) || (titleScore >= 0.8 && bodyScore >= 0.55);
  const similar = titleScore >= 0.5 || shareFingerprintFamily(left, right);

  if ((sameFingerprint || nearDuplicate) && acceptanceCriteriaDisagree(left, right)) {
    return 'relate';
  }
  if (sameFingerprint || nearDuplicate) return 'duplicate';
  if (similar && bodyScore < 0.25 && titleScore < 0.7) return 'unsure';
  if (similar && (isRicher(left, right) || isRicher(right, left))) return 'child';
  if (similar) return 'relate';
  return 'none';
}

function pickSurvivor(
  left: HygieneTicket,
  right: HygieneTicket
): { survivor: HygieneTicket; duplicate: HygieneTicket } {
  if (isRicher(left, right)) return { survivor: left, duplicate: right };
  if (isRicher(right, left)) return { survivor: right, duplicate: left };
  if ((left.createdAt ?? '') <= (right.createdAt ?? '')) {
    return { survivor: left, duplicate: right };
  }
  return { survivor: right, duplicate: left };
}

function isRicher(left: HygieneTicket, right: HygieneTicket): boolean {
  const leftScore =
    Number(hasStory(left.body)) + Number(hasObservableThen(left.body)) + Number(Boolean(workTypeLabel(left.labels)));
  const rightScore =
    Number(hasStory(right.body)) + Number(hasObservableThen(right.body)) + Number(Boolean(workTypeLabel(right.labels)));
  return leftScore > rightScore;
}

function shareFingerprintFamily(left: HygieneTicket, right: HygieneTicket): boolean {
  const a = extractFingerprint(left);
  const b = extractFingerprint(right);
  if (!a || !b) return false;
  const aParts = a.split(':');
  const bParts = b.split(':');
  return aParts.length >= 2 && aParts[0] === bParts[0] && aParts[1] === bParts[1];
}

function acceptanceCriteriaDisagree(left: HygieneTicket, right: HygieneTicket): boolean {
  const leftThens = thenLines(left.body);
  const rightThens = thenLines(right.body);
  if (leftThens.length === 0 || rightThens.length === 0) return false;
  return jaccard(leftThens, rightThens) < 0.6;
}

function thenLines(body: string): string[] {
  return [...body.matchAll(THEN_LINE_RE)].map((match) => match[0].toLowerCase());
}

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2 && !STOP.has(token));
}

function jaccard(left: string[], right: string[]): number {
  const a = new Set(left);
  const b = new Set(right);
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const token of a) if (b.has(token)) inter += 1;
  return inter / (a.size + b.size - inter);
}

function capabilityFromTitle(title: string): string {
  const trimmed = title.trim().replace(/[.]+$/, '');
  return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

function firstThen(body: string): string | undefined {
  const match = body.match(/\bthen\s+(.+)/i);
  return match?.[1]?.replace(/[.]+$/, '').trim();
}

function extractEvidence(body: string): string | undefined {
  const match = body.match(/## Evidence\n+([\s\S]+?)(?:\n## |\n*$)/i);
  return match?.[1]?.trim();
}
