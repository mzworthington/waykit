import * as d3 from 'd3';
import {
  entityLabel,
  entityMatchesQuery,
  entitySourceUrl,
  filterOntologyGraph,
  hexagonPath,
  HOMEPAGE_TYPE_FILTERS,
  layoutTargets,
  linkStrokeOpacity,
  ontologyFocusHash,
  ontologyLabelVisible,
  parseOntologyHash,
  relatedEdges,
  REL_COLOR,
  shortLabel,
  straightLinkPath,
  toHomepageIndex,
  TYPE_COLOR,
  typeRadius
} from '../../../kit/src/ontology/graph_view';
import {
  KIT_ENTITY_TYPES,
  RELATION_NAMES,
  type KitEntityType,
  type OntologyEdge,
  type OntologyEntity,
  type OntologyIndex,
  type RelationName
} from '../../../kit/src/ontology/types';

export const ONTOLOGY_INDEX_URLS = ['/assets/ontology-index.json', '/sync/ontology-index.json'] as const;

const ENTITY_TYPES = new Set<string>(KIT_ENTITY_TYPES);
const RELATIONS = new Set<string>(RELATION_NAMES);

type MapNode = {
  id: string;
  type: KitEntityType;
  entity: OntologyEntity;
  color: string;
  r: number;
  x: number;
  y: number;
};

type MapLink = OntologyEdge & { color: string };

type ElAttrs = Record<string, string | number | boolean | null | undefined>;

export type OntologyFetch = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}>;

export type MountOntologyOptions = {
  fetch?: OntologyFetch;
  indexUrls?: readonly string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseEntity(value: unknown): OntologyEntity | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return null;
  if (typeof value.type !== 'string' || !ENTITY_TYPES.has(value.type)) return null;
  const entity: OntologyEntity = {
    id: value.id,
    type: value.type as KitEntityType,
    name: value.name
  };
  if (typeof value.path === 'string') entity.path = value.path;
  if (isRecord(value.attrs)) entity.attrs = value.attrs;
  return entity;
}

function parseEdge(value: unknown): OntologyEdge | null {
  if (!isRecord(value)) return null;
  if (typeof value.from !== 'string' || typeof value.to !== 'string') return null;
  if (typeof value.relation !== 'string' || !RELATIONS.has(value.relation)) return null;
  return { from: value.from, relation: value.relation as RelationName, to: value.to };
}

export function parseOntologyIndex(value: unknown): OntologyIndex | null {
  if (!isRecord(value)) return null;
  if (typeof value.version !== 'number' || typeof value.generatedFrom !== 'string') return null;
  if (!Array.isArray(value.entities) || !Array.isArray(value.edges)) return null;
  const entities: OntologyEntity[] = [];
  for (const row of value.entities) {
    const entity = parseEntity(row);
    if (!entity) return null;
    entities.push(entity);
  }
  const edges: OntologyEdge[] = [];
  for (const row of value.edges) {
    const edge = parseEdge(row);
    if (!edge) return null;
    edges.push(edge);
  }
  return { version: value.version, generatedFrom: value.generatedFrom, entities, edges };
}

