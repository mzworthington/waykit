import { describe, expect, it } from 'vitest';
import {
  DOC_PATHS,
  DOCS_PAGES,
  findPublishedPage
} from './pages';
import {
  SITE_NAV,
  docsNeighbors,
  docsReadingOrder,
  docsSidebar,
  isDocsNavActive
} from './nav';

const navPages = DOCS_PAGES.map(({ path, title }) => ({ path, title }));

describe('published markdown catalog', () => {
  it('registers operator docs, SOPs, and ADRs from the glob', () => {
    expect(DOC_PATHS.has('/docs/edd')).toBe(true);
    expect(DOC_PATHS.has('/docs/hosts')).toBe(true);
    expect(DOC_PATHS.has('/docs/subagents')).toBe(true);
    expect(DOC_PATHS.has('/docs/kit')).toBe(true);
    expect(DOC_PATHS.has('/docs/doctor')).toBe(true);
    expect(DOC_PATHS.has('/docs/align')).toBe(true);
    expect(DOC_PATHS.has('/docs/used-in')).toBe(true);
    expect(DOC_PATHS.has('/SOPs/context-budget')).toBe(true);
    expect(DOC_PATHS.has('/docs/ADRs/0006-vite-markdown-docs-site')).toBe(true);
    expect(DOC_PATHS.has('/docs/ADRs/0007-astro-static-docs-site')).toBe(true);
    expect(findPublishedPage('/docs/home')).toBeUndefined();
    expect(findPublishedPage('/docs/edd')?.title).toMatch(/EDD|Eval/i);
    expect(findPublishedPage('/ontology')?.title).toBe('Author the Waykit map');
  });
});

describe('site information architecture', () => {
  it('keeps header hubs to Start, Guide, and Map', () => {
    expect(SITE_NAV.map((item) => item.label)).toEqual(['Start', 'Guide', 'Map']);
  });

  it('marks Guide for operator pages without stealing Start or Map', () => {
    const guide = SITE_NAV.find((item) => item.label === 'Guide')!;
    const start = SITE_NAV.find((item) => item.label === 'Start')!;
    const map = SITE_NAV.find((item) => item.label === 'Map')!;
    expect(isDocsNavActive('/docs', guide)).toBe(true);
    expect(isDocsNavActive('/docs/edd', guide)).toBe(true);
    expect(isDocsNavActive('/docs/align', guide)).toBe(true);
    expect(isDocsNavActive('/docs/used-in', guide)).toBe(true);
    expect(isDocsNavActive('/docs/ADRs/0007-astro-static-docs-site', guide)).toBe(true);
    expect(isDocsNavActive('/docs/start', guide)).toBe(false);
    expect(isDocsNavActive('/docs/start', start)).toBe(true);
    expect(isDocsNavActive('/docs/map', map)).toBe(true);
    expect(isDocsNavActive('/ontology', map)).toBe(true);
    expect(isDocsNavActive('/docs/map', guide)).toBe(false);
  });

  it('uses a curated sidebar and expands procedures on SOP routes', () => {
    const overview = docsSidebar('/docs', navPages);
    expect(overview.map((section) => section.title)).toEqual(['Start', 'Practice', 'Reference']);
    expect(overview[0]?.items[0]).toEqual({ label: 'Overview', path: '/docs' });

    const sopNav = docsSidebar('/SOPs/context-budget', navPages);
    expect(sopNav.some((section) => section.title === 'Procedures')).toBe(true);
    expect(
      sopNav.flatMap((section) => section.items).some((item) => item.path === '/SOPs/context-budget')
    ).toBe(true);
  });

  it('walks prev/next along the curated reading order', () => {
    const fromStart = docsNeighbors('/docs/start', navPages);
    expect(fromStart.prev?.path).toBe('/docs');
    expect(fromStart.next?.path).toBe('/docs/jobs');
    const order = docsReadingOrder(navPages);
    expect(order.slice(0, 4)).toEqual(['/docs', '/docs/start', '/docs/jobs', '/docs/faq']);
  });
});

describe('docsStaticPaths', () => {
  it('emits a rest slug for every published markdown page', async () => {
    const { docsStaticPaths } = await import('./staticPaths');
    const paths = docsStaticPaths();
    expect(paths.some((entry) => entry.params.slug === 'docs/start')).toBe(true);
    expect(paths.some((entry) => entry.params.slug === 'ontology')).toBe(true);
    expect(paths.every((entry) => entry.params.slug.length > 0)).toBe(true);
  });
});
