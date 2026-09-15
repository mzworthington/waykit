import { splitDocsMarkdown } from './presentDocsMarkdown';
import { parseAtxHeading, slugifyHeading as slugifyHeadingText } from '../../../kit/src/shared/text_parse';

export const HEADING_ALIASES: Record<string, string> = {
  'what-do-i-use-this-for-today': 'today',
  'before-and-after-one-miss': 'proof',
  'install-kit': 'install',
  'install-waykit': 'install',
  'the-same-loop-you-already-use-for-code': 'edd',
  'run-it-locally': 'cli',
  'context-mcp-and-the-quality-gate': 'kit',
  'common-questions': 'faq',
  'feature-lifecycle': 'lifecycle',
  'was-this-kit-or-eval-drivendev': 'rename',
  'why-not-dump-everything-into-agentsmd': 'context'
};

export type DocsTocItem = {
  id: string;
  label: string;
  level: 2 | 3;
};

export function slugifyHeading(text: string): string {
  return slugifyHeadingText(text);
}

export function headingId(text: string, used: Map<string, number>): string {
  const base = slugifyHeading(text);
  const n = used.get(base) ?? 0;
  used.set(base, n + 1);
  const aliased = HEADING_ALIASES[base];
  if (n === 0 && aliased) return aliased;
  return n === 0 ? base : `${base}-${n}`;
}

/** Advance heading counters for ATX h1–h3 so split Markdown views share ids. */
export function consumeMarkdownHeadings(markdown: string, used: Map<string, number>): void {
  let inFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = parseAtxHeading(line, 1, 3);
    if (!match) continue;
    headingId(match.text, used);
  }
}

export function headingCountsRecord(used: Map<string, number>): Record<string, number> {
  return Object.fromEntries(used);
}

/** Visible h2/h3 ids for on-this-page nav. Skips fenced code. */
export function docsToc(markdown: string): DocsTocItem[] {
  const body = splitDocsMarkdown(markdown).body;
  const used = new Map<string, number>();
  const items: DocsTocItem[] = [];
  let inFence = false;
  for (const line of body.split(/\r?\n/)) {
    if (line.trimStart().startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = parseAtxHeading(line, 2, 3);
    if (!match) continue;
    const level = match.level as 2 | 3;
    const label = match.text;
    items.push({ id: headingId(label, used), label, level });
  }
  return items;
}
