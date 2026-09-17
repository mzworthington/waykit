import { HOME_BRAND, HOME_HEADLINE, HOME_LEDE } from '../landing/copy';
import { SITE_GITHUB } from '../site/footerNav';
import {
  collapseSpaces,
  stripMarkdownDecorations,
  stripMarkdownLinks,
  trimIncompleteLastWord
} from '../../../kit/src/shared/text_parse';

export { SITE_GITHUB };

export const SITE_ORIGIN = 'https://waykit.dev';
export const SITE_NAME = HOME_BRAND;
export const SITE_SHORT_NAME = HOME_BRAND.toLowerCase();
export const SITE_MARK_SRC = '/assets/kit-mark.svg';
export const SITE_SOCIAL_IMAGE = `${SITE_ORIGIN}/assets/og.jpg`;
export const SITE_SOCIAL_IMAGE_WIDTH = 1200;
export const SITE_SOCIAL_IMAGE_HEIGHT = 630;
export const SITE_SOCIAL_IMAGE_ALT = `${HOME_BRAND}: ${HOME_HEADLINE}. ${HOME_LEDE}`;

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

const NOINDEX_PATHS = new Set(['/docs/kit-review-backlog', '/404']);
const KNOWN_ROOTS = new Set(['/', '/docs', '/privacy', '/mcps', '/ontology']);
const PRIVACY_HEADLINE = 'Privacy policy';
const PRIVACY_LEDE =
  'What waykit.dev does with information: cookieless PostHog on Cloud EU, Cloudflare hosting, no PostHog cookie banner and how to ask for deletion.';

function sentenceCase(text: string): string {
  return `${text.charAt(0).toLowerCase()}${text.slice(1)}`;
}

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
    const cleaned = stripMarkdownDecorations(stripMarkdownLinks(row));
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
  const text = collapseSpaces(stripMarkdownDecorations(stripMarkdownLinks(lines.join(' ')))).trim();
  if (text.length <= max) return text;
  return `${trimIncompleteLastWord(text.slice(0, max))}…`;
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
    const isLast = index === parts.length - 1;
    crumbs.push({
      name: isLast ? headline : humanizeSegment(part),
      path: acc
    });
  }
  return crumbs;
}

const PUBLISHED_PREFIXES = ['/docs/', '/SOPs/', '/evals/', '/mcps/', '/ontology/'] as const;

function isPublishedKitPath(path: string): boolean {
  if (KNOWN_ROOTS.has(path)) return true;
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

  if (path === '/') {
    return {
      path,
      headline: HOME_BRAND,
      title: `${HOME_BRAND}: ${sentenceCase(HOME_HEADLINE)}`,
      description: HOME_LEDE,
      excerpt: HOME_LEDE,
      canonicalUrl: canonicalUrlForPath(path),
      ogImageUrl: SITE_SOCIAL_IMAGE,
      ogType: 'website',
      indexable: true,
      softwareName: HOME_BRAND,
      breadcrumbs: breadcrumbsFor(path, HOME_BRAND)
    };
  }

  const excerptText = opts?.markdown ? markdownExcerpt(opts.markdown) : undefined;
  const derived = opts?.markdown ? firstParagraph(opts.markdown) : undefined;
  const headline =
    opts?.headline ?? (path === '/privacy' ? PRIVACY_HEADLINE : SITE_NAME);
  const description =
    derived ??
    (path === '/privacy' ? PRIVACY_LEDE : undefined) ??
    (excerptText && excerptText.length > 20 ? excerptText : undefined) ??
    `${headline} in Waykit operator docs.`;
  const excerpt = excerptText ?? description;

  return {
    path,
    headline,
    title: titleFor(headline),
    description,
    excerpt,
    canonicalUrl: canonicalUrlForPath(path),
    ogImageUrl: SITE_SOCIAL_IMAGE,
    ogType: 'article',
    indexable: !NOINDEX_PATHS.has(path),
    markdownUrl: opts?.file ? `${SITE_ORIGIN}/${opts.file}` : undefined,
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
  const homeDescription = HOME_LEDE;
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
    description: homeDescription,
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
      description: homeDescription,
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
