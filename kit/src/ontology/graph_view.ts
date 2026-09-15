import type {
  KitEntityType,
  OntologyEdge,
  OntologyEntity,
  OntologyIndex,
  RelationName
} from './types.js';

/** Per-project artifacts: kit-knowledge may index them locally; the homepage must not. */
export const HOMEPAGE_EXCLUDED_TYPES: readonly KitEntityType[] = ['Handover'];

const homepageExcluded = new Set<string>(HOMEPAGE_EXCLUDED_TYPES);

export function toHomepageIndex(index: OntologyIndex): OntologyIndex {
  const entities = index.entities.filter((e) => !homepageExcluded.has(e.type));
  const ids = new Set(entities.map((e) => e.id));
  return {
    ...index,
    entities,
    edges: index.edges.filter((e) => ids.has(e.from) && ids.has(e.to))
  };
}

export type HomepageEntityType = Exclude<KitEntityType, 'Handover'>;

export interface HomepageTypeFilter {
  type: HomepageEntityType;
  label: string;
  defaultOn: boolean;
}

/** Homepage type toggles. Handovers are never listed: they are local-only. */
export const HOMEPAGE_TYPE_FILTERS: readonly HomepageTypeFilter[] = [
  { type: 'Phase', label: 'Phase', defaultOn: true },
  { type: 'Skill', label: 'Skill', defaultOn: true },
  { type: 'Subagent', label: 'Subagent', defaultOn: true },
  { type: 'SOP', label: 'SOP', defaultOn: false },
  { type: 'McpServer', label: 'MCP', defaultOn: false },
  { type: 'PhilosophySection', label: 'Philosophy', defaultOn: true },
  { type: 'Doc', label: 'Doc', defaultOn: false },
  { type: 'EvalSuite', label: 'Eval', defaultOn: false }
];

export const DEFAULT_ONTOLOGY_TYPES: readonly HomepageEntityType[] = HOMEPAGE_TYPE_FILTERS.filter(
  (f) => f.defaultOn
).map((f) => f.type);

export const TYPE_COLOR: Record<KitEntityType, string> = {
  Phase: '#d4a017',
  Skill: '#2a9d8f',
  Subagent: '#e07a5f',
  SOP: '#4db6a9',
  McpServer: '#38bdf8',
  EvalSuite: '#c9843a',
  PhilosophySection: '#b8956c',
  Doc: '#9aa7b8',
  Handover: '#64748b'
};

export const REL_COLOR: Record<RelationName, string> = {
  'depends-on': '#2a9d8f',
  uses: '#38bdf8',
  loads: '#d4a017',
  gates: '#c9843a',
  implements: '#b8956c',
  references: '#9aa7b8',
  for: '#4db6a9',
  orders: '#5b6662',
  adapts: '#e07a5f'
};

const GITHUB_BLOB_BASE = 'https://github.com/mzworthington/waykit/blob/main';

