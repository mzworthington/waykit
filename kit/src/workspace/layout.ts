import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

export interface WaykitPaths {
  handover: string;
  spec: string;
  glossary: string;
  specArchive: string;
}

export const DEFAULT_PATHS: WaykitPaths = {
  handover: '.waykit/handover',
  spec: 'docs/spec',
  glossary: 'docs/glossary.md',
  specArchive: 'docs/spec/archive'
};

export const DEFAULT_WAYKIT_CONFIG = [
  'handover: .waykit/handover',
  'spec: docs/spec',
  'glossary: docs/glossary.md',
  'specArchive: docs/spec/archive',
  ''
].join('\n');

export function readWaykitPaths(repoDir: string): WaykitPaths {
  const configPath = path.join(repoDir, '.waykit', 'config.yaml');
  if (!fs.existsSync(configPath)) return { ...DEFAULT_PATHS };
  const parsed = parseYaml(fs.readFileSync(configPath, 'utf8')) as Partial<WaykitPaths>;
  return {
    handover: parsed.handover ?? DEFAULT_PATHS.handover,
    spec: parsed.spec ?? DEFAULT_PATHS.spec,
    glossary: parsed.glossary ?? DEFAULT_PATHS.glossary,
    specArchive: parsed.specArchive ?? DEFAULT_PATHS.specArchive
  };
}

export function seedWorkspace(repoDir: string): void {
  const dir = path.join(repoDir, '.waykit');
  fs.mkdirSync(dir, { recursive: true });
  const configPath = path.join(dir, 'config.yaml');
  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, DEFAULT_WAYKIT_CONFIG, 'utf8');
  }
  const pointerPath = path.join(dir, 'POINTER');
  if (!fs.existsSync(pointerPath)) {
    fs.writeFileSync(pointerPath, 'paths: .waykit/config.yaml\n', 'utf8');
  }
  const ignorePath = path.join(repoDir, '.gitignore');
  const line = '.waykit/handover/\n';
  const existing = fs.existsSync(ignorePath) ? fs.readFileSync(ignorePath, 'utf8') : '';
  if (!existing.includes('.waykit/handover/')) {
    fs.appendFileSync(ignorePath, existing.endsWith('\n') || existing.length === 0 ? line : `\n${line}`, 'utf8');
  }
}

export function archiveSpec(repoDir: string, specFile: string, living: string): void {
  const paths = readWaykitPaths(repoDir);
  const specDir = path.join(repoDir, paths.spec);
  const archiveDir = path.join(repoDir, paths.specArchive);
  fs.mkdirSync(archiveDir, { recursive: true });
  fs.renameSync(path.join(specDir, specFile), path.join(archiveDir, specFile));
  fs.writeFileSync(path.join(specDir, 'living.md'), living, 'utf8');
}

export function readRepoHandover(
  repoDir: string,
  project: string,
  phase?: string,
  homeDir?: string
): { path: string; body: string } | null {
  const dir = path.join(repoDir, readWaykitPaths(repoDir).handover, project);
  if (homeDir !== undefined && dir.startsWith(homeDir)) return null;
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((name) => name.startsWith('handover_') && name.endsWith('.md'))
    .sort();
  const target = phase ? files.find((name) => name.includes(phase)) : files[files.length - 1];
  if (!target) return null;
  const full = path.join(dir, target);
  return { path: full, body: fs.readFileSync(full, 'utf8') };
}
