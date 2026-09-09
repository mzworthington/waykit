export type DocsNavItem = {
  label: string;
  path: string;
  matchPrefixes?: string[];
};

export type DocsSidebarSection = {
  title: string;
  items: DocsNavItem[];
};

export type DocsNeighbor = {
  label: string;
  path: string;
};

export type DocsNavPage = {
  path: string;
  title: string;
};

/** Header hubs. Chapter lists live in the sidebar. */
export const SITE_NAV: DocsNavItem[] = [
  { label: 'Start', path: '/docs/start', matchPrefixes: ['/docs/start', '/docs/jobs', '/docs/faq'] },
  {
    label: 'Guide',
    path: '/docs',
    matchPrefixes: [
      '/docs/edd',
      '/docs/hosts',
      '/docs/kit',
      '/docs/doctor',
      '/docs/align',
      '/docs/used-in',
      '/docs/subagents',
      '/docs/sops',
      '/docs/ADRs',
      '/docs/kit-value-and-model-agnostic-review',
      '/docs/kit-review-backlog'
    ]
  },
  { label: 'Lifecycle', path: '/docs/lifecycle' }
];

export const START_ITEMS: DocsNavItem[] = [
  { label: 'Overview', path: '/docs' },
  { label: 'Getting started', path: '/docs/start' },
  { label: 'Jobs for today', path: '/docs/jobs' },
  { label: 'Common questions', path: '/docs/faq' }
];

export const PRACTICE_ITEMS: DocsNavItem[] = [
  { label: 'Feature lifecycle', path: '/docs/lifecycle' },
  { label: 'Host subagents', path: '/docs/subagents' },
  { label: 'What Waykit gives you', path: '/docs/kit' },
  { label: 'Repo doctor', path: '/docs/doctor' },
  { label: 'Consumer align', path: '/docs/align' },
  { label: 'Used on our repos', path: '/docs/used-in' },
  { label: 'Waykit map', path: '/docs/map' },
  { label: 'Author the Waykit map', path: '/ontology' },
  { label: 'EDD guide (alpha)', path: '/docs/edd' },
  { label: 'Hosts', path: '/docs/hosts' }
];

export const REFERENCE_CORE: DocsNavItem[] = [
  { label: 'SOPs', path: '/docs/sops' },
  { label: 'ADRs', path: '/docs/ADRs' },
  { label: 'Eval suites', path: '/evals/edd' },
  { label: 'MCP library', path: '/mcps' }
];

function pagesUnder(pages: readonly DocsNavPage[], prefix: string): DocsNavPage[] {
  return pages.filter((page) => page.path === prefix || page.path.startsWith(`${prefix}/`));
}

function toNav(pages: DocsNavPage[]): DocsNavItem[] {
  return pages.map((page) => ({ label: page.title, path: page.path }));
}

export function isDocsNavActive(location: string, item: DocsNavItem): boolean {
  const path = location.replace(/\/$/, '') || '/';
  if (path === item.path) return true;
  if (item.matchPrefixes?.length) {
    return item.matchPrefixes.some(
      (prefix) => path === prefix || (prefix !== '/' && path.startsWith(`${prefix}/`))
    );
  }
  if (item.path === '/') return false;
  return path.startsWith(`${item.path}/`);
}

export function docsSidebar(location: string, pages: readonly DocsNavPage[]): DocsSidebarSection[] {
  const path = location.replace(/\/$/, '') || '/';
  const sections: DocsSidebarSection[] = [
    { title: 'Start', items: START_ITEMS },
    { title: 'Practice', items: PRACTICE_ITEMS },
    { title: 'Reference', items: REFERENCE_CORE }
  ];

  if (path.startsWith('/SOPs') || path === '/docs/sops') {
    const sops = pagesUnder(pages, '/SOPs').filter((page) => page.path !== '/SOPs');
    sections.push({ title: 'Procedures', items: toNav(sops) });
  }
  if (path.startsWith('/docs/ADRs')) {
    const adrs = pagesUnder(pages, '/docs/ADRs').filter((page) => page.path !== '/docs/ADRs');
    sections.push({ title: 'Decisions', items: toNav(adrs) });
  }
  if (path.startsWith('/evals')) {
    const evals = pagesUnder(pages, '/evals').filter((page) => page.path !== '/evals/edd');
    if (evals.length) sections.push({ title: 'Write-ups', items: toNav(evals) });
  }

  return sections.filter((section) => section.items.length > 0);
}

export function docsReadingOrder(pages: readonly DocsNavPage[]): string[] {
  const curated = [...START_ITEMS, ...PRACTICE_ITEMS, ...REFERENCE_CORE].map((item) => item.path);
  const seen = new Set(curated);
  const rest = pages
    .map((page) => page.path)
    .filter((path) => !seen.has(path))
    .sort((a, b) => a.localeCompare(b));
  return [
    ...curated.filter((path) => pages.some((page) => page.path === path) || path === '/docs'),
    ...rest
  ];
}

export function docsNeighbors(
  path: string,
  pages: readonly DocsNavPage[]
): { prev: DocsNeighbor | null; next: DocsNeighbor | null } {
  const order = docsReadingOrder(pages).filter((item, index, all) => all.indexOf(item) === index);
  const at = order.indexOf(path.replace(/\/$/, '') || '/');
  if (at < 0) return { prev: null, next: null };
  const labelFor = (itemPath: string) =>
    pages.find((page) => page.path === itemPath)?.title ??
    [...START_ITEMS, ...PRACTICE_ITEMS, ...REFERENCE_CORE].find((item) => item.path === itemPath)
      ?.label ??
    itemPath;
  const prevPath = order[at - 1];
  const nextPath = order[at + 1];
  return {
    prev: prevPath ? { path: prevPath, label: labelFor(prevPath) } : null,
    next: nextPath ? { path: nextPath, label: labelFor(nextPath) } : null
  };
}
