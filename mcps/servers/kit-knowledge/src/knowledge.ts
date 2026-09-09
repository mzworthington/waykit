/**
 * Kit-knowledge retrieval helpers (pure). Used by the MCP server and unit tests.
 * Returns chunks - never dump entire philosophy/SOP trees into the model context.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import {
  getEntity as ontologyGetEntity,
  getRelated as ontologyGetRelated,
  resolveOntologyIndex,
  type OntologyEntity,
  type OntologyIndex,
  type RelationName,
} from "../../../../kit/src/ontology/index.js";

export type KitDocKind = "philosophy" | "sop" | "skill" | "handover" | "docs";

export interface KitHit {
  kind: KitDocKind;
  id: string;
  path: string;
  title: string;
  excerpt: string;
  score: number;
}

export interface PhilosophySection {
  id: string;
  title: string;
  body: string;
}

const MAX_EXCERPT = 600;
const MAX_HITS = 8;
const MAX_SOP_CHARS = 4000;

export function resolveKitRoot(env: NodeJS.ProcessEnv = process["env"]): string {
  if (env.KIT_ROOT && env.KIT_ROOT.trim()) {
    return path.resolve(env.KIT_ROOT);
  }
  const agents = path.join(os.homedir(), ".agents");
  if (fs.existsSync(path.join(agents, "AGENTS.md"))) {
    return agents;
  }
  // Running from the kit repo checkout (mcps/servers/kit-knowledge/src → repo root)
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
}

function safeRead(filePath: string): string | null {
  try {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9_+./-]+/)
    .filter((t) => t.length >= 2);
}

function scoreText(text: string, tokens: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const t of tokens) {
    if (lower.includes(t)) score += 1;
  }
  return score;
}

function excerptAround(text: string, tokens: string[]): string {
  const lower = text.toLowerCase();
  let idx = -1;
  for (const t of tokens) {
    const i = lower.indexOf(t);
    if (i >= 0 && (idx < 0 || i < idx)) idx = i;
  }
  if (idx < 0) {
    return text.slice(0, MAX_EXCERPT).trim();
  }
  const start = Math.max(0, idx - 120);
  const end = Math.min(text.length, start + MAX_EXCERPT);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return prefix + text.slice(start, end).trim() + suffix;
}

export function listPhilosophySections(kitRoot: string): PhilosophySection[] {
  const raw = safeRead(path.join(kitRoot, "CODING_PHILOSOPHY.md"));
  if (!raw) return [];
  const sections: PhilosophySection[] = [];
  const parts = raw.split(/^## /m);
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i];
    const nl = block.indexOf("\n");
    const titleLine = (nl >= 0 ? block.slice(0, nl) : block).trim();
    const body = (nl >= 0 ? block.slice(nl + 1) : "").trim();
    const idMatch = titleLine.match(/^(\d+)\.\s*(.+)$/);
    const id = idMatch ? idMatch[1] : String(i);
    const title = idMatch ? idMatch[2] : titleLine;
    sections.push({ id, title, body: `## ${titleLine}\n\n${body}` });
  }
  return sections;
}

export function getPhilosophySection(
  kitRoot: string,
  section: string
): PhilosophySection | null {
  const needle = section.trim().toLowerCase();
  const sections = listPhilosophySections(kitRoot);
  return (
    sections.find(
      (s) =>
        s.id === needle ||
        s.title.toLowerCase() === needle ||
        s.title.toLowerCase().includes(needle) ||
        `§${s.id}` === needle ||
        s.id === needle.replace(/^§/, "")
    ) ?? null
  );
}

function listSopFiles(kitRoot: string): string[] {
  const dir = path.join(kitRoot, "SOPs");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => path.join(dir, f));
}

export function getSop(kitRoot: string, name: string): { id: string; path: string; body: string } | null {
  const dir = path.join(kitRoot, "SOPs");
  const stem = name.replace(/\.md$/i, "").toLowerCase();
  const candidates = [
    path.join(dir, `${stem}.md`),
    ...listSopFiles(kitRoot).filter((p) =>
      path.basename(p).toLowerCase().includes(stem)
    ),
  ];
  for (const p of candidates) {
    const body = safeRead(p);
    if (body) {
      const clipped =
        body.length > MAX_SOP_CHARS
          ? body.slice(0, MAX_SOP_CHARS) +
            `\n\n…truncated (${body.length - MAX_SOP_CHARS} chars). Prefer search_kit for another slice.`
          : body;
      return { id: path.basename(p, ".md"), path: p, body: clipped };
    }
  }
  return null;
}

export function getHandover(
  kitRoot: string,
  project: string,
  phase?: string
): { path: string; body: string } | null {
  const base = path.join(os.homedir(), ".agents", "handover", project);
  const alt = path.join(kitRoot, "handover", project);
  const dir = fs.existsSync(base) ? base : alt;
  if (!fs.existsSync(dir)) return null;

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("handover_") && f.endsWith(".md"))
    .sort();

  let target: string | undefined;
  if (phase) {
    const want = `handover_${phase.replace(/^handover_/, "")}.md`;
    target = files.find((f) => f === want || f.includes(phase));
  } else {
    target = files[files.length - 1];
  }
  if (!target) return null;
  const full = path.join(dir, target);
  const body = safeRead(full);
  if (!body) return null;
  const clipped =
    body.length > MAX_SOP_CHARS
      ? body.slice(0, MAX_SOP_CHARS) + "\n\n…truncated."
      : body;
  return { path: full, body: clipped };
}

export function listKitIndex(kitRoot: string): string {
  const lines: string[] = [];
  lines.push(`wk _ROOT=${kitRoot}`);
  lines.push("");
  lines.push("## Philosophy sections");
  for (const s of listPhilosophySections(kitRoot)) {
    lines.push(`- §${s.id} ${s.title}`);
  }
  lines.push("");
  lines.push("## SOPs");
  for (const p of listSopFiles(kitRoot)) {
    lines.push(`- ${path.basename(p, ".md")}`);
  }
  lines.push("");
  lines.push("## Skills (names only)");
  const skillsDir = path.join(kitRoot, "skills");
  if (fs.existsSync(skillsDir)) {
    for (const name of fs.readdirSync(skillsDir).sort()) {
      if (fs.existsSync(path.join(skillsDir, name, "SKILL.md"))) {
        lines.push(`- ${name}`);
      }
    }
  }
  lines.push("");
  lines.push("Use get_philosophy_section, get_sop, get_handover, or search_kit - do not bulk-read.");
  return lines.join("\n");
}

export function searchKit(kitRoot: string, query: string, limit = MAX_HITS): KitHit[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const hits: KitHit[] = [];

  for (const s of listPhilosophySections(kitRoot)) {
    const blob = `${s.title}\n${s.body}`;
    const score = scoreText(blob, tokens) * 2;
    if (score > 0) {
      hits.push({
        kind: "philosophy",
        id: s.id,
        path: "CODING_PHILOSOPHY.md",
        title: `§${s.id} ${s.title}`,
        excerpt: excerptAround(blob, tokens),
        score,
      });
    }
  }

  for (const p of listSopFiles(kitRoot)) {
    const body = safeRead(p) ?? "";
    const id = path.basename(p, ".md");
    const score = scoreText(`${id}\n${body}`, tokens);
    if (score > 0) {
      hits.push({
        kind: "sop",
        id,
        path: path.relative(kitRoot, p),
        title: id,
        excerpt: excerptAround(body, tokens),
        score,
      });
    }
  }

  const skillsDir = path.join(kitRoot, "skills");
  if (fs.existsSync(skillsDir)) {
    for (const name of fs.readdirSync(skillsDir)) {
      const skillPath = path.join(skillsDir, name, "SKILL.md");
      const body = safeRead(skillPath);
      if (!body) continue;
      // Prefer frontmatter description + first ~40 lines for scoring, not full body dump
      const head = body.slice(0, 2500);
      const score = scoreText(`${name}\n${head}`, tokens);
      if (score > 0) {
        hits.push({
          kind: "skill",
          id: name,
          path: path.relative(kitRoot, skillPath),
          title: name,
          excerpt: excerptAround(head, tokens),
          score,
        });
      }
    }
  }

  const docsDir = path.join(kitRoot, "docs");
  if (fs.existsSync(docsDir)) {
    for (const f of fs.readdirSync(docsDir)) {
      if (!f.endsWith(".md")) continue;
      const p = path.join(docsDir, f);
      const body = safeRead(p) ?? "";
      const score = scoreText(`${f}\n${body}`, tokens);
      if (score > 0) {
        hits.push({
          kind: "docs",
          id: f.replace(/\.md$/, ""),
          path: path.relative(kitRoot, p),
          title: f,
          excerpt: excerptAround(body, tokens),
          score,
        });
      }
    }
  }

  return hits
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, Math.max(1, Math.min(limit, 20)));
}

export function loadKitOntology(kitRoot: string): OntologyIndex {
  return resolveOntologyIndex(kitRoot);
}

export function getKitEntity(
  kitRoot: string,
  id: string
): OntologyEntity | null {
  const index = resolveOntologyIndex(kitRoot);
  return ontologyGetEntity(index, id);
}

export function getKitRelated(
  kitRoot: string,
  id: string,
  relation?: string
): ReturnType<typeof ontologyGetRelated> {
  const index = resolveOntologyIndex(kitRoot);
  return ontologyGetRelated(
    index,
    id,
    relation ? (relation as RelationName) : undefined
  );
}
