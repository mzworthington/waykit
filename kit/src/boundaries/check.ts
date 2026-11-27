import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

export interface BoundaryCheckResult {
  ok: boolean;
  detail: string;
}

interface Layer {
  name: string;
  paths: string[];
}

interface Manifest {
  layers: Layer[];
  forbidden: { from: string; to: string }[];
}

export function checkBoundaries(repoDir: string): BoundaryCheckResult {
  const manifestPath = path.join(repoDir, 'boundaries.yaml');
  if (!fs.existsSync(manifestPath)) {
    return { ok: true, detail: 'skip boundaries.yaml: no boundaries manifest' };
  }
  const raw = fs.readFileSync(manifestPath, 'utf8');
  const manifest = parseYaml(raw) as Manifest;
  const violations: string[] = [];
  for (const layer of manifest.layers) {
    for (const rel of layer.paths) {
      for (const file of tsFiles(path.join(repoDir, rel))) {
        const text = fs.readFileSync(file, 'utf8');
        for (const spec of importSpecifiers(text)) {
          if (!spec.startsWith('.')) continue;
          const resolved = path.resolve(path.dirname(file), spec);
          const target = layerOf(manifest.layers, repoDir, resolved);
          if (!target || target === layer.name) continue;
          const forbidden = manifest.forbidden.some((edge) => edge.from === layer.name && edge.to === target);
          if (forbidden) violations.push(`${layer.name} -> ${target}`);
        }
      }
    }
  }
  if (violations.length === 0) return { ok: true, detail: '' };
  return { ok: false, detail: violations.join('\n') };
}

function layerOf(layers: Layer[], repoDir: string, resolved: string): string | undefined {
  const fileRel = path.relative(repoDir, resolved).split(path.sep).join('/');
  let best: { name: string; length: number } | undefined;
  for (const layer of layers) {
    for (const prefix of layer.paths) {
      const norm = prefix.split(path.sep).join('/');
      if (fileRel === norm || fileRel.startsWith(`${norm}/`)) {
        if (!best || norm.length > best.length) best = { name: layer.name, length: norm.length };
      }
    }
  }
  return best?.name;
}

function tsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...tsFiles(full));
    else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) out.push(full);
  }
  return out;
}

function importSpecifiers(text: string): string[] {
  const specs: string[] = [];
  for (const line of text.split('\n')) {
    const match = line.match(/from\s+['"]([^'"]+)['"]/);
    if (match?.[1]) specs.push(match[1]);
  }
  return specs;
}
