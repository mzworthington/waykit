import { buildDocsCatalog, type DocsPageMeta, findDocsPage } from './catalog';

const markdownModules = import.meta.glob(
  [
    '../../../docs/**/*.md',
    '../../../SOPs/*.md',
    '../../../evals/edd/**/*.md',
    '../../../mcps/README.md',
    '../../../ontology/README.md'
  ],
  { query: '?raw', eager: true, import: 'default' }
) as Record<string, string>;

/** Server-only catalog. Do not import this module from client islands. */
export const DOCS_PAGES: DocsPageMeta[] = buildDocsCatalog(markdownModules);

export const DOC_PATHS = new Set(DOCS_PAGES.map((page) => page.path));

export function findPublishedPage(pathname: string): DocsPageMeta | undefined {
  return findDocsPage(DOCS_PAGES, pathname);
}
