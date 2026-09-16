import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { HomeLanding } from './HomeLanding';

describe('HomeLanding', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps three docs cards and a used-in proof strip', () => {
    render(<HomeLanding />);
    expect(screen.getByRole('heading', { level: 1, name: 'Waykit' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /^Install Waykit$/ }).getAttribute('href')).toBe('/docs/start');
    expect(screen.getByRole('link', { name: /^Read the lifecycle$/ }).getAttribute('href')).toBe(
      '/docs/lifecycle'
    );
    const next = screen.getByRole('heading', { name: /start in the docs/i }).closest('section');
    expect(next).toBeTruthy();
    const docs = within(next as HTMLElement);
    expect(docs.getAllByRole('link').map((el) => el.getAttribute('href'))).toEqual([
      '/docs/lifecycle',
      '/docs/loops',
      '/docs/jobs'
    ]);
    expect(docs.queryByRole('link', { name: /cli and what waykit installs/i })).toBeNull();
    expect(docs.queryByRole('link', { name: /waykit map/i })).toBeNull();
    expect(docs.queryByRole('link', { name: /evals \(alpha\)/i })).toBeNull();
    expect(screen.getByRole('heading', { name: /used on our own product repos/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /archlens/i }).getAttribute('href')).toBe(
      'https://github.com/mzworthington/blueprint'
    );
    expect(screen.queryByRole('region', { name: 'Kit ontology map' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'The wk CLI' })).toBeNull();
  });

  it('puts a curl install beside the loops diagram and drops the badge row', () => {
    render(<HomeLanding />);
    expect(screen.queryByRole('img', { name: 'CI passing' })).toBeNull();
    expect(
      screen.getByText(/curl -fsSL https:\/\/raw.githubusercontent.com\/mzworthington\/waykit\/main\/install.sh/i)
    ).toBeTruthy();
  });

  it('does not full-bleed proof, demo, or the graph on the homepage', () => {
    const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../index.css'), 'utf8');
    expect(css).not.toMatch(/\.landing-page \.ontology-explorer,\s*\.landing-page \.proof/);
  });

  it('keeps the loops diagram inside the hero column on a phone', () => {
    const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../index.css'), 'utf8');
    expect(css).toMatch(/\.hero-copy,\s*\.hero-loops\s*\{[^}]*min-width:\s*0/);
    expect(css).toMatch(/\.landing-page \.hero-loops\s*\{[^}]*max-width:\s*100%/);
    expect(css).toMatch(/\.landing-page \.hero-loops img\s*\{[^}]*max-width:\s*100%/);
    expect(css).toMatch(
      /@media \(max-width: 720px\)\s*\{[^}]*\.hero-split\s*\{[^}]*minmax\(0,\s*1fr\)/
    );
    expect(css).toMatch(
      /@media \(max-width: 720px\)[\s\S]*\.landing-page \.hero-loops\s*\{[^}]*max-width:\s*min\(100%,\s*22rem\)/
    );
  });
});