export async function fetchOntologyIndex(
  urls: readonly string[] = ONTOLOGY_INDEX_URLS,
  fetchImpl: OntologyFetch = fetch
): Promise<OntologyIndex> {
  let lastErr: Error | null = null;
  for (const url of urls) {
    try {
      const res = await fetchImpl(url);
      if (!res.ok) {
        lastErr = new Error(`${url} ${res.status}`);
        continue;
      }
      const parsed = parseOntologyIndex(await res.json());
      if (!parsed) {
        lastErr = new Error(`${url} is not an ontology index`);
        continue;
      }
      return parsed;
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw lastErr ?? new Error('Ontology index not found');
}

function el(tag: string, attrs?: ElAttrs, children: Array<Node | string | null | undefined> = []): HTMLElement {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value == null || value === false) continue;
      if (key === 'className') node.className = String(value);
      else if (key === 'text') node.textContent = String(value);
      else node.setAttribute(key, value === true ? '' : String(value));
    }
  }
  for (const child of children) {
    if (child == null) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function renderTypeFilters(root: ParentNode): void {
  const fieldset = root.querySelector('#ontology-types');
  if (!fieldset) return;
  const legend = fieldset.querySelector('legend');
  fieldset.replaceChildren(legend ?? el('legend', { text: 'Show types' }));
  for (const filter of HOMEPAGE_TYPE_FILTERS) {
    const input = el('input', {
      type: 'checkbox',
      'data-ontology-type': true,
      value: filter.type
    }) as HTMLInputElement;
    input.checked = filter.defaultOn;
    const swatch = el('span', { className: 'ontology-key-swatch', 'aria-hidden': true });
    swatch.style.backgroundColor = TYPE_COLOR[filter.type];
    fieldset.append(el('label', {}, [input, swatch, ` ${filter.label}`]));
  }
}

export function selectedTypes(root: ParentNode): string[] {
  return [...root.querySelectorAll<HTMLInputElement>('[data-ontology-type]')]
    .filter((box) => box.checked)
    .map((box) => box.value);
}

export function setOntologyFocusHash(focusId: string | null): void {
  const next = ontologyFocusHash(focusId);
  if (window.location.hash !== next) window.history.replaceState(null, '', next);
}

export function renderInspector(
  root: ParentNode,
  index: OntologyIndex,
  entity: OntologyEntity | null
): void {
  const panel = root.querySelector('#ontology-inspector-body');
  if (!panel) return;
  panel.replaceChildren();
  const heading = root.querySelector('#ontology-inspector-heading');
  if (!entity) {
    if (heading) heading.textContent = 'Selected entity';
    panel.append(
      el('p', {
        className: 'ontology-empty',
        text: 'Click a node, or search for a name: tdd, hexagonal, playwright.'
      })
    );
    return;
  }

  if (heading) heading.textContent = entityLabel(entity);
  panel.append(el('p', { className: 'ontology-meta', text: entity.type }));
  const url = entitySourceUrl(entity.path);
  if (url) {
    panel.append(el('p', {}, [el('a', { href: url, text: entity.path, rel: 'noopener noreferrer' })]));
  }

  const attrs = entity.attrs ?? {};
  if (typeof attrs.section === 'string' || typeof attrs.section === 'number') {
    panel.append(
      el('p', { className: 'ontology-meta', text: `CODING_PHILOSOPHY.md §${String(attrs.section)}` })
    );
  }
  if (typeof attrs.phase === 'string' || typeof attrs.kind === 'string') {
    panel.append(
      el('p', {
        className: 'ontology-meta',
        text: [attrs.kind, attrs.phase].filter((part) => typeof part === 'string').join(' · ')
      })
    );
  }

  const { outgoing, incoming } = relatedEdges(index, entity.id);

  const list = (title: string, edges: OntologyEdge[], dir: 'out' | 'in') => {
    if (!edges.length) return;
    const wrap = el('div', {}, [el('h4', { text: title })]);
    const ul = el('ul', { className: 'ontology-related' });
    for (const edge of edges) {
      const otherId = dir === 'out' ? edge.to : edge.from;
      const other = index.entities.find((item) => item.id === otherId);
      const btn = el('button', { type: 'button', className: 'ontology-related-btn' }, [
        el('span', { className: 'ontology-rel', text: edge.relation }),
        el('span', { text: other ? entityLabel(other) : otherId })
      ]);
      btn.addEventListener('click', () => {
        root.dispatchEvent(new CustomEvent('ontology-focus', { detail: { id: otherId } }));
      });
      ul.append(el('li', {}, [btn]));
    }
    wrap.append(ul);
    panel.append(wrap);
  };

  list('Outgoing', outgoing, 'out');
  list('Incoming', incoming, 'in');
}

export function renderMatches(
  root: ParentNode,
  entities: readonly OntologyEntity[],
  onPick: (id: string) => void
): void {
  const list = root.querySelector<HTMLElement>('#ontology-matches');
  if (!list) return;
  list.replaceChildren();
  for (const entity of entities.slice(0, 12)) {
    const btn = el('button', { type: 'button', className: 'ontology-match' }, [
      el('span', { text: entityLabel(entity) }),
      el('span', { text: entity.type })
    ]);
    btn.addEventListener('click', () => onPick(entity.id));
    list.append(el('li', {}, [btn]));
  }
  list.hidden = entities.length === 0;
}

function bindOntologyExplorer(root: HTMLElement, index: OntologyIndex): void {
  const canvas = root.querySelector('#ontology-canvas');
  const stats = root.querySelector('#ontology-stats');
  const search = root.querySelector<HTMLInputElement>('#ontology-q');
  const form = root.querySelector('.ontology-toolbar');
  form?.addEventListener('submit', (event) => event.preventDefault());
  const clearBtn = root.querySelector('#ontology-clear');
  const width = 1400;
  const height = 820;
  renderTypeFilters(root);
  const publicIndex = toHomepageIndex(index);

  if (!canvas) {
    renderInspector(root, index, null);
    return;
  }

  const svg = d3
    .select(canvas)
    .append('svg')
    .attr('class', 'hero-d3-svg')
    .attr('role', 'img')
    .attr('aria-labelledby', 'ontology-heading')
    .attr('viewBox', `0 0 ${width} ${height}`);

  const g = svg.append('g');
  const captionG = g.append('g').attr('class', 'onto-captions');
  const linkG = g.append('g').attr('class', 'onto-links');
  const nodeG = g.append('g').attr('class', 'onto-nodes');

  let zoomK = 1;
  const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.35, 4]).on('zoom', (event) => {
    zoomK = event.transform.k;
    g.attr('transform', event.transform.toString());
    nodeG.selectAll<SVGTextElement, MapNode>('.onto-label').style('opacity', (d) =>
      ontologyLabelVisible({ type: d.type, id: d.id, focusId, hoverId, zoomK }) ? 1 : 0
    );
  });
  svg.call(zoom);

  let focusId: string | null = parseOntologyHash(window.location.hash).focusId;
  let hoverId: string | null = null;
  const byId = new Map(publicIndex.entities.map((entity) => [entity.id, entity]));

  const currentView = () =>
    filterOntologyGraph(publicIndex, {
      types: selectedTypes(root),
      query: search?.value ?? '',
      focusId: focusId ?? undefined,
      hops: 1
    });

  const applyLabelOpacity = () => {
    nodeG.selectAll<SVGTextElement, MapNode>('.onto-label').style('opacity', (n) =>
      ontologyLabelVisible({ type: n.type, id: n.id, focusId, hoverId, zoomK }) ? 1 : 0
    );
  };

  const draw = () => {
    const view = currentView();
    const query = search?.value.trim() ?? '';
    const hits = query ? publicIndex.entities.filter((entity) => entityMatchesQuery(entity, query)) : [];
    renderMatches(root, hits, focusEntity);

    if (stats) {
      stats.textContent = `${view.entities.length} entities · ${view.edges.length} relations${
        focusId ? ' · neighborhood' : ''
      }`;
    }

    const nodes: MapNode[] = view.entities.map((entity) => {
      const degree = view.degrees.get(entity.id) ?? 0;
      return {
        id: entity.id,
        type: entity.type,
        entity,
        color: TYPE_COLOR[entity.type],
        r: typeRadius(entity.type, degree),
        x: 0,
        y: 0
      };
    });
    const layout = layoutTargets(nodes, width, height);
    for (const node of nodes) {
      const target = layout.targets.get(node.id);
      if (!target) continue;
      node.x = target.x;
      node.y = target.y;
    }
    const nodeIndex = new Map(nodes.map((node) => [node.id, node]));
    const links = view.edges
      .map((edge) => ({
        ...edge,
        color: REL_COLOR[edge.relation]
      }))
      .filter((link) => nodeIndex.has(link.from) && nodeIndex.has(link.to));

    captionG
      .selectAll<SVGTextElement, (typeof layout.captions)[number]>('text')
      .data(focusId ? [] : layout.captions, (d) => d.label)
      .join('text')
      .attr('x', (d) => d.x)
      .attr('y', (d) => d.y)
      .attr('text-anchor', 'middle')
      .attr('fill', '#9aa7b8')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('letter-spacing', '0.04em')
      .attr('pointer-events', 'none')
      .text((d) => d.label);

    linkG
      .selectAll<SVGPathElement, MapLink>('path')
      .data(links, (d) => `${d.from}|${d.relation}|${d.to}`)
      .join('path')
      .attr('fill', 'none')
      .attr('stroke', (d) => d.color)
      .attr('stroke-opacity', (d) => linkStrokeOpacity(focusId, d.from, d.to))
      .attr('stroke-width', (d) => (d.relation === 'orders' ? 2 : 1.05))
      .attr('d', (d) => {
        const source = nodeIndex.get(d.from);
        const target = nodeIndex.get(d.to);
        return source && target ? straightLinkPath(source.x, source.y, target.x, target.y) : '';
      });

    const node = nodeG
      .selectAll<SVGGElement, MapNode>('g')
      .data(nodes, (d) => d.id)
      .join((enter) => {
        const grp = enter.append('g').attr('class', 'onto-node').style('cursor', 'pointer');
        grp.append('path').attr('class', 'onto-shape').attr('fill', 'rgba(12, 16, 23, 0.92)');
        grp
          .append('text')
          .attr('class', 'onto-label')
          .attr('text-anchor', 'middle')
          .attr('dy', (d) => d.r + 12)
          .attr('fill', '#e8edf4')
          .attr('font-size', '10px')
          .attr('font-family', 'IBM Plex Sans, sans-serif')
          .attr('pointer-events', 'none');
        return grp;
      });

    node.attr('transform', (d) => `translate(${d.x},${d.y})`);
    node
      .select<SVGPathElement>('.onto-shape')
      .attr('d', (d) => hexagonPath(d.r))
      .attr('stroke', (d) => d.color)
      .attr('stroke-width', (d) => (d.id === focusId ? 3 : 1.5));
    node
      .select<SVGTextElement>('.onto-label')
      .text((d) => shortLabel(entityLabel(d.entity)))
      .style('opacity', (d) =>
        ontologyLabelVisible({ type: d.type, id: d.id, focusId, hoverId, zoomK }) ? 1 : 0
      );

    node
      .on('click', (event, d) => {
        event.stopPropagation();
        focusEntity(d.id);
      })
      .on('mouseenter', (_event, d) => {
        hoverId = d.id;
        applyLabelOpacity();
      })
      .on('mouseleave', () => {
        hoverId = null;
        applyLabelOpacity();
      })
      .on('keydown', (event, d) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          focusEntity(d.id);
        }
      })
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', (d) => `${d.entity.type} ${entityLabel(d.entity)}`);
  };

  function focusEntity(id: string): void {
    focusId = id;
    setOntologyFocusHash(id);
    renderInspector(root, index, byId.get(id) ?? null);
    draw();
  }

  root.addEventListener('ontology-focus', (event) => {
    const id = (event as CustomEvent<{ id?: string }>).detail?.id;
    if (typeof id === 'string') focusEntity(id);
  });

  clearBtn?.addEventListener('click', () => {
    focusId = null;
    if (search) search.value = '';
    setOntologyFocusHash(null);
    renderInspector(root, index, null);
    draw();
  });

  svg.on('click', (event) => {
    if (event.target === svg.node()) {
      focusId = null;
      setOntologyFocusHash(null);
      renderInspector(root, index, null);
      draw();
    }
  });

  if (search) {
    let timer = 0;
    search.addEventListener('input', () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(draw, 120);
    });
    search.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      const hits = publicIndex.entities.filter((entity) => entityMatchesQuery(entity, search.value));
      if (hits[0]) focusEntity(hits[0].id);
    });
  }

  root.querySelectorAll('[data-ontology-type]').forEach((box) => {
    box.addEventListener('change', () => draw());
  });

  if (focusId && byId.has(focusId)) renderInspector(root, index, byId.get(focusId) ?? null);
  else renderInspector(root, index, null);
  draw();
}

export async function mountOntologyExplorer(
  root: HTMLElement | null,
  opts: MountOntologyOptions = {}
): Promise<void> {
  if (!root) return;
  const stats = root.querySelector('#ontology-stats');
  try {
    const index = await fetchOntologyIndex(opts.indexUrls ?? ONTOLOGY_INDEX_URLS, opts.fetch ?? fetch);
    if (stats) stats.textContent = `${index.entities.length} entities in the live index`;
    bindOntologyExplorer(root, index);
  } catch {
    if (stats) {
      stats.textContent = 'Index missing. From the kit repo run pnpm wk ontology generate, then refresh.';
    }
    renderInspector(root, { version: 0, generatedFrom: '', entities: [], edges: [] }, null);
  }
}
