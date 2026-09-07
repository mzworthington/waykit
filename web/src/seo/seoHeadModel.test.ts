import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { seoHeadModel } from './siteSeo';
import { resolvePageSeo } from './siteSeo';

describe('seoHeadModel', () => {
  it('maps title, description, canonical, robots, and social tags', () => {
    const head = seoHeadModel(resolvePageSeo('/docs/start'));
    expect(head.title.toLowerCase()).toMatch(/getting started/);
    expect(head.description.length).toBeGreaterThan(40);
    expect(head.canonicalUrl).toBe('https://waykit.dev/docs/start/');
    expect(head.robots).toBe('index,follow');
    expect(head.ogType).toBe('article');
    expect(head.ogTitle).toBe(head.title);
    expect(head.ogImageWidth).toBe(1200);
    expect(head.ogImageHeight).toBe(630);
    expect(head.ogImageAlt.toLowerCase()).toMatch(/lifecycle/);
    expect(head.ogImageAlt.toLowerCase()).toMatch(/waykit/);
    expect(head.twitterImageAlt).toBe(head.ogImageAlt);
    expect(JSON.stringify(head.jsonLd)).toContain('TechArticle');
    expect(JSON.stringify(head.jsonLd)).not.toContain('SoftwareApplication');
  });

  it('sets noindex and skips JSON-LD on unknown routes', () => {
    const head = seoHeadModel(resolvePageSeo('/missing'));
    expect(head.robots).toBe('noindex,nofollow');
    expect(head.jsonLd).toBeUndefined();
    expect(head.canonicalUrl).toBeUndefined();
  });

  it('declares a root ICO favicon and a PNG fallback in the site layout', () => {
    const layout = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../layouts/SiteLayout.astro'),
      'utf8'
    );
    expect(layout).toContain('rel="icon" href="/favicon.ico"');
    expect(layout).toContain('type="image/png" href="/assets/favicon-32.png"');
    expect(layout).toContain('rel="apple-touch-icon" href="/assets/apple-touch-icon.png"');
    expect(layout).not.toMatch(/rel="icon"[^>]+type="image\/webp"/);
  });

  it('shows waykit in the header and keeps the full name for assistive tech', () => {
    const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../components');
    const chrome = fs.readFileSync(path.join(dir, 'SiteChrome.astro'), 'utf8');
    const shell = fs.readFileSync(path.join(dir, 'DocsShell.tsx'), 'utf8');
    for (const source of [chrome, shell]) {
      expect(source).toContain('aria-label={SITE_NAME}');
      expect(source).toContain('{SITE_SHORT_NAME}');
      expect(source).toContain('SITE_MARK_SRC');
      expect(source).toContain('SITE_FOOTER_NAV');
    }
  });

  it('exposes markdown source as an alternate for published pages', () => {
    const head = seoHeadModel(
      resolvePageSeo('/docs/edd', { headline: 'EDD guide', markdown: '# EDD\n\nBody.\n', file: 'docs/edd.md' })
    );
    expect(head.markdownUrl).toBe('https://waykit.dev/docs/edd.md');
  });
});
