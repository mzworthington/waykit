import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OntologyExplorer } from './OntologyExplorer';

vi.mock('../ontology/map.ts', () => ({
  mountOntologyExplorer: vi.fn(async () => undefined)
}));

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove('ontology-map-fullscreen');
});

describe('OntologyExplorer', () => {
  it('covers the viewport when full screen is toggled, and Escape restores the page', () => {
    render(<OntologyExplorer />);
    const map = screen.getByRole('region', { name: 'Kit ontology map' });
    const toggle = screen.getByRole('button', { name: 'Full screen' });

    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    expect(map.classList.contains('ontology-explorer--fullscreen')).toBe(false);

    fireEvent.click(toggle);
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.textContent).toBe('Exit full screen');
    expect(map.classList.contains('ontology-explorer--fullscreen')).toBe(true);
    expect(document.documentElement.classList.contains('ontology-map-fullscreen')).toBe(true);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Full screen' }).getAttribute('aria-pressed')).toBe(
      'false'
    );
    expect(map.classList.contains('ontology-explorer--fullscreen')).toBe(false);
    expect(document.documentElement.classList.contains('ontology-map-fullscreen')).toBe(false);
  });

  it('keeps Full screen on the graph canvas', () => {
    render(<OntologyExplorer />);
    const frame = document.querySelector('.ontology-canvas-frame');
    expect(frame?.contains(screen.getByRole('button', { name: 'Full screen' }))).toBe(true);
    expect(document.querySelector('.ontology-chrome')?.contains(screen.getByRole('search'))).toBe(
      true
    );
  });

  it('mounts the live graph after the island hydrates', async () => {
    const { mountOntologyExplorer } = await import('../ontology/map');
    vi.mocked(mountOntologyExplorer).mockClear();
    render(<OntologyExplorer />);
    expect(mountOntologyExplorer).toHaveBeenCalledTimes(1);
    expect(mountOntologyExplorer).toHaveBeenCalledWith(
      screen.getByRole('region', { name: 'Kit ontology map' })
    );
  });
});
