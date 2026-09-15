import type { ReactNode } from 'react';

function nextInlineToken(text: string, from: number): { start: number; end: number } | null {
  let best: { start: number; end: number } | null = null;
  const consider = (start: number, end: number) => {
    if (start < from || end <= start) return;
    if (!best || start < best.start) best = { start, end };
  };

  const linkOpen = text.indexOf('[', from);
  if (linkOpen >= 0) {
    const close = text.indexOf(']', linkOpen + 1);
    if (close >= 0 && text[close + 1] === '(') {
      const endHref = text.indexOf(')', close + 2);
      if (endHref >= 0) consider(linkOpen, endHref + 1);
    }
  }

  const tick = text.indexOf('`', from);
  if (tick >= 0) {
    const tick2 = text.indexOf('`', tick + 1);
    if (tick2 >= 0) consider(tick, tick2 + 1);
  }

  const bold = text.indexOf('**', from);
  if (bold >= 0) {
    const bold2 = text.indexOf('**', bold + 2);
    if (bold2 >= 0) consider(bold, bold2 + 2);
  }

  return best;
}

/** Turn a short markdown phrase into nodes. Links and code only. */
export function presentInlineMarkdown(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < text.length) {
    const token = nextInlineToken(text, i);
    if (!token) {
      parts.push(text.slice(i));
      break;
    }
    if (token.start > i) parts.push(text.slice(i, token.start));
    const part = text.slice(token.start, token.end);
    if (part.startsWith('[') && part.includes('](') && part.endsWith(')')) {
      const close = part.indexOf(']');
      const href = part.slice(close + 2, -1);
      const label = part.slice(1, close);
      parts.push(
        <a key={key} href={href}>
          {label}
        </a>
      );
    } else if (part.startsWith('`') && part.endsWith('`')) {
      parts.push(<code key={key}>{part.slice(1, -1)}</code>);
    } else if (part.startsWith('**') && part.endsWith('**')) {
      parts.push(<strong key={key}>{part.slice(2, -2)}</strong>);
    } else {
      parts.push(part);
    }
    key += 1;
    i = token.end;
  }
  return parts;
}
