import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { generateOntologyIndex } from './generate.js';
import {
  DEFAULT_ONTOLOGY_TYPES,
  HOMEPAGE_TYPE_FILTERS,
  entityLabel,
  graphLayoutNodes,
  entityMatchesQuery,
  entitySourceUrl,
  filterOntologyGraph,
  hexagonPath,
  layoutMapText,
  layoutTargets,
  mapTextBox,
  linkStrokeOpacity,
  neighborhoodIds,
  ontologyFocusHash,
  ontologyLabelVisible,
  parseOntologyHash,
  relatedEdges,
  shortLabel,
  skillBand,
  straightLinkPath,
  typeRadius,
  type LayoutNode
} from './graph_view.js';
import type { OntologyIndex } from './types.js';

const fixture: OntologyIndex = {
  version: 1,
  generatedFrom: 'ontology/schema.yaml',
  entities: [
    { id: 'skill:agent-tdd', type: 'Skill', name: 'agent-tdd', path: 'skills/agent-tdd/SKILL.md' },
    { id: 'sop:behavior-catalog-and-xfn', type: 'SOP', name: 'behavior-catalog-and-xfn', path: 'SOPs/behavior-catalog-and-xfn.md' },
    { id: 'eval:demo', type: 'EvalSuite', name: 'demo', path: 'evals/edd/demo.yaml' },
    { id: 'phase:tdd', type: 'Phase', name: 'tdd' },
    { id: 'handover:archlens', type: 'Handover', name: 'archlens/tdd' },
    { id: 'mcp:context7', type: 'McpServer', name: 'context7' }
  ],
  edges: [
    { from: 'skill:agent-tdd', relation: 'loads', to: 'sop:behavior-catalog-and-xfn' },
    { from: 'skill:agent-tdd', relation: 'uses', to: 'mcp:context7' },
    { from: 'eval:demo', relation: 'gates', to: 'skill:agent-tdd' },
    { from: 'handover:archlens', relation: 'for', to: 'phase:tdd' }
  ]
};

describe('entitySourceUrl', () => {
  it('builds a GitHub blob URL from a kit-relative path', () => {
    assert.equal(
      entitySourceUrl('skills/agent-tdd/SKILL.md'),
      'https://github.com/mzworthington/waykit/blob/main/skills/agent-tdd/SKILL.md'
    );
  });

  it('returns null when the entity has no path', () => {
    assert.equal(entitySourceUrl(undefined), null);
  });
});

describe('HOMEPAGE_TYPE_FILTERS', () => {
  it('defaults every offered type on; never offers handover', () => {
    assert.deepEqual(
      [...DEFAULT_ONTOLOGY_TYPES].sort(),
      HOMEPAGE_TYPE_FILTERS.map((f) => f.type).slice().sort()
    );
    assert.equal(HOMEPAGE_TYPE_FILTERS.every((f) => f.defaultOn), true);
    const offered = new Set<string>(HOMEPAGE_TYPE_FILTERS.map((f) => f.type));
    assert.equal(offered.has('Handover'), false);
  });
});

describe('filterOntologyGraph', () => {
  it('includes evals, SOPs, and MCPs in the default type set, and still drops handovers', () => {
    const view = filterOntologyGraph(fixture, { types: DEFAULT_ONTOLOGY_TYPES });
    assert.deepEqual(
      view.entities.map((e) => e.id).sort(),
      ['eval:demo', 'mcp:context7', 'phase:tdd', 'skill:agent-tdd', 'sop:behavior-catalog-and-xfn']
    );
    assert.ok(view.edges.some((e) => e.relation === 'gates'));
  });

  it('builds layout nodes from the filtered view', () => {
    const view = filterOntologyGraph(fixture, { types: DEFAULT_ONTOLOGY_TYPES });
    const nodes = graphLayoutNodes(view);
    assert.deepEqual(
      nodes.map((n) => n.id),
      view.entities.map((e) => e.id)
    );
  });

  it('search pulls in neighbors even when their types are filtered off', () => {
    const view = filterOntologyGraph(fixture, {
      types: DEFAULT_ONTOLOGY_TYPES,
      query: 'demo'
    });
    assert.ok(view.entities.some((e) => e.id === 'eval:demo'));
    assert.ok(view.entities.some((e) => e.id === 'skill:agent-tdd'));
    assert.ok(view.edges.some((e) => e.relation === 'gates'));
  });

  it('focus keeps a one-hop neighborhood', () => {
    const view = filterOntologyGraph(fixture, {
      types: DEFAULT_ONTOLOGY_TYPES,
      focusId: 'skill:agent-tdd'
    });
    assert.ok(view.entities.some((e) => e.id === 'eval:demo'));
    assert.ok(view.entities.some((e) => e.id === 'mcp:context7'));
  });

  it('never draws handover entities, even when focusing a linked phase', () => {
    const view = filterOntologyGraph(fixture, {
      types: [...DEFAULT_ONTOLOGY_TYPES, 'Handover'],
      focusId: 'phase:tdd'
    });
    assert.equal(
      view.entities.some((e) => e.type === 'Handover'),
      false
    );
    assert.ok(view.entities.some((e) => e.id === 'phase:tdd'));
  });
});

