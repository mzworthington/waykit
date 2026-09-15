export function parseNumberedHeading(line: string): { id: string; title: string } | null {
  let i = 0;
  while (i < line.length && line[i]! >= '0' && line[i]! <= '9') i += 1;
  if (i === 0 || line[i] !== '.') return null;
  const id = line.slice(0, i);
  i += 1;
  if (line[i] !== ' ' && line[i] !== '\t') return null;
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i += 1;
  return { id, title: line.slice(i) };
}

export function slugifyAscii(title: string): string {
  const chars: string[] = [];
  let dash = false;
  for (const raw of title.toLowerCase()) {
    const code = raw.charCodeAt(0);
    const alnum = (code >= 97 && code <= 122) || (code >= 48 && code <= 57);
    if (alnum) {
      chars.push(raw);
      dash = false;
    } else if (chars.length > 0 && !dash) {
      chars.push('-');
      dash = true;
    }
  }
  if (chars.at(-1) === '-') chars.pop();
  return chars.join('');
}

export function stripSurroundingTicks(value: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === '`') start += 1;
  while (end > start && value[end - 1] === '`') end -= 1;
  return value.slice(start, end);
}

export function parseAtxHeading(line: string, minLevel: number, maxLevel: number): { level: number; text: string } | null {
  let level = 0;
  while (level < line.length && line[level] === '#') level += 1;
  if (level < minLevel || level > maxLevel) return null;
  if (line[level] !== ' ' && line[level] !== '\t') return null;
  return { level, text: line.slice(level).trim() };
}

export function stripMarkdownLinks(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === '[') {
      const close = text.indexOf(']', i + 1);
      const openParen = close >= 0 ? close + 1 : -1;
      if (close >= 0 && text[openParen] === '(') {
        const closeParen = text.indexOf(')', openParen + 1);
        if (closeParen >= 0) {
          out += text.slice(i + 1, close);
          i = closeParen + 1;
          continue;
        }
      }
    }
    out += text[i];
    i += 1;
  }
  return out;
}

export function markdownLinkTargets(text: string): string[] {
  const targets: string[] = [];
  let i = 0;
  while (i < text.length) {
    if (text[i] === '[') {
      const close = text.indexOf(']', i + 1);
      const openParen = close >= 0 ? close + 1 : -1;
      if (close >= 0 && text[openParen] === '(') {
        const closeParen = text.indexOf(')', openParen + 1);
        if (closeParen >= 0) {
          const href = text.slice(openParen + 1, closeParen);
          const hash = href.indexOf('#');
          targets.push((hash >= 0 ? href.slice(0, hash) : href).trim());
          i = closeParen + 1;
          continue;
        }
      }
    }
    i += 1;
  }
  return targets;
}

export function firstMarkdownHeading(markdown: string): string | null {
  for (const line of markdown.split('\n')) {
    const heading = parseAtxHeading(line, 1, 1);
    if (heading) return heading.text;
  }
  return null;
}

export function firstBraceSlice(text: string): string | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return text.slice(start, end + 1);
}

export function extractFencedBlock(text: string): { code: string; before: string; after: string } | null {
  const open = text.indexOf('```');
  if (open < 0) return null;
  const afterTicks = open + 3;
  const nl = text.indexOf('\n', afterTicks);
  if (nl < 0) return null;
  const close = text.indexOf('```', nl + 1);
  if (close < 0) return null;
  return {
    code: text.slice(nl + 1, close),
    before: text.slice(0, open),
    after: text.slice(close + 3)
  };
}

export function parseDashMarkdownLink(line: string): { label: string; href: string } | null {
  let i = 0;
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i += 1;
  if (line[i] !== '-') return null;
  i += 1;
  while (i < line.length && (line[i] === ' ' || line[i] === '\t')) i += 1;
  if (line[i] !== '[') return null;
  const close = line.indexOf(']', i + 1);
  if (close < 0 || line[close + 1] !== '(') return null;
  const endHref = line.indexOf(')', close + 2);
  if (endHref < 0) return null;
  return { label: line.slice(i + 1, close), href: line.slice(close + 2, endHref) };
}

export function trimTrailingPunct(s: string): string {
  let end = s.length;
  while (end > 0) {
    const ch = s[end - 1];
    if (ch !== '.' && ch !== '?' && ch !== '!') break;
    end -= 1;
  }
  return s.slice(0, end);
}

export function stripMarkdownDecorations(text: string): string {
  let out = '';
  for (const ch of text) {
    if (ch === '*' || ch === '_' || ch === '`' || ch === '>' || ch === '#') continue;
    out += ch;
  }
  return out;
}

export function collapseSpaces(text: string): string {
  const parts: string[] = [];
  let buf = '';
  for (const ch of text) {
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      if (buf) {
        parts.push(buf);
        buf = '';
      }
    } else {
      buf += ch;
    }
  }
  if (buf) parts.push(buf);
  return parts.join(' ');
}

export function trimIncompleteLastWord(text: string): string {
  const lastSpace = text.lastIndexOf(' ');
  if (lastSpace <= 0) return text;
  return text.slice(0, lastSpace);
}

export function slugifyHeading(text: string): string {
  let cleaned = '';
  for (const ch of text.toLowerCase()) {
    const code = ch.charCodeAt(0);
    const word =
      (code >= 97 && code <= 122) ||
      (code >= 48 && code <= 57) ||
      ch === '_' ||
      ch === '-' ||
      ch === ' ' ||
      ch === '\t';
    if (word) cleaned += ch;
  }
  return collapseSpaces(cleaned.trim()).split(' ').join('-');
}

export function isTableDividerCell(cell: string): boolean {
  if (cell.length < 3) return false;
  for (const ch of cell) {
    if (ch !== '-') return false;
  }
  return true;
}
