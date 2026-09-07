import { describe, expect, it } from 'vitest';
import { DOCS_PAGES } from '../docs/pages';
import { HOME_LEDE } from '../landing/copy';
import {
  SITE_MARK_SRC,
  SITE_NAME,
  SITE_ORIGIN,
  SITE_SHORT_NAME,
  SITE_SOCIAL_IMAGE,
  buildJsonLdGraph,
  buildSitemapXml,
  listIndexableSeoPaths,
  notFoundPageSeo,
  resolvePageSeo
} from './siteSeo';

const HUBS = [
  '/',
  '/docs',
  '/docs/start',
  '/docs/edd',
  '/docs/map',
  '/evals/edd',
  '/mcps'
] as const;

describe('siteSeo catalog', () => {
  it('resolves distinctive homepage metadata with the social share image', () => {
    const seo = resolvePageSeo('/');
    expect(seo.title.toLowerCase()).toContain('waykit');
    expect(seo.title.toLowerCase()).toMatch(/grill|lifecycle|spec/);
    expect(seo.description).toBe(HOME_LEDE);
    expect(seo.canonicalUrl).toBe(`${SITE_ORIGIN}/`);
    expect(seo.ogImageUrl).toBe(SITE_SOCIAL_IMAGE);
    expect(seo.indexable).toBe(true);
    expect(seo.ogType).toBe('website');
    expect(seo.softwareName).toBe(SITE_NAME);
    expect(SITE_SHORT_NAME).toBe('waykit');
    expect(SITE_NAME).toBe('Waykit');
    expect(SITE_MARK_SRC).toBe('/assets/kit-mark.svg');
  });

  it('gives each hub a unique title and description', () => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const path of HUBS) {
      const seo = resolvePageSeo(path);
      expect(seo.indexable).toBe(true);
      expect(seo.title.length).toBeGreaterThan(10);
      expect(seo.description.length).toBeGreaterThan(40);
      expect(seo.canonicalUrl.startsWith(SITE_ORIGIN)).toBe(true);
      titles.add(seo.title);
      descriptions.add(seo.description);
    }
    expect(titles.size).toBe(HUBS.length);
    expect(descriptions.size).toBe(HUBS.length);
  });

  it('covers every published docs page with a title and description', () => {
    for (const page of DOCS_PAGES) {
      const seo = resolvePageSeo(page.path, {
        headline: page.title,
        markdown: page.markdown,
        file: page.file
      });
      expect(seo.title.length).toBeGreaterThan(0);
      expect(seo.description.length).toBeGreaterThan(20);
      expect(seo.canonicalUrl).toBe(`${SITE_ORIGIN}${page.path}/`);
      expect(seo.markdownUrl).toBe(`${SITE_ORIGIN}/${page.file}`);
      expect(seo.ogType).toBe('article');
    }
  });

  it('derives SOP descriptions from the first markdown paragraph', () => {
    const seo = resolvePageSeo('/SOPs/context-budget', {
      headline: 'Context budget',
      markdown:
        '# Context budget\n\nAlways-on agent context is a budget, not a dump of every SOP.\n\n## Next\n'
    });
    expect(seo.description).toMatch(/always-on agent context is a budget/i);
    expect(seo.indexable).toBe(true);
    expect(seo.canonicalUrl).toBe(`${SITE_ORIGIN}/SOPs/context-budget/`);
    expect(seo.softwareName).toBeUndefined();
  });

  it('indexes the privacy notice', () => {
    const seo = resolvePageSeo('/privacy');
    expect(seo.indexable).toBe(true);
    expect(seo.headline).toBe('Privacy policy');
    expect(seo.canonicalUrl).toBe(`${SITE_ORIGIN}/privacy/`);
    expect(seo.description.toLowerCase()).toMatch(/posthog|cookieless/);
  });

  it('marks the review backlog and unknown routes as non-indexable', () => {
    const backlog = resolvePageSeo('/docs/kit-review-backlog', {
      headline: 'Backlog',
      markdown: '# Backlog\n\nInternal notes for maintainers.\n'
    });
    expect(backlog.indexable).toBe(false);

    const missing = resolvePageSeo('/not-a-real-page');
    expect(missing.indexable).toBe(false);
    expect(missing.title.toLowerCase()).toMatch(/not here|not found/);
  });

  it('builds a sitemap of indexable URLs and omits the backlog', () => {
    const paths = listIndexableSeoPaths([
      '/',
      '/docs/edd',
      '/SOPs/context-budget',
      '/docs/kit-review-backlog',
      '/workspace'
    ]);
    expect(paths).toEqual(['/', '/docs/edd', '/SOPs/context-budget']);
    const xml = buildSitemapXml(paths, '2026-09-02');
    expect(xml).toContain(`${SITE_ORIGIN}/`);
    expect(xml).toContain(`${SITE_ORIGIN}/docs/edd/`);
    expect(xml).toContain(`${SITE_ORIGIN}/SOPs/context-budget/`);
    expect(xml).not.toContain('kit-review-backlog');
    expect(xml).not.toContain('/workspace');
  });

  it('builds JSON-LD with Organization, WebSite, SoftwareApplication, and breadcrumbs', () => {
    const home = buildJsonLdGraph(resolvePageSeo('/'));
    expect(home['@context']).toBe('https://schema.org');
    const graph = home['@graph'] as Array<Record<string, unknown>>;
    const types = graph.map((node) => node['@type']);
    expect(types).toContain('Organization');
    expect(types).toContain('WebSite');
    expect(types).toContain('SoftwareApplication');
    expect(types).toContain('WebPage');

    const edd = buildJsonLdGraph(
      resolvePageSeo('/docs/edd', { headline: 'EDD guide', markdown: '# EDD\n\nEvals for agents.\n' })
    );
    const eddGraph = edd['@graph'] as Array<Record<string, unknown>>;
    const crumbs = eddGraph.find((node) => node['@type'] === 'BreadcrumbList');
    expect(crumbs).toBeTruthy();
    const items = crumbs?.itemListElement as Array<{ name: string; item: string }>;
    expect(items.some((item) => item.name === 'EDD guide' || item.name.includes('EDD'))).toBe(true);
    expect(items.find((item) => item.item.includes('/docs/edd'))?.item).toBe(`${SITE_ORIGIN}/docs/edd/`);
    expect(types.filter((type) => type === 'SoftwareApplication')).toHaveLength(1);
    const eddTypes = eddGraph.map((node) => node['@type']);
    expect(eddTypes).not.toContain('SoftwareApplication');
    expect(eddTypes).toContain('TechArticle');
  });

  it('describes GitHub Pages 404 shells as non-indexable', () => {
    const seo = notFoundPageSeo();
    expect(seo.indexable).toBe(false);
    expect(seo.canonicalUrl).toBe('');
    expect(seo.headline.toLowerCase()).toMatch(/not here|not found/);
  });
});