describe('neighborhoodIds', () => {
  it('includes both incoming and outgoing neighbors', () => {
    const ids = neighborhoodIds(fixture, 'skill:agent-tdd', 1);
    assert.ok(ids.has('eval:demo'));
    assert.ok(ids.has('mcp:context7'));
    assert.equal(ids.has('handover:archlens'), false);
  });
});

describe('relatedEdges', () => {
  it('splits incoming and outgoing', () => {
    const rel = relatedEdges(fixture, 'skill:agent-tdd');
    assert.equal(rel.outgoing.length, 2);
    assert.equal(rel.incoming.length, 1);
    assert.equal(rel.incoming[0]?.from, 'eval:demo');
  });
});

describe('entityMatchesQuery', () => {
  it('matches id fragments', () => {
    assert.equal(entityMatchesQuery(fixture.entities[0]!, 'agent-tdd'), true);
    assert.equal(entityMatchesQuery(fixture.entities[0]!, 'nope'), false);
  });
});

describe('entityLabel', () => {
  it('prefers attrs.title over a numeric name', () => {
    assert.equal(
      entityLabel({
        id: 'philosophy:8',
        type: 'PhilosophySection',
        name: '8',
        attrs: { title: 'Interaction Mandate' }
      }),
      'Interaction Mandate'
    );
  });
});

