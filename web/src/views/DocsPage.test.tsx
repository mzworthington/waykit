import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { DocsPage } from './DocsPage';

describe('DocsPage', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders breadcrumbs and markdown for a published guide', () => {
    render(<DocsPage pathname="/docs/start" />);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: /getting started/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Markdown source' }).getAttribute('href')).toBe('/docs/start.md');
  });

  it('renders the kit map authoring guide from ontology/README.md', () => {
    render(<DocsPage pathname="/ontology" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Author the Waykit map' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: /this is not a product architecture diagram/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Markdown source' }).getAttribute('href')).toBe(
      '/ontology/README.md'
    );
  });
});
