import { isTableDividerCell, stripSurroundingTicks } from '../../../kit/src/shared/text_parse';

export type KitCommandRow = {
  command: string;
  purpose: string;
};

export type KitCommands = {
  lead: string;
  rows: KitCommandRow[];
};

/** Landing CLI table. Source of truth is the ## Commands section in docs/kit.md. */
export function parseKitCommandsMarkdown(md: string): KitCommands {
  const section = extractCommandsSection(md);
  if (!section) return { lead: '', rows: [] };

  const lines = section.split('\n');
  const leadParts: string[] = [];
  const rows: KitCommandRow[] = [];
  let seenHeader = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('|')) {
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((cell) => cell.trim());
      if (cells.length < 2) continue;
      if (isTableDividerCell(cells[0] ?? '')) continue;
      if (!seenHeader) {
        seenHeader = true;
        continue;
      }
      const command = stripTicks(cells[0] ?? '');
      const purpose = cells[1] ?? '';
      if (command && purpose) rows.push({ command, purpose });
      continue;
    }
    if (seenHeader) continue;
    if (line.length === 0) continue;
    leadParts.push(line);
  }

  return { lead: leadParts.join(' '), rows };
}

function extractCommandsSection(md: string): string | null {
  const parts = md.split(/^## /m).slice(1);
  for (const part of parts) {
    const newline = part.indexOf('\n');
    const title = (newline === -1 ? part : part.slice(0, newline)).trim();
    if (title === 'Commands') return newline === -1 ? '' : part.slice(newline + 1);
  }
  return null;
}

function stripTicks(value: string): string {
  return stripSurroundingTicks(value);
}