describe('layoutTargets', () => {
  it('puts phases on an inner ring and agent skills farther out', () => {
    const nodes: LayoutNode[] = [
      {
        id: 'phase:tdd',
        type: 'Phase',
        entity: { id: 'phase:tdd', type: 'Phase', name: 'tdd', attrs: { order: 2 } }
      },
      {
        id: 'phase:spec',
        type: 'Phase',
        entity: { id: 'phase:spec', type: 'Phase', name: 'spec', attrs: { order: 1 } }
      },
      {
        id: 'skill:agent-tdd',
        type: 'Skill',
        entity: { id: 'skill:agent-tdd', type: 'Skill', name: 'agent-tdd', attrs: { phase: 'tdd' } }
      },
      {
        id: 'subagent:agent-tdd',
        type: 'Subagent',
        entity: { id: 'subagent:agent-tdd', type: 'Subagent', name: 'agent-tdd' }
      },
      {
        id: 'skill:lang-go',
        type: 'Skill',
        entity: { id: 'skill:lang-go', type: 'Skill', name: 'lang-go' }
      },
      {
        id: 'philosophy:8',
        type: 'PhilosophySection',
        entity: {
          id: 'philosophy:8',
          type: 'PhilosophySection',
          name: 'Interaction Mandate',
          attrs: { section: '8', title: 'Interaction Mandate' }
        }
      }
    ];
    const { targets, captions } = layoutTargets(nodes, 1400, 820);
    const cx = 700;
    const cy = 420;
    const dist = (id: string): number => {
      const p = targets.get(id);
      assert.ok(p);
      const dx = p.x - cx;
      const dy = (p.y - cy) / 0.78;
      return Math.hypot(dx, dy);
    };
    assert.ok(dist('phase:tdd') < dist('subagent:agent-tdd'));
    assert.ok(dist('subagent:agent-tdd') < dist('skill:agent-tdd'));
    assert.ok(dist('skill:agent-tdd') < dist('skill:lang-go'));
    assert.ok(dist('philosophy:8') > dist('phase:spec'));
    assert.ok(captions.some((c) => c.label === 'Phases'));
    assert.ok(captions.some((c) => c.label === 'Host subagents'));
    assert.ok(captions.some((c) => c.label === 'Lifecycle skills'));
    assert.ok(captions.some((c) => c.label === 'Philosophy'));
    const spec = targets.get('phase:spec');
    const tdd = targets.get('phase:tdd');
    assert.ok(spec && tdd);
    assert.notEqual(spec.y, tdd.y);
  });

  it('places evals outside MCP so they do not share the outer ring', () => {
    const nodes: LayoutNode[] = [
      {
        id: 'mcp:context7',
        type: 'McpServer',
        entity: { id: 'mcp:context7', type: 'McpServer', name: 'context7' }
      },
      {
        id: 'mcp:linear',
        type: 'McpServer',
        entity: { id: 'mcp:linear', type: 'McpServer', name: 'linear' }
      },
      {
        id: 'eval:demo',
        type: 'EvalSuite',
        entity: { id: 'eval:demo', type: 'EvalSuite', name: 'demo' }
      },
      {
        id: 'eval:safety',
        type: 'EvalSuite',
        entity: { id: 'eval:safety', type: 'EvalSuite', name: 'safety' }
      }
    ];
    const { targets, captions } = layoutTargets(nodes, 1400, 820);
    const cx = 700;
    const cy = 420;
    const dist = (id: string): number => {
      const p = targets.get(id);
      assert.ok(p);
      const dx = p.x - cx;
      const dy = (p.y - cy) / 0.78;
      return Math.hypot(dx, dy);
    };
    const mcpFar = Math.max(dist('mcp:context7'), dist('mcp:linear'));
    const evalNear = Math.min(dist('eval:demo'), dist('eval:safety'));
    assert.ok(evalNear > mcpFar);
    assert.ok(captions.some((c) => c.label === 'Evals'));
  });
});

describe('ontologyLabelVisible', () => {
  it('at rest shows only phase names; other types need hover, own focus, or a close zoom', () => {
    const base = {
      id: 'skill:agent-tdd',
      type: 'Skill' as const,
      focusId: null,
      hoverId: null,
      zoomK: 1
    };
    assert.equal(ontologyLabelVisible({ ...base, type: 'Phase', id: 'phase:tdd' }), true);
    assert.equal(ontologyLabelVisible({ ...base, type: 'PhilosophySection', id: 'philosophy:8' }), false);
    assert.equal(ontologyLabelVisible(base), false);
    assert.equal(ontologyLabelVisible({ ...base, hoverId: 'skill:agent-tdd' }), true);
    assert.equal(ontologyLabelVisible({ ...base, focusId: 'skill:agent-xfn' }), false);
    assert.equal(
      ontologyLabelVisible({ ...base, id: 'skill:agent-xfn', focusId: 'skill:agent-xfn' }),
      true
    );
    assert.equal(ontologyLabelVisible({ ...base, zoomK: 1.5 }), false);
    assert.equal(ontologyLabelVisible({ ...base, zoomK: 2.2 }), true);
  });
});

describe('parseOntologyHash / ontologyFocusHash', () => {
  it('treats only #ontology hashes as the explorer, with optional focus id', () => {
    assert.deepEqual(parseOntologyHash(''), { open: false, focusId: null });
    assert.deepEqual(parseOntologyHash('#today'), { open: false, focusId: null });
    assert.deepEqual(parseOntologyHash('#ontology'), { open: true, focusId: null });
    assert.deepEqual(parseOntologyHash('#ontology:skill%3Aagent-tdd'), {
      open: true,
      focusId: 'skill:agent-tdd'
    });
    assert.equal(ontologyFocusHash(null), '#ontology');
    assert.equal(ontologyFocusHash('skill:agent-tdd'), '#ontology:skill%3Aagent-tdd');
    assert.deepEqual(parseOntologyHash(ontologyFocusHash('eval:demo')), {
      open: true,
      focusId: 'eval:demo'
    });
  });
});

