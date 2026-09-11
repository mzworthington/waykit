import { HOME_HEADLINE, HOME_LEDE } from '../landing/copy';

export const SITE_ORIGIN = 'https://waykit.dev';
export const SITE_NAME = 'Waykit';
export const SITE_SHORT_NAME = 'waykit';
export const SITE_MARK_SRC = '/assets/kit-mark.svg';
export const SITE_SOCIAL_IMAGE = `${SITE_ORIGIN}/assets/og.jpg`;
export const SITE_SOCIAL_IMAGE_WIDTH = 1200;
export const SITE_SOCIAL_IMAGE_HEIGHT = 630;
export const SITE_SOCIAL_IMAGE_ALT =
  'Waykit: software lifecycle for coding agents. Grill, spec, TDD, quality, release and learning loops including eval-driven development.';
export const SITE_GITHUB = 'https://github.com/mzworthington/waykit';

export type PageSeo = {
  path: string;
  title: string;
  headline: string;
  description: string;
  excerpt: string;
  canonicalUrl: string;
  ogImageUrl: string;
  ogType: 'website' | 'article';
  indexable: boolean;
  markdownUrl?: string;
  softwareName?: string;
  articleMarkdown?: string;
  breadcrumbs: Array<{ name: string; path: string }>;
};

export type ResolvePageSeoOptions = {
  headline?: string;
  markdown?: string;
  file?: string;
  missing?: boolean;
};

type SeoOverride = {
  headline: string;
  description: string;
  title?: string;
  softwareName?: string;
  indexable?: boolean;
};