export function entitySourceUrl(filePath?: string): string | null {
  if (!filePath) return null;
  const cleaned = filePath.replace(/^\.\//, '').replace(/^\/+/, '');
  return `${GITHUB_BLOB_BASE}/${cleaned}`;
}

export function parseOntologyHash(hash: string): { open: boolean; focusId: string | null } {
  const raw = hash.startsWith('#') ? hash : hash ? `#${hash}` : '';
  const m = raw.match(/^#ontology(?::(.+))?$/);
  if (!m) return { open: false, focusId: null };
  return { open: true, focusId: m[1] ? decodeURIComponent(m[1]) : null };
}

export function ontologyFocusHash(focusId: string | null): string {
  return focusId ? `#ontology:${encodeURIComponent(focusId)}` : '#ontology';
}

/** Flat-top hexagon path centered at the origin, for SVG `path.d`. */
export function hexagonPath(r: number): string {
  const a = (2 * Math.PI) / 6;
  const points: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = i * a - Math.PI / 6;
    points.push(`${r * Math.cos(angle)},${r * Math.sin(angle)}`);
  }
  return `M${points.join('L')}Z`;
}

export function straightLinkPath(x1: number, y1: number, x2: number, y2: number): string {
  if (![x1, y1, x2, y2].every(Number.isFinite)) return '';
  return `M${x1},${y1} L${x2},${y2}`;
}

export function linkStrokeOpacity(focusId: string | null, sourceId: string, targetId: string): number {
  if (!focusId) return 0.22;
  return sourceId === focusId || targetId === focusId ? 0.85 : 0.12;
}

export function entityLabel(entity: OntologyEntity): string {
  const title = entity.attrs?.title;
  if (typeof title === 'string' && title.trim()) return title.trim();
  return entity.name;
}

export function shortLabel(text: string, max = 28): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 2)}…`;
}

export function entityMatchesQuery(entity: OntologyEntity, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const attrs = entity.attrs;
  const extra = attrs
    ? `${String(attrs.kind ?? '')} ${String(attrs.phase ?? '')} ${String(attrs.title ?? '')} ${String(attrs.section ?? '')} ${String(attrs.skill ?? '')} ${String(attrs.readonly ?? '')} ${(Array.isArray(attrs.triggers) ? attrs.triggers.join(' ') : '')}`
    : '';
  return `${entity.id} ${entity.name} ${entityLabel(entity)} ${entity.type} ${entity.path ?? ''} ${extra}`
    .toLowerCase()
    .includes(q);
}

export function neighborhoodIds(index: OntologyIndex, focusId: string, hops = 1): Set<string> {
  const ids = new Set<string>([focusId]);
  let frontier = [focusId];
  for (let h = 0; h < hops; h++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const edge of index.edges) {
        if (edge.from === id && !ids.has(edge.to)) {
          ids.add(edge.to);
          next.push(edge.to);
        }
        if (edge.to === id && !ids.has(edge.from)) {
          ids.add(edge.from);
          next.push(edge.from);
        }
      }
    }
    frontier = next;
  }
  return ids;
}

export function degreeById(index: OntologyIndex): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const entity of index.entities) degrees.set(entity.id, 0);
  for (const edge of index.edges) {
    degrees.set(edge.from, (degrees.get(edge.from) ?? 0) + 1);
    degrees.set(edge.to, (degrees.get(edge.to) ?? 0) + 1);
  }
  return degrees;
}

export interface GraphViewOptions {
  types: readonly string[];
  query?: string;
  focusId?: string;
  hops?: number;
}

export interface OntologyGraphView {
  entities: OntologyEntity[];
  edges: OntologyEdge[];
  degrees: Map<string, number>;
}

/**
 * Subgraph for the homepage explorer.
 * Search and focus ignore type filters so neighbors of a hit stay visible.
 * Handovers are stripped first (local-only).
 */
export function filterOntologyGraph(index: OntologyIndex, opts: GraphViewOptions): OntologyGraphView {
  const publicIndex = toHomepageIndex(index);
  const typeSet = new Set(opts.types);
  const query = opts.query?.trim() ?? '';
  const hops = opts.hops ?? 1;
  let keep = new Set<string>();

  if (query) {
    for (const entity of publicIndex.entities) {
      if (entityMatchesQuery(entity, query)) keep.add(entity.id);
    }
    const seed = [...keep];
    for (const id of seed) {
      for (const n of neighborhoodIds(publicIndex, id, hops)) keep.add(n);
    }
  } else {
    for (const entity of publicIndex.entities) {
      if (typeSet.has(entity.type)) keep.add(entity.id);
    }
    if (opts.focusId) {
      keep = neighborhoodIds(publicIndex, opts.focusId, hops);
    }
  }

  if (opts.focusId) keep.add(opts.focusId);

  const entities = publicIndex.entities.filter((e) => keep.has(e.id));
  const ids = new Set(entities.map((e) => e.id));
  const edges = publicIndex.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
  return { entities, edges, degrees: degreeById({ ...publicIndex, entities, edges }) };
}

export function graphLayoutNodes(view: OntologyGraphView): LayoutNode[] {
  return view.entities.map((entity) => ({
    id: entity.id,
    type: entity.type,
    entity
  }));
}

export function relatedEdges(
  index: OntologyIndex,
  id: string
): { outgoing: OntologyEdge[]; incoming: OntologyEdge[] } {
  return {
    outgoing: index.edges.filter((e) => e.from === id),
    incoming: index.edges.filter((e) => e.to === id)
  };
}

export type SkillBand = 'agent' | 'lang' | 'framework' | 'profile' | 'other';

export function skillBand(name: string): SkillBand {
  if (name.startsWith('agent-')) return 'agent';
  if (name.startsWith('lang-')) return 'lang';
  if (name.startsWith('framework-')) return 'framework';
  if (name.startsWith('profile-')) return 'profile';
  return 'other';
}

export function typeRadius(type: KitEntityType, degree: number): number {
  const base: Record<KitEntityType, number> = {
    Phase: 18,
    Skill: 11,
    Subagent: 12,
    SOP: 10,
    McpServer: 10,
    PhilosophySection: 11,
    Doc: 9,
    EvalSuite: 8,
    Handover: 7
  };
  return base[type] + Math.min(6, Math.sqrt(degree) * 0.6);
}

export function ontologyLabelVisible(opts: {
  type: KitEntityType;
  id: string;
  focusId: string | null;
  hoverId: string | null;
  zoomK: number;
}): boolean {
  if (opts.type === 'Phase' || opts.type === 'PhilosophySection') return true;
  if (opts.focusId) return true;
  if (opts.hoverId === opts.id) return true;
  return opts.zoomK >= 1.45;
}

export interface LayoutNode {
  id: string;
  type: KitEntityType;
  entity: OntologyEntity;
}

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface LayoutCaption extends LayoutPoint {
  label: string;
}

export interface RingLayout {
  targets: Map<string, LayoutPoint>;
  captions: LayoutCaption[];
}

function polar(cx: number, cy: number, angle: number, radius: number): LayoutPoint {
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius * 0.78
  };
}

function placeArc(
  nodes: LayoutNode[],
  cx: number,
  cy: number,
  radius: number,
  start: number,
  sweep: number
): Array<LayoutPoint & { id: string }> {
  const n = nodes.length;
  if (!n) return [];
  return nodes.map((node, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const extra = n > 12 ? Math.floor(i / Math.ceil(n / 2)) * 36 : 0;
    return { id: node.id, ...polar(cx, cy, start + t * sweep, radius + extra) };
  });
}

function attrOrder(entity: OntologyEntity): number {
  const order = entity.attrs?.order;
  return typeof order === 'number' ? order : 0;
}

function attrPhase(entity: OntologyEntity): string {
  const phase = entity.attrs?.phase;
  return typeof phase === 'string' ? phase : '';
}

/**
 * Deterministic rings so the overview is a map, not a hairball.
 * Inner: phases. Then agent skills by phase. Then lang/framework/profile. Outer: MCP, SOP, docs.
 */
export function layoutTargets(nodes: LayoutNode[], width: number, height: number): RingLayout {
  const cx = width / 2;
  const cy = height / 2 + 10;
  const byType = new Map<KitEntityType, LayoutNode[]>();
  for (const node of nodes) {
    const list = byType.get(node.type) ?? [];
    list.push(node);
    byType.set(node.type, list);
  }
  const targets = new Map<string, LayoutPoint>();
  const captions: LayoutCaption[] = [];

  const phases = (byType.get('Phase') ?? []).slice().sort((a, b) => attrOrder(a.entity) - attrOrder(b.entity));
  const phaseAngle = new Map<string, number>();
  phases.forEach((node, i) => {
    const angle = (i / Math.max(phases.length, 1)) * Math.PI * 2 - Math.PI / 2;
    phaseAngle.set(node.entity.name, angle);
    targets.set(node.id, polar(cx, cy, angle, 118));
  });
  if (phases.length) captions.push({ label: 'Phases', ...polar(cx, cy, -Math.PI / 2, 62) });

  const skills = byType.get('Skill') ?? [];
  const bands: Record<SkillBand, LayoutNode[]> = {
    agent: [],
    lang: [],
    framework: [],
    profile: [],
    other: []
  };
  for (const node of skills) bands[skillBand(node.entity.name)].push(node);

  const agents = bands.agent.slice().sort((a, b) => {
    const phaseCmp = attrPhase(a.entity).localeCompare(attrPhase(b.entity));
    return phaseCmp !== 0 ? phaseCmp : a.entity.name.localeCompare(b.entity.name);
  });
  agents.forEach((node, i, list) => {
    const phase = attrPhase(node.entity);
    const base = phaseAngle.get(phase) ?? -Math.PI / 2 + (i / Math.max(list.length, 1)) * Math.PI * 2;
    const slot = list.filter((s) => attrPhase(s.entity) === phase).indexOf(node);
    const jitter = (slot - 1.5) * 0.16;
    targets.set(node.id, polar(cx, cy, base + jitter, 230 + (slot % 3) * 22));
  });
  if (bands.agent.length) captions.push({ label: 'Lifecycle skills', ...polar(cx, cy, Math.PI * 0.22, 230) });

  placeArc(byType.get('Subagent') ?? [], cx, cy, 185, -0.55, 1.4).forEach((t) => targets.set(t.id, t));
  if ((byType.get('Subagent') ?? []).length) {
    captions.push({ label: 'Host subagents', ...polar(cx, cy, -0.2, 185) });
  }

  placeArc(bands.lang, cx, cy, 340, -0.35, 0.9).forEach((t) => targets.set(t.id, t));
  if (bands.lang.length) captions.push({ label: 'Languages', ...polar(cx, cy, 0.1, 390) });

  placeArc(bands.framework, cx, cy, 395, 0.7, 1.15).forEach((t) => targets.set(t.id, t));
  if (bands.framework.length) captions.push({ label: 'Frameworks', ...polar(cx, cy, 1.25, 445) });

  placeArc(bands.profile, cx, cy, 355, 2.05, 0.7).forEach((t) => targets.set(t.id, t));
  if (bands.profile.length) captions.push({ label: 'Profiles', ...polar(cx, cy, 2.35, 400) });

  placeArc(bands.other, cx, cy, 300, 2.85, 0.5).forEach((t) => targets.set(t.id, t));

  placeArc(byType.get('SOP') ?? [], cx, cy, 310, 3.2, 0.7).forEach((t) => targets.set(t.id, t));
  if ((byType.get('SOP') ?? []).length) captions.push({ label: 'SOPs', ...polar(cx, cy, 3.5, 350) });

  placeArc(byType.get('PhilosophySection') ?? [], cx, cy, 430, 3.5, 0.85).forEach((t) => targets.set(t.id, t));
  if ((byType.get('PhilosophySection') ?? []).length) {
    captions.push({ label: 'Philosophy', ...polar(cx, cy, 3.9, 475) });
  }

  placeArc(byType.get('Doc') ?? [], cx, cy, 285, 4.4, 0.45).forEach((t) => targets.set(t.id, t));
  placeArc(byType.get('McpServer') ?? [], cx, cy, 470, -2.4, 1.5).forEach((t) => targets.set(t.id, t));
  if ((byType.get('McpServer') ?? []).length) captions.push({ label: 'MCP', ...polar(cx, cy, -1.65, 520) });

  placeArc(byType.get('EvalSuite') ?? [], cx, cy, 520, 0, Math.PI * 2).forEach((t) => targets.set(t.id, t));
  placeArc(byType.get('Handover') ?? [], cx, cy, 560, Math.PI, Math.PI).forEach((t) => targets.set(t.id, t));

  const fallback = polar(cx, cy, 0, 200);
  for (const node of nodes) {
    if (!targets.has(node.id)) targets.set(node.id, fallback);
  }
  return { targets, captions };
}