describe('hexagonPath / straightLinkPath / linkStrokeOpacity', () => {
  it('emits a closed six-vertex path whose first vertex sits at -30 degrees', () => {
    const d = hexagonPath(10);
    assert.match(d, /^M/);
    assert.match(d, /Z$/);
    assert.equal(d.split('L').length, 6);
    const first = d.slice(1).split('L')[0];
    const [x, y] = first!.split(',').map(Number);
    assert.ok(Math.abs(x! - 10 * Math.cos(-Math.PI / 6)) < 1e-9);
    assert.ok(Math.abs(y! - 10 * Math.sin(-Math.PI / 6)) < 1e-9);
  });

  it('draws a straight SVG segment and skips non-finite points', () => {
    assert.equal(straightLinkPath(0, 0, 10, 20), 'M0,0 L10,20');
    assert.equal(straightLinkPath(Number.NaN, 0, 1, 1), '');
  });

  it('dims links that are not incident to the focused node', () => {
    assert.equal(linkStrokeOpacity(null, 'a', 'b'), 0.1);
    assert.equal(linkStrokeOpacity('a', 'a', 'b'), 0.85);
    assert.equal(linkStrokeOpacity('a', 'c', 'b'), 0.12);
  });
});

describe('skillBand / shortLabel / typeRadius', () => {
  it('classifies skill families', () => {
    assert.equal(skillBand('agent-tdd'), 'agent');
    assert.equal(skillBand('lang-go'), 'lang');
    assert.equal(skillBand('framework-next'), 'framework');
    assert.equal(skillBand('profile-iac'), 'profile');
    assert.equal(skillBand('odd-one'), 'other');
  });

  it('truncates long labels', () => {
    assert.equal(shortLabel('tdd'), 'tdd');
    assert.equal(shortLabel('abcdefghijklmnopqrstuvwxyz012345'), 'abcdefghijklmnopqrstuvwxyz…');
  });

  it('sizes phases larger than evals and host subagents larger than docs', () => {
    assert.ok(typeRadius('Phase', 0) > typeRadius('EvalSuite', 0));
    assert.ok(typeRadius('Subagent', 0) > typeRadius('Doc', 0));
  });
});

describe('live kit graph defaults', () => {
  it('keeps node labels and ring captions from overlapping', () => {
    const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const index = generateOntologyIndex(kitRoot);
    const view = filterOntologyGraph(index, { types: DEFAULT_ONTOLOGY_TYPES });
    const nodes = graphLayoutNodes(view);
    const layout = layoutTargets(nodes, 1400, 820);
    const texts = layoutMapText({
      nodes: nodes.map((node) => {
        const point = layout.targets.get(node.id);
        assert.ok(point);
        return {
          id: node.id,
          type: node.type,
          entity: node.entity,
          r: typeRadius(node.type, view.degrees.get(node.id) ?? 0),
          x: point.x,
          y: point.y
        };
      }),
      captions: layout.captions,
      width: 1400,
      height: 820,
      labelVisible: (node) =>
        ontologyLabelVisible({
          type: node.type,
          id: node.id,
          focusId: null,
          hoverId: null,
          zoomK: 1
        })
    });
    const boxes = texts.map((text) => ({ id: text.id, ...mapTextBox(text) }));
    for (const text of texts) {
      if (text.kind !== 'node') continue;
      const point = layout.targets.get(text.id);
      assert.ok(point);
      assert.ok(
        Math.hypot(text.x - point.x, text.y - point.y) < 96,
        `${text.id} label drifted from its node`
      );
    }
    const overlaps: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const hit = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        if (hit) overlaps.push(`${a.id} <> ${b.id}`);
      }
    }
    assert.equal(overlaps.length, 0, overlaps.join('; '));
  });

  it('default homepage view keeps skills and drops handovers', () => {
    const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
    const index = generateOntologyIndex(kitRoot);
    const view = filterOntologyGraph(index, { types: DEFAULT_ONTOLOGY_TYPES });
    assert.ok(view.entities.some((e) => e.id === 'skill:agent-tdd'));
    assert.ok(view.entities.some((e) => e.id === 'subagent:agent-tdd'));
    assert.equal(
      view.entities.some((e) => e.type === 'Handover'),
      false
    );
  });
});
