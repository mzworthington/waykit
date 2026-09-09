import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  assemblePagesSite,
  PAGES_SITE_ENTRIES,
  PAGES_SITE_HOST,
  WEB_DIST_REL
} from './assemble.js';
import { kitRootFrom } from '../shared/paths.js';

const kitRoot = kitRootFrom(import.meta.url);

function writeTree(root: string, files: Record<string, string>): void {
  for (const [rel, body] of Object.entries(files)) {
    const dest = path.join(root, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, body, 'utf8');
  }
}

function listRel(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      const rel = path.relative(root, abs).split(path.sep).join('/');
      if (fs.statSync(abs).isDirectory()) walk(abs);
      else out.push(rel);
    }
  };
  walk(root);
  return out.sort();
}

const stubPublic = {
  'llms.txt': '# kit',
  'robots.txt': 'Allow: /',
  LICENSE: 'Unlicense',
  'docs/edd.md': '# edd',
  'evals/edd/demo.yaml': 'name: demo',
  'SOPs/context-budget.md': '# budget',
  'mcps/README.md': '# mcp',
  'ontology/README.md': '# ontology',
  [`${WEB_DIST_REL}/index.html`]: '<html><div id="root"></div></html>'
};

describe('PAGES_SITE_ENTRIES', () => {
  it('allowlists public markdown, not the web app source', () => {
    assert.ok(PAGES_SITE_ENTRIES.includes('docs'));
    assert.ok(PAGES_SITE_ENTRIES.includes('evals/edd'));
    assert.ok(PAGES_SITE_ENTRIES.includes('SOPs'));
    assert.ok(PAGES_SITE_ENTRIES.includes('ontology'));
    assert.ok(!PAGES_SITE_ENTRIES.includes('assets'));
    assert.ok(!PAGES_SITE_ENTRIES.includes('index.html'));
    assert.ok(!PAGES_SITE_ENTRIES.includes('skills'));
    assert.ok(!PAGES_SITE_ENTRIES.includes('node_modules'));
  });
});

describe('assemblePagesSite', () => {
  it('copies the web dist plus allowlisted markdown and writes the Pages CNAME', () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-site-src-'));
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-site-dest-'));
    try {
      writeTree(src, {
        ...stubPublic,
        'skills/agent-tdd/SKILL.md': '# secret',
        'package.json': '{}'
      });
      const result = assemblePagesSite({ kitRoot: src, dest });
      const files = listRel(dest);
      assert.equal(result.dest, dest);
      assert.equal(fs.readFileSync(path.join(dest, 'CNAME'), 'utf8').trim(), PAGES_SITE_HOST);
      assert.ok(files.includes('index.html'));
      assert.ok(files.includes('docs/edd.md'));
      assert.ok(files.includes('evals/edd/demo.yaml'));
      assert.ok(!files.includes('skills/agent-tdd/SKILL.md'));
      assert.ok(!files.includes('package.json'));
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      fs.rmSync(dest, { recursive: true, force: true });
    }
  });

  it('fails when the web dist is missing', () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-site-missing-'));
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-site-dest-'));
    try {
      writeTree(src, { 'docs/edd.md': '# edd' });
      assert.throws(() => assemblePagesSite({ kitRoot: src, dest }), /web\/dist/);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      fs.rmSync(dest, { recursive: true, force: true });
    }
  });

  it('replaces an existing dest so stale files do not leak into the artifact', () => {
    const src = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-site-src-'));
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-site-dest-'));
    try {
      writeTree(src, stubPublic);
      fs.writeFileSync(path.join(dest, 'stale.txt'), 'leak');
      assemblePagesSite({ kitRoot: src, dest });
      assert.equal(fs.existsSync(path.join(dest, 'stale.txt')), false);
    } finally {
      fs.rmSync(src, { recursive: true, force: true });
      fs.rmSync(dest, { recursive: true, force: true });
    }
  });
});

describe('landing page assets', () => {
  it('keeps the public site in web/ instead of a hand-maintained root index.html', () => {
    assert.ok(fs.existsSync(path.join(kitRoot, 'web/src/pages/index.astro')));
    assert.ok(fs.existsSync(path.join(kitRoot, 'web/astro.config.ts')));
    assert.equal(fs.existsSync(path.join(kitRoot, 'index.html')), false);
    assert.equal(fs.existsSync(path.join(kitRoot, 'web/index.html')), false);
    assert.ok(fs.existsSync(path.join(kitRoot, 'web/public/assets/kit_logo_256.webp')));
    assert.ok(fs.existsSync(path.join(kitRoot, 'web/public/assets/kit-mark.svg')));
    assert.equal(fs.existsSync(path.join(kitRoot, 'assets/kit_logo_256.webp')), false);
    const favicon = fs.readFileSync(path.join(kitRoot, 'web/public/favicon.ico'));
    assert.ok(favicon.length > 100);
    assert.deepEqual([...favicon.subarray(0, 4)], [0, 0, 1, 0]);
    const png32 = fs.readFileSync(path.join(kitRoot, 'web/public/assets/favicon-32.png'));
    assert.deepEqual([...png32.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  });

  it('Pages workflow builds the web app then uploads site/', () => {
    const yml = fs.readFileSync(path.join(kitRoot, '.github/workflows/deploy-pages.yml'), 'utf8');
    assert.match(yml, /pnpm --dir web build/);
    assert.match(yml, /pnpm wk site assemble/);
    assert.match(yml, /path: 'site'/);
    assert.doesNotMatch(yml, /path: '\.'/);
  });

  it('asks Googlebot not to index raw markdown while leaving the HTML sitemap as the indexable map', () => {
    const robots = fs.readFileSync(path.join(kitRoot, 'robots.txt'), 'utf8');
    assert.match(robots, /User-agent: Googlebot/);
    assert.match(robots, /Disallow: \/\*\.md\$/);
    assert.match(robots, /Sitemap: https:\/\/waykit\.dev\/sitemap\.xml/);
    assert.equal(fs.existsSync(path.join(kitRoot, 'sitemap.xml')), false);
  });
});
