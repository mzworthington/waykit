import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomeLanding } from './HomeLanding';

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
});