const PAGE_SEO: Record<string, SeoOverride> = {
  '/': {
    headline: SITE_NAME,
    title: `${SITE_NAME}: ${HOME_HEADLINE.charAt(0).toLowerCase()}${HOME_HEADLINE.slice(1)}`,
    description: HOME_LEDE,
    softwareName: SITE_NAME
  },
  '/docs': {
    headline: 'Product guide',
    description:
      'Start, practice and reference for Waykit: install, feature lifecycle, live kit graph, learning loops, SOPs, ADRs and the skill map.'
  },
  '/docs/start': {
    headline: 'Getting started',
    description:
      'Install Waykit in about 10 minutes: link ~/.agents, run wk init, then pick debug vs feature. No API key.'
  },
  '/docs/jobs': {
    headline: 'Jobs for today',
    description:
      'Pick a job for today: typo/debug vs product feature, install, fat always-on context, proving a tool call, checking the live kit graph, repo hygiene on sources you own, or consumer handshake drift.'
  },
  '/docs/faq': {
    headline: 'Common questions',
    description:
      'Waykit FAQ: install, API keys, why AGENTS.md stays small, hosts (Cursor, Claude, Copilot, Antigravity), how agents find the right SOP, where EDD alpha fits, repo doctor and what the map is not.'
  },
  '/docs/edd': {
    headline: 'EDD guide (alpha)',
    description:
      'Eval-Driven Development is alpha: a routing and schema harness with a scripted CI gate. Not a full EDD framework. Write cases, mock tools, optionally run live HTTP or CLI judges.'
  },
  '/docs/hosts': {
    headline: 'Hosts',
    description:
      'Cursor, Claude Code, Copilot and Antigravity share AGENTS.md. Waykit writes each host’s MCP file, model overlay and rules pointer. Windsurf is rules-only forever.'
  },
  '/docs/kit': {
    headline: 'What Waykit gives you',
    description:
      'What Waykit installs: thin AGENTS.md handshake, feature lifecycle skills, live kit graph, one MCP profile per session and the wk CLI (align, doctor, check).'
  },
  '/docs/doctor': {
    headline: 'Repo doctor',
    description:
      'wk doctor checks README, license, contributing and GitHub templates on sources you admin. Report-only by default; --write fills gaps and never overwrites.'
  },
  '/docs/align': {
    headline: 'Consumer align',
    description:
      'wk align checks an app repo for a thin handshake, host rule pointers, kit-knowledge MCP and commit-msg. --write seeds missing AGENTS.md and IDE pointers; --owned --scan reports a worktree farm.'
  },
  '/docs/used-in': {
    headline: 'Used on our own product repos',
    description:
      'ArchLens, steerco, the React Cloudflare template and GPIO build monitor run Waykit. Open those GitHub checkouts to see a thin handshake in the wild.'
  },
  '/docs/lifecycle': {
    headline: 'Feature lifecycle',
    description:
      'Route product work through grill, stories, spec, TDD, XFN, telemetry and release. After a bet’s timebox, measure the leading indicator in PostHog, then confirm or kill.'
  },
  '/docs/subagents': {
    headline: 'Host subagent allowlist',
    description:
      'Which Waykit roles become Cursor or Claude subagents, plus the parent→child launch flow. Stack profiles stay skills. TDD gear 1 and gear 2 stay one agent.'
  },
  '/docs/map': {
    headline: 'Waykit map',
    description:
      'Live graph of this kit: skills, host subagents, SOPs, MCPs and evals derived from the tree, feeding kit-knowledge so you load one node instead of the whole kit.'
  },
  '/docs/sops': {
    headline: 'SOPs',
    description:
      'Operator procedures for Waykit: behavior catalog, context budget, conventional commits, evals, Cloudflare analytics ops and PostHog product analytics.'
  },
  '/docs/ADRs': {
    headline: 'Architecture Decision Records',
    description:
      'Sparse MADRs for Waykit: hexagonal defaults, Unlicense, EDD contracts, thin bootstrap, ontology memory and the Astro docs site.'
  },
  '/evals/edd': {
    headline: 'Eval suites',
    description:
      'Offline and live eval suites for Waykit: routing, schemas, Cloudflare ops and the teaching demo you can paste into a PR.'
  },
  '/mcps': {
    headline: 'MCP library',
    description:
      'Named MCP profiles for Waykit sessions: default, cloud, cloudflare-ops and how to install one profile without stacking tools.'
  },
  '/ontology': {
    headline: 'Author the Waykit map',
    description:
      'How to add skills, SOPs and evals to the Waykit map: which files become nodes, how to regenerate the index and why this is not a product architecture diagram.'
  },
  '/privacy': {
    headline: 'Privacy policy',
    description:
      'What waykit.dev does with information: cookieless PostHog on Cloud EU, Cloudflare hosting, no PostHog cookie banner and how to ask for deletion.'
  }
};

const NOINDEX_PATHS = new Set(['/docs/kit-review-backlog', '/404']);

