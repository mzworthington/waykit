import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { HomeLanding } from './HomeLanding';

vi.mock('../ontology/map.ts', () => ({
  mountOntologyExplorer: vi.fn(async () => undefined)
}));

describe('HomeLanding', () => {
  it('uses the brand-first hero, job picker, proof, and demo', () => {
    render(<HomeLanding />);
    expect(screen.getByText(/software lifecycle for coding agents/i)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Waykit' })).toBeTruthy();
    expect(screen.getByText(/grill, spec, tdd, ship/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /^Install Waykit$/ }).getAttribute('href')).toBe('#today');
    expect(screen.getByRole('img', { name: 'CI passing' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Feature lifecycle' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Docs at waykit.dev' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Unlicense' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Latest GitHub release' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Latest GitHub release' }).getAttribute('href')).toMatch(
      /github\.com\/mzworthington\/waykit\/releases$/
    );
    expect(screen.getByRole('heading', { name: /what do i use this for today/i })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Job list' })).toBeTruthy();
    const today = screen.getByRole('heading', { name: /what do i use this for today/i });
    const map = screen.getByRole('region', { name: 'Kit ontology map' });
    const cli = screen.getByRole('heading', { name: 'The wk CLI' });
    expect(today.compareDocumentPosition(map) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(map.compareDocumentPosition(cli) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Explore the graph' })).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Key' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /^See the CLI$/ }).getAttribute('href')).toBe('#cli');
    expect(screen.getByRole('heading', { name: 'The wk CLI' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /used on our own product repos/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /ArchLens/ }).getAttribute('href')).toBe(
      'https://github.com/mzworthington/blueprint'
    );
    expect(screen.getByRole('columnheader', { name: 'Command' })).toBeTruthy();
    const cliTable = screen.getByRole('table');
    expect(within(cliTable).getByText('wk align')).toBeTruthy();
    expect(within(cliTable).getByText('wk doctor')).toBeTruthy();
    expect(within(cliTable).getByText('wk check')).toBeTruthy();
    expect(
      screen.getByRole('link', { name: 'Operator guide: context, MCP, check, doctor' }).getAttribute('href')
    ).toBe('/docs/kit');
    expect(screen.getByRole('heading', { name: /one loop: a miss becomes a failing eval/i })).toBeTruthy();
    expect(screen.getByText('Typically payment systems use PostgreSQL…', { exact: false })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Walk the interactive demo' }).getAttribute('href')).toBe(
      '#demo'
    );
    expect(screen.getByRole('heading', { name: /demo: a miss becomes a failing eval/i })).toBeTruthy();
  });

  it('gives the eval proof and demo the same full-bleed width as the graph', () => {
    const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../index.css'), 'utf8');
    expect(css).toMatch(
      /\.landing-page \.ontology-explorer,\s*\.landing-page \.proof,\s*\.landing-page \.demo \{[^}]*width: 100vw/s
    );
  });
});
