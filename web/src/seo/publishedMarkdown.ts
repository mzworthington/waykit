import fs from 'node:fs';
import path from 'node:path';
import { fileToRoute, shouldPublishMarkdown } from '../docs/catalog';

function walkMarkdown(dir: string, acc: string[] = []): string[] {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name);
    if (fs.statSync(abs).isDirectory()) walkMarkdown(abs, acc);
    else if (name.endsWith('.md')) acc.push(abs);
  }
  return acc;
}

export function listPublishedMarkdownFiles(kitRoot: string): Array<{ file: string; markdown: string }> {
  const roots = [
    path.join(kitRoot, 'docs'),
    path.join(kitRoot, 'SOPs'),
    path.join(kitRoot, 'evals', 'edd'),
    path.join(kitRoot, 'mcps', 'README.md'),
    path.join(kitRoot, 'ontology', 'README.md')
  ];
  const files: string[] = [];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    if (fs.statSync(root).isDirectory()) walkMarkdown(root, files);
    else files.push(root);
  }
  return files
    .map((abs) => ({
      file: path.relative(kitRoot, abs).split(path.sep).join('/'),
      markdown: fs.readFileSync(abs, 'utf8')
    }))
    .filter((entry) => shouldPublishMarkdown(entry.file));
}

export function publishedSeoRoutes(kitRoot: string): string[] {
  return ['/', '/privacy', ...listPublishedMarkdownFiles(kitRoot).map((entry) => fileToRoute(entry.file))];
}
