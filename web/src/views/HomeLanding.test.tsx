import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomeLanding } from './HomeLanding';

describe('HomeLanding', () => {
  it('keeps the brand-first hero and sends jobs, map, CLI, proof and demo to docs', () => {
    render(<HomeLanding />);
    expect(screen.getByText(/software lifecycle for coding agents/i)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Waykit' })).toBeTruthy();
    expect(screen.getByText(/grill, spec, tdd, ship/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /^Install Waykit$/ }).getAttribute('href')).toBe('/docs/start');
    expect(screen.getByRole('link', { name: /^Read the lifecycle$/ }).getAttribute('href')).toBe(
      '/docs/lifecycle'
    );
    expect(screen.queryByRole('link', { name: /^See the CLI$/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /^Open the map$/ })).toBeNull();
    expect(screen.getByRole('img', { name: 'CI passing' })).toBeTruthy();
    const next = screen.getByRole('heading', { name: /start in the docs/i }).closest('section');
    expect(next).toBeTruthy();
    const docs = within(next as HTMLElement);
    expect(docs.getByRole('link', { name: /jobs for today/i }).getAttribute('href')).toBe('/docs/jobs');
    expect(docs.getByRole('link', { name: /feature lifecycle/i }).getAttribute('href')).toBe(
      '/docs/lifecycle'
    );
    expect(docs.getByRole('link', { name: /cli and what waykit installs/i }).getAttribute('href')).toBe(
      '/docs/kit'
    );
    expect(docs.getByRole('link', { name: /quality loops/i }).getAttribute('href')).toBe(
      '/docs/loops'
    );
    expect(docs.getByText(/ci, rum, lighthouse and sonar/i)).toBeTruthy();
    expect(docs.getByRole('link', { name: /waykit map/i }).getAttribute('href')).toBe('/docs/map');
    expect(docs.getByRole('link', { name: /evals \(alpha\)/i }).getAttribute('href')).toBe('/docs/edd');
    expect(docs.queryByRole('link', { name: /used on our repos/i })).toBeNull();
    expect(screen.queryByRole('heading', { name: /what do i use this for today/i })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Kit ontology map' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'The wk CLI' })).toBeNull();
    expect(screen.queryByRole('heading', { name: /used on our own product repos/i })).toBeNull();
    expect(screen.queryByRole('heading', { name: /one loop: a miss becomes a failing eval/i })).toBeNull();
    expect(screen.queryByRole('heading', { name: /demo: a miss becomes a failing eval/i })).toBeNull();
  });

  it('does not full-bleed proof, demo, or the graph on the homepage', () => {
    const css = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../index.css'), 'utf8');
    expect(css).not.toMatch(/\.landing-page \.ontology-explorer,\s*\.landing-page \.proof/);
  });
});
