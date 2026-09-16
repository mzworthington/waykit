export const HOME_EYEBROW = 'Product lifecycle for coding agents';
export const HOME_BRAND = 'Waykit';
export const HOME_HEADLINE = 'A release bar for coding agents';
export const HOME_LEDE =
  'One curl installs the kit. wk runs TDD, the feature path and the loops after ship.';
export const HOME_INSTALL =
  'curl -fsSL https://raw.githubusercontent.com/mzworthington/waykit/main/install.sh | sh';
export const HOME_INIT = 'wk init . --mcp default --hook';

/** Keep in sync with the README badge row. Version tracks GitHub Releases. */
export const HOME_BADGES = [
  {
    href: 'https://github.com/mzworthington/waykit/actions',
    src: 'https://img.shields.io/badge/CI-Passing-brightgreen?style=for-the-badge&logo=github-actions',
    alt: 'CI passing',
    width: 130,
    height: 28
  },
  {
    href: '/docs/lifecycle',
    src: 'https://img.shields.io/badge/Lifecycle-SDLC-blueviolet?style=for-the-badge&logo=git',
    alt: 'Feature lifecycle',
    width: 168,
    height: 28
  },
  {
    href: '/docs',
    src: 'https://img.shields.io/badge/Docs-waykit.dev-blue?style=for-the-badge&logo=github',
    alt: 'Docs at waykit.dev',
    width: 214,
    height: 28
  },
  {
    href: '/LICENSE',
    src: 'https://img.shields.io/badge/License-Unlicense-success?style=for-the-badge',
    alt: 'Unlicense',
    width: 140,
    height: 28
  },
  {
    href: 'https://github.com/mzworthington/waykit/releases',
    src: 'https://img.shields.io/github/v/release/mzworthington/waykit?style=for-the-badge&logo=github&label=Version',
    alt: 'Latest GitHub release',
    width: 168,
    height: 28
  }
] as const;

/** Product name for the operator CLI, not a how-to sentence. */
export const HOME_CLI_HEADING = 'The wk CLI';

export const HOME_NEXT = [
  {
    href: '/docs/lifecycle',
    title: 'Feature lifecycle',
    body: 'Grill, spec, TDD, XFN, audit, release. EDD (alpha) sits here when tools are the change.'
  },
  {
    href: '/docs/loops',
    title: 'Quality loops',
    body: 'CI, RUM, Lighthouse and Sonar file Linear tickets. Hygiene then the work picker turns them into draft PRs.'
  }
];

export const JOBS_FOR_TODAY = 
{
  href: '/docs/jobs',
  title: 'Jobs for today',
  body: 'Debug vs feature, a fat context, a tool call. Pick one and run it.'
};

/** First-party product checkouts that pass `wk align`. GitHub origins, not vanity domains. */
export const HOME_USED_IN_HEADING = 'Used on our own product repos';
export const HOME_USED_IN_LEAD =
  'Waykit is not only this kit. First-party checkouts run the thin handshake, kit MCP and wk align. Open AGENTS.md if you want to see a consumer in the wild.';

export const HOME_USED_IN = [
  {
    name: 'ArchLens',
    href: 'https://github.com/mzworthington/blueprint',
    what: 'Architecture canvas and CLI (GitHub repo still named blueprint)',
    look: 'Hexagonal @archlens/core, TDD for parsers, sparse ADRs.'
  },
  {
    name: 'steerco',
    href: 'https://github.com/mzworthington/steerco',
    what: 'Executive steering workspace',
    look: 'In-app docs, Cloudflare Pages, handover under steerco/.'
  },
  {
    name: 'React Cloudflare template',
    href: 'https://github.com/mzworthington/react-cloudflare-template',
    what: 'Greenfield product starter',
    look: 'The handshake wk init writes, already aligned so clones inherit it.'
  },
  {
    name: 'GPIO build monitor',
    href: 'https://github.com/mzworthington/gpio-build-monitor',
    what: 'Pi LEDs and a Cloudflare Worker status UI',
    look: 'Python plus Pulumi. Default MCP for agents; cloudflare-ops only when the Worker is the job.'
  }
] as const;