function normalizePathname(pathname: string): string {
  const bare = pathname.split(/[?#]/)[0] ?? pathname;
  return bare.replace(/\/$/, '') || '/';
}

function stripMarkdownChrome(markdown: string): string {
  return markdown.replace(/^---[\s\S]*?---\s*/, '');
}

function firstParagraph(markdown: string): string | undefined {
  const body = stripMarkdownChrome(markdown);
  let inFence = false;
  for (const raw of body.split('\n')) {
    const row = raw.trim();
    if (row.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence || !row) continue;
    if (
      row.startsWith('#') ||
      row.startsWith('>') ||
      row.startsWith('|') ||
      row.startsWith('-[') ||
      row.startsWith('*') ||
      row.startsWith('- ')
    ) {
      continue;
    }
    const cleaned = row.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[*_`]/g, '');
    if (cleaned.length > 40) return cleaned;
  }
  return undefined;
}

export function markdownExcerpt(markdown: string, max = 420): string {
  const body = stripMarkdownChrome(markdown);
  const lines: string[] = [];
  let inFence = false;
  for (const raw of body.split('\n')) {
    const row = raw.trim();
    if (row.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence || !row || row.startsWith('#') || row.startsWith('|')) continue;
    lines.push(row);
  }
  const text = lines
    .join(' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>#]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

function titleFor(headline: string, explicit?: string): string {
  if (explicit) return explicit;
  return `${headline} | ${SITE_NAME}`;
}

function humanizeSegment(segment: string): string {
  return segment.replace(/[-_]/g, ' ');
}

export function breadcrumbsFor(path: string, headline: string): Array<{ name: string; path: string }> {
  const crumbs = [{ name: SITE_NAME, path: '/' }];
  if (path === '/') return crumbs;
  const parts = path.split('/').filter(Boolean);
  let acc = '';
  for (const [index, part] of parts.entries()) {
    acc += `/${part}`;
    const override = PAGE_SEO[acc];
    const isLast = index === parts.length - 1;
    crumbs.push({
      name: isLast ? headline : override?.headline ?? humanizeSegment(part),
      path: acc
    });
  }
  return crumbs;
}

const PUBLISHED_PREFIXES = ['/docs/', '/SOPs/', '/evals/', '/mcps/', '/ontology/'] as const;

function isPublishedKitPath(path: string): boolean {
  if (path === '/' || PAGE_SEO[path]) return true;
  return PUBLISHED_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function isKnownPath(path: string, opts?: ResolvePageSeoOptions): boolean {
  if (isPublishedKitPath(path)) return true;
  if (opts?.markdown || opts?.file) return true;
  return false;
}

export function canonicalUrlForPath(path: string): string {
  const normalized = normalizePathname(path);
  if (normalized === '/') return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${normalized}/`;
}

export function notFoundPageSeo(): PageSeo {
  return {
    path: '/404',
    headline: 'That page is not here',
    title: `That page is not here | ${SITE_NAME}`,
    description: 'This URL is not a published kit page. Use the docs overview or the home page.',
    excerpt: 'Try the home page or the docs overview.',
    canonicalUrl: '',
    ogImageUrl: SITE_SOCIAL_IMAGE,
    ogType: 'website',
    indexable: false,
    breadcrumbs: [
      { name: SITE_NAME, path: '/' },
      { name: 'That page is not here', path: '/404' }
    ]
  };
}

export function resolvePageSeo(pathname: string, opts?: ResolvePageSeoOptions): PageSeo {
  const path = normalizePathname(pathname);
  if (opts?.missing || path === '/404') return notFoundPageSeo();

  const known = isKnownPath(path, opts);
  if (!known) {
    return {
      ...notFoundPageSeo(),
      path
    };
  }

  const override = PAGE_SEO[path];
  const headline = override?.headline ?? opts?.headline ?? SITE_NAME;
  const excerptText = opts?.markdown ? markdownExcerpt(opts.markdown) : undefined;
  const derived = opts?.markdown ? firstParagraph(opts.markdown) : undefined;
  const description =
    override?.description ??
    derived ??
    (excerptText && excerptText.length > 20 ? excerptText : undefined) ??
    `${headline} in Waykit operator docs.`;
  const excerpt = excerptText ?? description;
  const indexable = override?.indexable !== false && !NOINDEX_PATHS.has(path);

  return {
    path,
    headline,
    title: titleFor(headline, override?.title),
    description,
    excerpt,
    canonicalUrl: canonicalUrlForPath(path),
    ogImageUrl: SITE_SOCIAL_IMAGE,
    ogType: path === '/' ? 'website' : 'article',
    indexable,
    markdownUrl: opts?.file ? `${SITE_ORIGIN}/${opts.file}` : undefined,
    softwareName: override?.softwareName,
    articleMarkdown: opts?.markdown,
    breadcrumbs: breadcrumbsFor(path, headline)
  };
}

export function listIndexableSeoPaths(paths: readonly string[]): string[] {
  return paths
    .filter((path) => {
      const normalized = normalizePathname(path);
      if (!isPublishedKitPath(normalized)) return false;
      return resolvePageSeo(normalized).indexable;
    })
    .sort((a, b) => {
      if (a === '/') return -1;
      if (b === '/') return 1;
      return a.localeCompare(b);
    });
}

function sitemapPriority(path: string): string {
  if (path === '/') return '1.0';
  if (path === '/docs/start' || path === '/docs/edd' || path === '/evals/edd') return '0.9';
  if (path === '/docs' || path === '/docs/map' || path === '/docs/jobs' || path === '/docs/faq') {
    return '0.8';
  }
  if (path.startsWith('/docs/ADRs/')) return '0.4';
  return '0.6';
}

export function buildSitemapXml(paths: readonly string[], lastmod: string): string {
  const urls = paths
    .map((path) => {
      const loc = canonicalUrlForPath(path);
      return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${sitemapPriority(path)}</priority>
  </url>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
}

export function buildJsonLdGraph(seo: PageSeo): Record<string, unknown> {
  const organization = {
    '@type': 'Organization',
    '@id': `${SITE_ORIGIN}/#organization`,
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    sameAs: [SITE_GITHUB]
  };

  const website = {
    '@type': 'WebSite',
    '@id': `${SITE_ORIGIN}/#website`,
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    description: resolvePageSeo('/').description,
    publisher: { '@id': `${SITE_ORIGIN}/#organization` }
  };

  const graph: Array<Record<string, unknown>> = [organization, website];

  if (seo.path === '/' && seo.softwareName) {
    graph.push({
      '@type': 'SoftwareApplication',
      '@id': `${SITE_ORIGIN}/#software`,
      name: seo.softwareName,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web',
      url: `${SITE_ORIGIN}/`,
      description: resolvePageSeo('/').description,
      image: SITE_SOCIAL_IMAGE,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      publisher: { '@id': `${SITE_ORIGIN}/#organization` }
    });
  }

  graph.push({
    '@type': seo.path === '/' ? 'WebPage' : 'TechArticle',
    '@id': `${seo.canonicalUrl}#webpage`,
    url: seo.canonicalUrl,
    name: seo.title,
    description: seo.description,
    isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
    primaryImageOfPage: seo.ogImageUrl
  });

  if (seo.breadcrumbs.length > 1) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: seo.breadcrumbs.map((crumb, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: crumb.name,
        item: canonicalUrlForPath(crumb.path)
      }))
    });
  }

  return {
    '@context': 'https://schema.org',
    '@graph': graph
  };
}

export type SeoHeadModel = {
  title: string;
  description: string;
  robots: string;
  canonicalUrl?: string;
  markdownUrl?: string;
  ogType: PageSeo['ogType'];
  ogUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  ogImageWidth: number;
  ogImageHeight: number;
  ogImageAlt: string;
  twitterImageAlt: string;
  jsonLd?: Record<string, unknown>;
};

export function seoHeadModel(seo: PageSeo): SeoHeadModel {
  return {
    title: seo.title,
    description: seo.description,
    robots: seo.indexable ? 'index,follow' : 'noindex,nofollow',
    canonicalUrl: seo.indexable && seo.canonicalUrl ? seo.canonicalUrl : undefined,
    markdownUrl: seo.markdownUrl,
    ogType: seo.ogType,
    ogUrl: seo.canonicalUrl || `${SITE_ORIGIN}/`,
    ogTitle: seo.title,
    ogDescription: seo.description,
    ogImageUrl: seo.ogImageUrl,
    ogImageWidth: SITE_SOCIAL_IMAGE_WIDTH,
    ogImageHeight: SITE_SOCIAL_IMAGE_HEIGHT,
    ogImageAlt: SITE_SOCIAL_IMAGE_ALT,
    twitterImageAlt: SITE_SOCIAL_IMAGE_ALT,
    jsonLd: seo.indexable ? buildJsonLdGraph(seo) : undefined
  };
}
