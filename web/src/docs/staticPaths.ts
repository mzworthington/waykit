import { DOCS_PAGES } from './pages';
import type { DocsPageMeta } from './catalog';

export function docsStaticPaths(pages: readonly DocsPageMeta[] = DOCS_PAGES) {
  return pages.map((page) => ({
    params: { slug: page.path.replace(/^\//, '') },
    props: { page }
  }));
}
