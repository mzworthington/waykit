import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OntologyIndex } from '../../../kit/src/ontology/types';
import { HOMEPAGE_TYPE_FILTERS, TYPE_COLOR } from '../../../kit/src/ontology/graph_view';
import {
  fetchOntologyIndex,
  mountOntologyExplorer,
  parseOntologyIndex,
  renderInspector,
  renderMatches,
  renderTypeFilters,
  selectedTypes,
  setOntologyFocusHash
} from './map';

function cssColor(hex: string): string {
  const probe = document.createElement('span');
  probe.style.backgroundColor = hex;
  return probe.style.backgroundColor;
}

const fixture: OntologyIndex = {
  version: 1,
  generatedFrom: 'ontology/schema.yaml',
  entities: [
    {
      id: 'skill:agent-tdd',
      type: 'Skill',
      name: 'agent-tdd',
      path: 'skills/agent-tdd/SKILL.md',
      attrs: { kind: 'role', phase: 'tdd', title: 'TDD short loop' }
    },
    { id: 'sop:context-budget', type: 'SOP', name: 'context-budget', path: 'SOPs/context-budget.md' },
    { id: 'phase:tdd', type: 'Phase', name: 'tdd' }
  ],
  edges: [
    { from: 'skill:agent-tdd', relation: 'loads', to: 'sop:context-budget' },
    { from: 'skill:agent-tdd', relation: 'for', to: 'phase:tdd' }
  ]
};

function explorerRoot(): HTMLElement {
  const root = document.createElement('section');
  root.innerHTML = `
    <h2 id="ontology-heading">Kit ontology</h2>
    <form class="ontology-toolbar" role="search">
      <input id="ontology-q" type="search" />
      <fieldset class="ontology-types" id="ontology-types"><legend>Show types</legend></fieldset>
      <p id="ontology-stats">Loading index…</p>
      <button type="button" id="ontology-clear">Clear focus</button>
    </form>
    <div id="ontology-canvas"></div>
    <h3 id="ontology-inspector-heading">Selected entity</h3>
    <div id="ontology-inspector-body"></div>
    <ol id="ontology-matches" hidden></ol>
  `;
  document.body.append(root);
  return root;
}

afterEach(() => {
  document.body.replaceChildren();
  window.location.hash = '';
});

describe('parseOntologyIndex', () => {
  it('accepts a versioned entity graph and rejects junk', () => {
    expect(parseOntologyIndex(fixture)).toEqual(fixture);
    expect(parseOntologyIndex(null)).toBeNull();
    expect(parseOntologyIndex({ version: 1, generatedFrom: 'x', entities: [], edges: [] })).toEqual({
      version: 1,
      generatedFrom: 'x',
      entities: [],
      edges: []
    });
    expect(parseOntologyIndex({ entities: [] })).toBeNull();
  });
});

describe('fetchOntologyIndex', () => {
  it('tries URLs in order and returns the first valid index', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('missing.json')) {
        return { ok: false, status: 404, json: async () => ({}) };
      }
      return { ok: true, status: 200, json: async () => fixture };
    });
    const index = await fetchOntologyIndex(
      ['/missing.json', '/assets/ontology-index.json'],
      fetchImpl as unknown as typeof fetch
    );
    expect(index.entities).toHaveLength(3);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('throws when no URL yields a valid index', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ nope: true }) }));
    await expect(fetchOntologyIndex(['/bad.json'], fetchImpl as unknown as typeof fetch)).rejects.toThrow(
      /not an ontology index/
    );
  });
});

