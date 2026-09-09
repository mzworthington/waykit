import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HOME_LEDE } from '../landing/copy';
import { resolvePageSeo } from './siteSeo';

const distRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../dist');
const hasDist = fs.existsSync(path.join(distRoot, 'index.html'));

function readBuilt(route: string): string {
  const rel = route === '/' ? 'index.html' : `${route.replace(/^\//, '')}/index.html`;
  return fs.readFileSync(path.join(distRoot, rel), 'utf8');
}

function assetJs(): string {
  const dir = path.join(distRoot, '_astro');
  if (!fs.existsSync(dir)) return '';
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.js'))
    .map((name) => fs.readFileSync(path.join(dir, name), 'utf8'))
    .join('\n');
}

describe.skipIf(!hasDist)('built HTML contract', () => {
  it('emits title, canonical, h1, and excerpt on home and getting started', () => {
    const homeSeo = resolvePageSeo('/');
    const home = readBuilt('/');
    expect(home).toContain(`<title>${homeSeo.title}</title>`);
    expect(home).toContain(`href="${homeSeo.canonicalUrl}"`);
    expect(home).toContain('<h1');
    expect(home).toContain('Waykit');
    expect(home).toContain(homeSeo.description.slice(0, 32));
    expect(home).toContain(HOME_LEDE.slice(0, 24));

    const startPage = fs.readFileSync(
      path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/start.md'),
      'utf8'
    );
    const startSeo = resolvePageSeo('/docs/start', {
      headline: 'Getting started',
      markdown: startPage,
      file: 'docs/start.md'
    });
    const start = readBuilt('/docs/start');
    expect(start).toContain(`<title>${startSeo.title}</title>`);
    expect(start).toContain(`href="${startSeo.canonicalUrl}"`);
    expect(start).toMatch(/<h1[^>]*>[\s\S]*Getting started/i);
    expect(start).toContain(startSeo.description.slice(0, 32));
    expect(start).toContain(startSeo.excerpt.slice(0, 32));
  });

  it('does not ship SOP markdown bodies in client JavaScript', () => {
    const js = assetJs();
    expect(js.length).toBeGreaterThan(0);
    expect(js).not.toContain('Always-on agent context is a budget, not a dump of every SOP');
  });

  it('hydrates the kit map explorer on load so the graph is not stuck on SSR chrome', () => {
    const map = readBuilt('/docs/map');
    expect(map).toContain('Explore the graph');
    expect(map).toMatch(
      /component-export="(?:OntologyExplorer|DocsWidget)"[^>]*client="load"/
    );
    const home = readBuilt('/');
    expect(home).toContain('Explore the graph');
    expect(home).toMatch(/component-export="OntologyExplorer"[^>]*client="load"/);
  });
});
