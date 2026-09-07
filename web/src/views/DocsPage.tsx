import { DocsShell } from '../components/DocsShell';
import { MarkdownView } from '../components/MarkdownView';
import { docsNeighbors } from '../docs/nav';
import { docsToc } from '../docs/outline';
import { DOCS_PAGES, DOC_PATHS, findPublishedPage } from '../docs/pages';
import { resolvePageSeo } from '../seo/siteSeo';

type Props = {
  pathname: string;
};

export function DocsPage({ pathname }: Props) {
  const path = pathname.replace(/\/$/, '') || '/';
  const page = findPublishedPage(path);
  const navPages = DOCS_PAGES.map(({ path: pagePath, title }) => ({ path: pagePath, title }));
  const docPaths = [...DOC_PATHS];

  if (!page) {
    return (
      <DocsShell pathname={path} pages={navPages}>
        <article className="docs-panel">
          <h1>That page is not here</h1>
          <p>
            Try the <a href="/">home page</a> or the <a href="/docs">docs overview</a>.
          </p>
        </article>
      </DocsShell>
    );
  }

  const toc = docsToc(page.markdown).filter((item) => item.level === 2);
  const { prev, next } = docsNeighbors(page.path, navPages);
  const wide = page.path === '/docs/map';
  const crumbs = resolvePageSeo(page.path, {
    headline: page.title,
    markdown: page.markdown,
    file: page.file
  }).breadcrumbs;

  return (
    <DocsShell pathname={page.path} pages={navPages} wide={wide}>
      <article className={`docs-panel${wide ? ' docs-panel--wide' : ''}`}>
        {crumbs.length > 1 ? (
          <nav className="docs-breadcrumb" aria-label="Breadcrumb">
            <ol>
              {crumbs.map((crumb, index) => {
                const last = index === crumbs.length - 1;
                return (
                  <li key={crumb.path}>
                    {last ? (
                      <span aria-current="page">{crumb.name}</span>
                    ) : (
                      <a href={crumb.path}>{crumb.name}</a>
                    )}
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}
        <MarkdownView markdown={page.markdown} fromDir={page.dir} docPaths={docPaths} />
        {prev || next ? (
          <nav className="docs-pager" aria-label="Nearby pages">
            {prev ? (
              <a href={prev.path} className="docs-pager-prev">
                <span>Previous</span>
                {prev.label}
              </a>
            ) : (
              <span />
            )}
            {next ? (
              <a href={next.path} className="docs-pager-next">
                <span>Next</span>
                {next.label}
              </a>
            ) : null}
          </nav>
        ) : null}
        <p className="docs-source">
          <a href={`/${page.file}`}>Markdown source</a>
        </p>
      </article>
      {toc.length > 1 && !wide ? (
        <nav className="docs-toc" aria-label="On this page">
          <p className="docs-toc-title">On this page</p>
          <ol>
            {toc.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`}>{item.label}</a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
    </DocsShell>
  );
}
