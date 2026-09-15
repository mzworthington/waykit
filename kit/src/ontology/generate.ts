import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parseNumberedHeading, markdownLinkTargets } from '../shared/text_parse.js';
import { trustedBin, trustedSpawnEnv } from '../shared/trusted_bin.js';
import { loadOntologySchema } from './schema.js';
import { toHomepageIndex } from './graph_view.js';
import {
  entityId,
  type OntologyEdge,
  type OntologyEntity,
  type OntologyIndex,
  type RelationName
} from './types.js';

function safeRead(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function parseFrontmatter(content: string): Record<string, unknown> | null {
  if (!content.startsWith('---')) return null;
  const end = content.indexOf('\n---', 3);
  if (end < 0) return null;
  const raw = content.slice(3, end).trim();
  try {
    const data = parseYaml(raw);
    return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function listPhilosophySections(kitRoot: string): Array<{ id: string; title: string }> {
  const raw = safeRead(path.join(kitRoot, 'CODING_PHILOSOPHY.md'));
  if (!raw) return [];
  const sections: Array<{ id: string; title: string }> = [];
  const parts = raw.split(/^## /m);
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i];
    const nl = block.indexOf('\n');
    const titleLine = (nl >= 0 ? block.slice(0, nl) : block).trim();
    const numbered = parseNumberedHeading(titleLine);
    sections.push({
      id: numbered ? numbered.id : String(i),
      title: numbered ? numbered.title : titleLine
    });
  }
  return sections;
}

function collectMarkdownTargets(text: string): string[] {
  return markdownLinkTargets(text);
}

function addEdge(
  edges: OntologyEdge[],
  seen: Set<string>,
  from: string,
  relation: RelationName,
  to: string
): void {
  const key = `${from}|${relation}|${to}`;
  if (seen.has(key)) return;
  seen.add(key);
  edges.push({ from, relation, to });
}

export interface GenerateOntologyOptions {
  /** Skip gitignored paths so the index matches a CI checkout. */
  committedOnly?: boolean;
}

/** True when `git check-ignore` would exclude the kit-relative path. */
export function isGitIgnored(kitRoot: string, relPath: string): boolean {
  const result = spawnSync(
    trustedBin('git'),
    ['-C', kitRoot, 'check-ignore', '-q', '--', relPath],
    {
      stdio: 'ignore',
      env: trustedSpawnEnv()
    }
  );
  return result.status === 0;
}

export function generateOntologyIndex(
  kitRoot: string,
  opts: GenerateOntologyOptions = {}
): OntologyIndex {
  const schema = loadOntologySchema(kitRoot);
  const entities: OntologyEntity[] = [];
  const edges: OntologyEdge[] = [];
  const seenEdges = new Set<string>();
  const entityIds = new Set<string>();
  const skipIgnored = (relPath: string | undefined): boolean =>
    Boolean(opts.committedOnly && relPath && isGitIgnored(kitRoot, relPath));

  const pushEntity = (entity: OntologyEntity) => {
    if (entityIds.has(entity.id)) return;
    if (skipIgnored(entity.path)) return;
    entityIds.add(entity.id);
    entities.push(entity);
  };

  for (let i = 0; i < schema.phaseOrder.length; i++) {
    const name = schema.phaseOrder[i];
    pushEntity({
      id: entityId('Phase', name),
      type: 'Phase',
      name,
      attrs: { order: i }
    });
    if (i > 0) {
      addEdge(
        edges,
        seenEdges,
        entityId('Phase', schema.phaseOrder[i - 1]),
        'orders',
        entityId('Phase', name)
      );
    }
  }

  // Philosophy - id stays philosophy:<n> (kit-knowledge); name is the heading
  for (const s of listPhilosophySections(kitRoot)) {
    pushEntity({
      id: entityId('PhilosophySection', s.id),
      type: 'PhilosophySection',
      name: s.title,
      path: 'CODING_PHILOSOPHY.md',
      attrs: { section: s.id, title: s.title }
    });
  }

  const docsDir = path.join(kitRoot, 'docs');
  if (fs.existsSync(docsDir)) {
    for (const f of fs.readdirSync(docsDir).sort()) {
      if (!f.endsWith('.md')) continue;
      const stem = f.replace(/\.md$/, '');
      pushEntity({
        id: entityId('Doc', stem),
        type: 'Doc',
        name: stem,
        path: path.join('docs', f)
      });
    }
  }

  const sopsDir = path.join(kitRoot, 'SOPs');
  if (fs.existsSync(sopsDir)) {
    for (const f of fs.readdirSync(sopsDir).sort()) {
      if (!f.endsWith('.md')) continue;
      const stem = f.replace(/\.md$/, '');
      const rel = path.join('SOPs', f);
      const body = safeRead(path.join(kitRoot, rel)) ?? '';
      pushEntity({
        id: entityId('SOP', stem),
        type: 'SOP',
        name: stem,
        path: rel
      });

      const philosophyIds = new Set(listPhilosophySections(kitRoot).map((s) => s.id));
      for (const target of collectMarkdownTargets(body)) {
        const norm = target.replace(/^\.\.\//, '').replace(/^\.\//, '');
        const docsMatch = norm.match(/(?:^|\/)docs\/([^/]+?)(?:\.md)?$/);
        if (docsMatch) {
          addEdge(
            edges,
            seenEdges,
            entityId('SOP', stem),
            'references',
            entityId('Doc', docsMatch[1].replace(/\.md$/, ''))
          );
        }
      }
      for (const sm of body.matchAll(/§\s*(\d+)/g)) {
        if (!philosophyIds.has(sm[1])) continue;
        addEdge(
          edges,
          seenEdges,
          entityId('SOP', stem),
          'implements',
          entityId('PhilosophySection', sm[1])
        );
      }
    }
  }

  // Host subagent stubs (thin adapters over role skills)
  const agentsDir = path.join(kitRoot, 'agents');
  if (fs.existsSync(agentsDir)) {
    for (const file of fs.readdirSync(agentsDir).sort()) {
      if (!file.endsWith('.md') || file.toLowerCase() === 'readme.md') continue;
      const rel = path.join('agents', file);
      if (skipIgnored(rel)) continue;
      const body = safeRead(path.join(agentsDir, file));
      if (!body) continue;
      const fm = parseFrontmatter(body) ?? {};
      const name =
        typeof fm.name === 'string' && fm.name.trim() ? fm.name.trim() : file.replace(/\.md$/i, '');
      const readonly = fm.readonly === true;
      pushEntity({
        id: entityId('Subagent', name),
        type: 'Subagent',
        name,
        path: rel,
        attrs: { readonly, skill: name }
      });
      addEdge(edges, seenEdges, entityId('Subagent', name), 'adapts', entityId('Skill', name));
      addEdge(edges, seenEdges, entityId('Subagent', name), 'references', entityId('Doc', 'subagents'));
      for (const target of collectMarkdownTargets(body)) {
        const sopMatch = target.match(/SOPs\/([^/#]+?)(?:\.md)?(?:#|$)/);
        if (sopMatch) {
          addEdge(edges, seenEdges, entityId('Subagent', name), 'loads', entityId('SOP', sopMatch[1]));
        }
        const docsMatch = target.match(/(?:^|\/)docs\/([^/#]+?)(?:\.md)?(?:#|$)/);
        if (docsMatch) {
          addEdge(
            edges,
            seenEdges,
            entityId('Subagent', name),
            'references',
            entityId('Doc', docsMatch[1])
          );
        }
      }
    }
  }

  // MCP servers from catalog
  const catalogPath = path.join(kitRoot, 'mcps', 'catalog.json');
  const catalogRaw = safeRead(catalogPath);
  if (catalogRaw) {
    try {
      const catalog = JSON.parse(catalogRaw) as { servers?: Array<{ id: string; name?: string }> };
      for (const s of catalog.servers ?? []) {
        pushEntity({
          id: entityId('McpServer', s.id),
          type: 'McpServer',
          name: s.id,
          path: path.join('mcps', 'servers', s.id, 'server.json'),
          attrs: { displayName: s.name }
        });
      }
    } catch {
    }
  }

  const skillsDir = path.join(kitRoot, 'skills');
  if (fs.existsSync(skillsDir)) {
    for (const name of fs.readdirSync(skillsDir).sort()) {
      const skillPath = path.join(skillsDir, name, 'SKILL.md');
      const rel = path.join('skills', name, 'SKILL.md');
      if (skipIgnored(rel)) continue;
      const body = safeRead(skillPath);
      if (!body) continue;
      const fm = parseFrontmatter(body) ?? {};
      const phase = typeof fm.phase === 'string' ? fm.phase : undefined;
      const dependsOn = asStringArray(fm['depends-on']);
      const mcp = asStringArray(fm.mcp);
      pushEntity({
        id: entityId('Skill', name),
        type: 'Skill',
        name,
        path: rel,
        attrs: {
          kind: fm.kind,
          phase,
          triggers: asStringArray(fm.triggers),
          dependsOn,
          mcp
        }
      });

      for (const dep of dependsOn) {
        addEdge(edges, seenEdges, entityId('Skill', name), 'depends-on', entityId('Skill', dep));
      }
      for (const m of mcp) {
        addEdge(edges, seenEdges, entityId('Skill', name), 'uses', entityId('McpServer', m));
      }
      for (const target of collectMarkdownTargets(body)) {
        const sopMatch = target.match(/SOPs\/([^/#]+?)(?:\.md)?(?:#|$)/);
        if (sopMatch) {
          addEdge(
            edges,
            seenEdges,
            entityId('Skill', name),
            'loads',
            entityId('SOP', sopMatch[1])
          );
        }
        const docsMatch = target.match(/(?:^|\/)docs\/([^/#]+?)(?:\.md)?(?:#|$)/);
        if (docsMatch) {
          addEdge(
            edges,
            seenEdges,
            entityId('Skill', name),
            'references',
            entityId('Doc', docsMatch[1])
          );
        }
      }
    }
  }

  // Eval suites (top-level + goldens/). Gates only from explicit suite metadata.
  const eddDir = path.join(kitRoot, 'evals', 'edd');
  const eddYamls: string[] = [];
  if (fs.existsSync(eddDir)) {
    for (const f of fs.readdirSync(eddDir).sort()) {
      if (f.endsWith('.yaml') || f.endsWith('.yml')) eddYamls.push(f);
    }
    const goldensDir = path.join(eddDir, 'goldens');
    if (fs.existsSync(goldensDir)) {
      for (const f of fs.readdirSync(goldensDir).sort()) {
        if (f.endsWith('.yaml') || f.endsWith('.yml')) eddYamls.push(path.join('goldens', f));
      }
    }
  }
  for (const f of eddYamls) {
    const stem = f.replace(/\.ya?ml$/, '').replace(/[/\\]/g, '_');
    const rel = path.join('evals', 'edd', f);
    if (skipIgnored(rel)) continue;
    const body = safeRead(path.join(kitRoot, rel)) ?? '';
    pushEntity({
      id: entityId('EvalSuite', stem),
      type: 'EvalSuite',
      name: stem,
      path: rel
    });

    try {
      const parsed = parseYaml(body) as Record<string, unknown> | null;
      const ontologyMeta =
        parsed && typeof parsed === 'object' && parsed.ontology && typeof parsed.ontology === 'object'
          ? (parsed.ontology as Record<string, unknown>)
          : null;
      const gates = asStringArray(ontologyMeta?.gates);
      for (const targetId of gates) {
        if (!targetId.includes(':')) continue;
        addEdge(edges, seenEdges, entityId('EvalSuite', stem), 'gates', targetId);
      }
    } catch {
    }
  }

  // Skill-local evals (path-derived - portable for any skill name)
  if (fs.existsSync(skillsDir)) {
    for (const name of fs.readdirSync(skillsDir).sort()) {
      const evalPath = path.join(skillsDir, name, 'evals', 'eval.json');
      if (!fs.existsSync(evalPath)) continue;
      const suiteName = `skill-${name}`;
      pushEntity({
        id: entityId('EvalSuite', suiteName),
        type: 'EvalSuite',
        name: suiteName,
        path: path.join('skills', name, 'evals', 'eval.json')
      });
      addEdge(
        edges,
        seenEdges,
        entityId('EvalSuite', suiteName),
        'gates',
        entityId('Skill', name)
      );
    }
  }

  // Handovers under kit handover/ and optional ~/.agents not scanned at generate time for portability.
  // Index kit-local handover/<project>/ only.
  const handoverRoot = path.join(kitRoot, 'handover');
  if (fs.existsSync(handoverRoot)) {
    for (const project of fs.readdirSync(handoverRoot).sort()) {
      const dir = path.join(handoverRoot, project);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const f of fs.readdirSync(dir).sort()) {
        if (!f.startsWith('handover_') || !f.endsWith('.md')) continue;
        const rel = path.join('handover', project, f);
        if (skipIgnored(rel)) continue;
        const phase = f.replace(/^handover_/, '').replace(/\.md$/, '');
        const idName = `${project}/${phase}`;
        pushEntity({
          id: entityId('Handover', idName),
          type: 'Handover',
          name: idName,
          path: rel,
          attrs: { project, phase }
        });
        if (schema.phaseOrder.includes(phase) || phase === 'grilling') {
          addEdge(
            edges,
            seenEdges,
            entityId('Handover', idName),
            'for',
            entityId('Phase', phase === 'grilling' ? 'grilling' : phase)
          );
        }
      }
    }
  }

  // Drop edges whose endpoints are missing (dangling skill depends-on still emitted above;
  // referential check will fail them intentionally).
  const keptEdges = edges.filter((e) => entityIds.has(e.from) && entityIds.has(e.to));
  edges.length = 0;
  edges.push(...keptEdges);

  entities.sort((a, b) => a.id.localeCompare(b.id));
  edges.sort((a, b) =>
    a.from.localeCompare(b.from) || a.relation.localeCompare(b.relation) || a.to.localeCompare(b.to)
  );

  return {
    version: schema.version,
    generatedFrom: 'ontology/schema.yaml',
    entities,
    edges
  };
}

export function serializeOntologyIndex(index: OntologyIndex): string {
  return `${JSON.stringify(index, null, 2)}\n`;
}

/** Runtime cache path (gitignored under sync/). */
export function ontologyCachePath(kitRoot: string): string {
  return path.join(kitRoot, 'sync', 'ontology-index.json');
}

/** Homepage copy for the web public tree (gitignored; written at generate / Pages deploy). */
export function siteOntologyIndexPath(kitRoot: string): string {
  return path.join(kitRoot, 'web', 'public', 'assets', 'ontology-index.json');
}

/**
 * Resolve the ontology index by generating from the live kit tree.
 * Optional short-lived cache under sync/ invalidated when schema or source dirs change.
 * A cache that predates a schema type (for example Subagent) is ignored.
 */
export function staleOntologyCacheTypes(kitRoot: string, index: OntologyIndex): string[] {
  const schema = loadOntologySchema(kitRoot);
  const present = new Set(index.entities.map((e) => e.type));
  const missing: string[] = [];
  if (schema.types.includes('Subagent')) {
    const agentsDir = path.join(kitRoot, 'agents');
    let hasStub = false;
    try {
      hasStub =
        fs.existsSync(agentsDir) &&
        fs.readdirSync(agentsDir).some((f) => f.endsWith('.md') && f !== 'README.md');
    } catch {
      hasStub = false;
    }
    if (hasStub && !present.has('Subagent')) missing.push('Subagent');
  }
  return missing;
}

export function resolveOntologyIndex(kitRoot: string, opts?: { useCache?: boolean }): OntologyIndex {
  const useCache = opts?.useCache !== false;
  const cachePath = ontologyCachePath(kitRoot);
  if (useCache && fs.existsSync(cachePath)) {
    try {
      const cacheStat = fs.statSync(cachePath);
      if (cacheStat.mtimeMs >= latestOntologySourceMtime(kitRoot)) {
        const raw = safeRead(cachePath);
        if (raw) {
          const cached = JSON.parse(raw) as OntologyIndex;
          if (staleOntologyCacheTypes(kitRoot, cached).length === 0) return cached;
        }
      }
    } catch {
    }
  }
  const index = generateOntologyIndex(kitRoot);
  if (useCache) {
    try {
      fs.mkdirSync(path.dirname(cachePath), { recursive: true });
      fs.writeFileSync(cachePath, serializeOntologyIndex(index), 'utf8');
    } catch {
    }
  }
  return index;
}

function latestOntologySourceMtime(kitRoot: string): number {
  const roots = [
    path.join(kitRoot, 'ontology', 'schema.yaml'),
    path.join(kitRoot, 'CODING_PHILOSOPHY.md'),
    path.join(kitRoot, 'skills'),
    path.join(kitRoot, 'agents'),
    path.join(kitRoot, 'SOPs'),
    path.join(kitRoot, 'docs'),
    path.join(kitRoot, 'mcps', 'catalog.json'),
    path.join(kitRoot, 'evals', 'edd'),
    path.join(kitRoot, 'kit', 'src', 'ontology')
  ];
  let latest = 0;
  const visit = (p: string) => {
    try {
      if (!fs.existsSync(p)) return;
      const st = fs.statSync(p);
      if (st.isFile()) {
        latest = Math.max(latest, st.mtimeMs);
        return;
      }
      if (st.isDirectory()) {
        latest = Math.max(latest, st.mtimeMs);
        for (const name of fs.readdirSync(p)) {
          // Shallow enough for freshness; nested skill SKILL.md changes bump dir mtime on most FS
          visit(path.join(p, name));
        }
      }
    } catch {
    }
  };
  for (const r of roots) visit(r);
  return latest;
}

/** Optional debug dump to sync/ (not committed). */
export function writeOntologyIndex(
  kitRoot: string,
  index: OntologyIndex = generateOntologyIndex(kitRoot)
): string {
  const out = ontologyCachePath(kitRoot);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, serializeOntologyIndex(index), 'utf8');
  return out;
}

/** Sync cache plus the web public homepage JSON. Neither file is source of truth. */
export function writeSiteOntologyIndex(
  kitRoot: string,
  index: OntologyIndex = generateOntologyIndex(kitRoot)
): { cachePath: string; sitePath: string } {
  const cachePath = writeOntologyIndex(kitRoot, index);
  const sitePath = siteOntologyIndexPath(kitRoot);
  fs.mkdirSync(path.dirname(sitePath), { recursive: true });
  fs.writeFileSync(sitePath, serializeOntologyIndex(toHomepageIndex(index)), 'utf8');
  return { cachePath, sitePath };
}

/** @deprecated Prefer resolveOntologyIndex - always derived. */
export function loadOntologyIndex(kitRoot: string): OntologyIndex {
  return resolveOntologyIndex(kitRoot);
}

export function getEntity(index: OntologyIndex, id: string): OntologyEntity | null {
  const needle = id.trim();
  return (
    index.entities.find((e) => e.id === needle || e.name === needle) ??
    index.entities.find((e) => e.id.endsWith(`:${needle}`)) ??
    null
  );
}

export function getRelated(
  index: OntologyIndex,
  id: string,
  relation?: RelationName
): Array<OntologyEdge & { entity?: OntologyEntity }> {
  const entity = getEntity(index, id);
  if (!entity) return [];
  return index.edges
    .filter((e) => e.from === entity.id && (relation ? e.relation === relation : true))
    .map((e) => ({
      ...e,
      entity: index.entities.find((ent) => ent.id === e.to)
    }));
}
