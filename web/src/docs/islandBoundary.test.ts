import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const srcRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function readSrc(rel: string): string {
  return fs.readFileSync(path.join(srcRoot, rel), 'utf8');
}

describe('client islands stay off the markdown glob', () => {
  it('does not import docs/pages from SiteNav or MarkdownView', () => {
    expect(readSrc('components/SiteNav.tsx')).not.toMatch(/docs\/pages/);
    expect(readSrc('components/MarkdownView.tsx')).not.toMatch(/docs\/pages/);
    expect(readSrc('components/DocsWidget.tsx')).not.toMatch(/docs\/pages/);
    expect(readSrc('components/MermaidPreview.tsx')).not.toMatch(/docs\/pages/);
  });

  it('keeps markdown overlay in assemble, not the Astro sitemap hook', () => {
    expect(readSrc('integrations/kitPages.ts')).not.toMatch(/overlayKitPublic/);
  });
});

describe('docs mermaid island in Vite dev', () => {
  it('pins mermaid in optimizeDeps.include so dynamic import does not 504 on a stale hash', () => {
    const config = fs.readFileSync(path.join(srcRoot, '../astro.config.ts'), 'utf8');
    expect(config).toMatch(/optimizeDeps:\s*\{[^}]*include:\s*\[[^\]]*['"]mermaid['"]/);
  });
});