describe('type filters and inspector', () => {
  it('renders default-on type checkboxes and reads the selection', () => {
    const root = explorerRoot();
    renderTypeFilters(root);
    const boxes = [...root.querySelectorAll<HTMLInputElement>('[data-ontology-type]')];
    expect(boxes.map((box) => box.value)).toEqual(HOMEPAGE_TYPE_FILTERS.map((filter) => filter.type));
    expect(boxes.filter((box) => box.checked).map((box) => box.value)).toEqual(
      HOMEPAGE_TYPE_FILTERS.filter((filter) => filter.defaultOn).map((filter) => filter.type)
    );
    boxes[0]!.checked = false;
    expect(selectedTypes(root)).not.toContain(HOMEPAGE_TYPE_FILTERS[0]!.type);
    const swatches = [...root.querySelectorAll<HTMLElement>('.ontology-key-swatch')];
    expect(swatches.map((swatch) => swatch.style.backgroundColor)).toEqual(
      HOMEPAGE_TYPE_FILTERS.map((filter) => cssColor(TYPE_COLOR[filter.type]))
    );
  });

  it('shows empty inspector copy, then entity meta, source link, and related buttons', () => {
    const root = explorerRoot();
    renderInspector(root, fixture, null);
    expect(root.querySelector('#ontology-inspector-heading')?.textContent).toBe('Selected entity');
    expect(root.querySelector('.ontology-empty')?.textContent).toMatch(/Click a node/);

    const skill = fixture.entities[0]!;
    renderInspector(root, fixture, skill);
    expect(root.querySelector('#ontology-inspector-heading')?.textContent).toBe('TDD short loop');
    expect(root.querySelector('.ontology-meta')?.textContent).toBe('Skill');
    expect(root.querySelector('a')?.getAttribute('href')).toContain('skills/agent-tdd/SKILL.md');
    expect(root.querySelector('.ontology-meta:last-of-type')?.textContent).toBe('role · tdd');

    const related = [...root.querySelectorAll<HTMLButtonElement>('.ontology-related-btn')];
    expect(related.length).toBeGreaterThan(0);
    related[0]!.click();
    expect(root.querySelector('.ontology-related-btn')).not.toBeNull();
  });

  it('dispatches ontology-focus when a related entity is chosen', () => {
    const root = explorerRoot();
    const skill = fixture.entities[0]!;
    const seen: string[] = [];
    root.addEventListener('ontology-focus', (event) => {
      seen.push((event as CustomEvent<{ id: string }>).detail.id);
    });
    renderInspector(root, fixture, skill);
    root.querySelector<HTMLButtonElement>('.ontology-related-btn')?.click();
    expect(seen[0]).toMatch(/sop:context-budget|phase:tdd/);
  });

  it('lists search hits and hides the list when empty', () => {
    const root = explorerRoot();
    const picked: string[] = [];
    renderMatches(root, fixture.entities, (id) => picked.push(id));
    const list = root.querySelector<HTMLOListElement>('#ontology-matches');
    expect(list?.hidden).toBe(false);
    expect(list?.querySelectorAll('li')).toHaveLength(3);
    list?.querySelector('button')?.click();
    expect(picked[0]).toBe('skill:agent-tdd');

    renderMatches(root, [], () => undefined);
    expect(root.querySelector<HTMLOListElement>('#ontology-matches')?.hidden).toBe(true);
  });
});

describe('setOntologyFocusHash', () => {
  it('writes #ontology or #ontology:id without duplicating the same hash', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');
    setOntologyFocusHash('skill:agent-tdd');
    expect(window.location.hash).toBe('#ontology:skill%3Aagent-tdd');
    const calls = replaceState.mock.calls.length;
    setOntologyFocusHash('skill:agent-tdd');
    expect(replaceState.mock.calls.length).toBe(calls);
    setOntologyFocusHash(null);
    expect(window.location.hash).toBe('#ontology');
    replaceState.mockRestore();
  });
});

describe('mountOntologyExplorer', () => {
  it('explains a missing index and still paints an empty inspector', async () => {
    const root = explorerRoot();
    const fetchImpl = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }));
    await mountOntologyExplorer(root, { fetch: fetchImpl as unknown as typeof fetch });
    expect(root.querySelector('#ontology-stats')?.textContent).toMatch(/Index missing/);
    expect(root.querySelector('.ontology-empty')).not.toBeNull();
  });

  it('loads a valid index, paints type filters, and draws an SVG graph', async () => {
    const root = explorerRoot();
    const fetchImpl = vi.fn(async () => ({ ok: true, status: 200, json: async () => fixture }));
    await mountOntologyExplorer(root, { fetch: fetchImpl as unknown as typeof fetch });
    expect(root.querySelector('#ontology-stats')?.textContent).toMatch(/entities/);
    expect(root.querySelectorAll('[data-ontology-type]').length).toBe(HOMEPAGE_TYPE_FILTERS.length);
    expect(root.querySelector('svg.hero-d3-svg')).not.toBeNull();
    expect(root.querySelectorAll('.onto-node').length).toBeGreaterThan(0);
  });
});
