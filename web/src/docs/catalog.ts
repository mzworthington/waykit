import { firstMarkdownHeading } from '../../../kit/src/shared/text_parse';

export type DocsPageMeta = {
  /** Repo-relative markdown path, e.g. `docs/edd.md`. */
  file: string;
  /** In-app path without trailing slash, e.g. `/docs/edd`. */
  path: string;
  title: string;
  markdown: string;
  /** Directory of the markdown file, e.g. `docs/ADRs`. */
  dir: string;
};

const EXCLUDED = /^(docs\/home\.md|docs\/landing\/|docs\/today-jobs\.md)/;

/** Vite/Astro glob keys → repo-relative posix path. */
export function globKeyToRel(key: string): string {
  const rel = key
    .split(/[/\\]/)
    .filter((part) => part !== '' && part !== '.' && part !== '..')
    .join('/');
  const markers = ['docs/', 'SOPs/', 'evals/', 'mcps/', 'ontology/'];
  for (const marker of markers) {
    const at = rel.indexOf(marker);
    if (at >= 0) return rel.slice(at);
  }
  return rel;
}

export function fileToRoute(file: string): string {
  let route = `/${file.replace(/\.md$/i, '')}`;
  if (route.endsWith('/README') || route.endsWith('/index')) {
    route = route.replace(/\/(README|index)$/i, '') || '/';
  }
  return route.replace(/\/$/, '') || '/';
}

export function titleFromMarkdown(markdown: string, fallback: string): string {
  return firstMarkdownHeading(markdown) || fallback;
}

export function shouldPublishMarkdown(file: string): boolean {
  return !EXCLUDED.test(file.replace(/\\/g, '/'));
}

export function buildDocsCatalog(files: Record<string, string>): DocsPageMeta[] {
  const pages: DocsPageMeta[] = [];
  for (const [rawKey, markdown] of Object.entries(files)) {
    const file = globKeyToRel(rawKey);
    if (!shouldPublishMarkdown(file)) continue;
    const path = fileToRoute(file);
    if (path === '/') continue;
    const dir = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : '';
    const fallback = file.replace(/\.md$/i, '').split('/').pop() || file;
    pages.push({
      file,
      path,
      title: titleFromMarkdown(markdown, fallback),
      markdown,
      dir
    });
  }
  return pages.sort((a, b) => a.path.localeCompare(b.path));
}

export function findDocsPage(
  pages: readonly DocsPageMeta[],
  pathname: string
): DocsPageMeta | undefined {
  const normalized = pathname.replace(/\/$/, '') || '/';
  return pages.find((page) => page.path === normalized);
}
