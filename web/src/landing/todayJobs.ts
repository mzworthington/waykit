import { extractFencedBlock, parseDashMarkdownLink } from '../../../kit/src/shared/text_parse';

export type TodayJobAction = {
  label: string;
  href: string;
};

export type TodayJob = {
  id: string;
  title: string;
  blurb: string;
  why: string;
  steps: string[];
  cmd: string;
  actions: TodayJobAction[];
};

/** Jobs-page picker. Source of truth is docs/today-jobs.md. */
export function parseTodayJobsMarkdown(md: string): TodayJob[] {
  const jobs: TodayJob[] = [];
  const parts = String(md).split(/^## /m).slice(1);

  for (const part of parts) {
    const newline = part.indexOf('\n');
    const heading = (newline === -1 ? part : part.slice(0, newline)).trim();
    const sep = heading.indexOf('|');
    if (sep === -1) continue;

    const id = heading.slice(0, sep).trim();
    const title = heading.slice(sep + 1).trim();
    if (!id || !title) continue;

    const body = newline === -1 ? '' : part.slice(newline + 1);
    jobs.push({
      id,
      title,
      blurb: extractBlurb(body),
      why: extractWhy(body),
      steps: extractSteps(body),
      cmd: extractCommand(body),
      actions: extractActions(body)
    });
  }

  return jobs;
}

function extractBlurb(body: string): string {
  const match = body.match(/^>\s*.*(?:\n>\s*.*)*/m);
  if (!match) return '';
  return match[0]
    .split('\n')
    .map((line) => line.replace(/^>\s?/, ''))
    .join(' ')
    .trim();
}

function extractWhy(body: string): string {
  const lines = body.split('\n');
  const buf: string[] = [];
  let inFence = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    if (trimmed.startsWith('>')) {
      if (buf.length) break;
      continue;
    }
    if (/^\d+\.\s/.test(trimmed) || trimmed.startsWith('- [')) {
      if (buf.length) break;
      continue;
    }
    if (trimmed === '') {
      if (buf.length) break;
      continue;
    }
    buf.push(trimmed);
  }

  return buf.join(' ');
}

function extractSteps(body: string): string[] {
  const steps: string[] = [];
  for (const line of body.split('\n')) {
    const match = line.match(/^\s*\d+\.\s+(.+)/);
    if (match) steps.push(match[1].trim());
  }
  return steps;
}

function extractCommand(body: string): string {
  const fence = extractFencedBlock(body);
  if (!fence) return '';
  return fence.code.endsWith('\n') ? fence.code.slice(0, -1) : fence.code;
}

function extractActions(body: string): TodayJobAction[] {
  const actions: TodayJobAction[] = [];
  for (const line of body.split('\n')) {
    const item = parseDashMarkdownLink(line);
    if (item) actions.push(item);
  }
  return actions;
}
