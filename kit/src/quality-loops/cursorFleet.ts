import {
  automationPrompt,
  loadPromptLibrary,
  loadQualityLoopCatalog,
  type QualityLoopAutomation,
  type QualityLoopCatalog
} from './catalog.js';

export type WorkspaceRepo = {
  name: string;
  slug: string;
};

export const WORKSPACE_REPOS: readonly WorkspaceRepo[] = [
  { name: 'archlens', slug: 'mzworthington/archlens' },
  { name: 'RoMini', slug: 'mzworthington/RoMini' },
  { name: 'waykit', slug: 'mzworthington/waykit' },
  { name: 'steerco', slug: 'mzworthington/steerco' },
  { name: 'mzworthington', slug: 'mzworthington/mzworthington' },
  { name: 'react-cloudflare-template', slug: 'mzworthington/react-cloudflare-template' },
  { name: 'edge-dns', slug: 'mzworthington/edge-dns' },
  { name: 'gpio-build-monitor', slug: 'mzworthington/gpio-build-monitor' },
  { name: 'dotfiles', slug: 'mzworthington/dotfiles' }
];

export type CursorWorkflowPlan = {
  id: string;
  name: string;
  prompt: string;
  cron?: string;
  gitRepo?: string;
  pullRequestRepos?: readonly string[];
  mcpServers: readonly string[];
  opensPr: boolean;
};

export type CursorWorkflowArgs = {
  logicalName: string;
  name: string;
  prompt: string;
  enabled: boolean;
  memoryEnabled: boolean;
  gitRepo?: string;
  disabledDefaultTools?: readonly string[];
  triggers: readonly (
    | { cron: { schedule: string } }
    | { gitPullRequest: { repos: readonly string[]; prAction: 'opened' } }
  )[];
  actions: readonly ({ mcp: { server: string } } | { gitPr: Record<string, never> })[];
};

export function cursorWorkflowArgs(plan: CursorWorkflowPlan): CursorWorkflowArgs {
  const triggers = plan.cron
    ? [{ cron: { schedule: plan.cron } } as const]
    : [
        {
          gitPullRequest: { repos: plan.pullRequestRepos ?? [], prAction: 'opened' as const }
        }
      ];
  const actions = [
    ...plan.mcpServers.map((server) => ({ mcp: { server } })),
    ...(plan.opensPr ? [{ gitPr: {} }] : [])
  ];
  return {
    logicalName: plan.id,
    name: plan.name,
    prompt: plan.prompt,
    enabled: true,
    memoryEnabled: true,
    gitRepo: plan.gitRepo,
    disabledDefaultTools: plan.opensPr ? undefined : ['open_git_pr'],
    triggers,
    actions
  };
}

const SUNDAY_MORNING = {
  'sonar-finding': '0 8 * * 0',
  hygiene: '0 9 * * 0',
  'work-picker': '0 10 * * 0'
} as const;

function promptFor(catalog: QualityLoopCatalog, kitRoot: string, item: QualityLoopAutomation): string {
  const prompts = loadPromptLibrary(kitRoot);
  const skip = item.skipUnless
    ? ` Skip unless: ${item.skipUnless}. If that is not met, stop immediately without Linear.`
    : '';
  return `${automationPrompt(catalog, prompts, item)}\n\nCap: at most ${item.maxItemsPerRun} item this run, then stop.${skip}`;
}

function fleetItem(catalog: QualityLoopCatalog, id: string): QualityLoopAutomation {
  const item = catalog.automations.find((entry) => entry.id === id);
  if (!item) {
    throw new Error(`quality-loop catalog is missing ${id}`);
  }
  return item;
}

export function planCursorAutomations(
  repos: readonly WorkspaceRepo[],
  kitRoot: string
): CursorWorkflowPlan[] {
  const catalog = loadQualityLoopCatalog(kitRoot);
  const sonar = fleetItem(catalog, 'sonar-finding');
  const hygiene = fleetItem(catalog, 'hygiene');
  const picker = fleetItem(catalog, 'work-picker');
  const vendor = fleetItem(catalog, 'vendor-pr');

  const shared: CursorWorkflowPlan[] = [
    {
      id: sonar.id,
      name: sonar.name,
      prompt: promptFor(catalog, kitRoot, sonar),
      cron: SUNDAY_MORNING['sonar-finding'],
      mcpServers: sonar.mcp,
      opensPr: sonar.opensPr
    },
    {
      id: hygiene.id,
      name: hygiene.name,
      prompt: promptFor(catalog, kitRoot, hygiene),
      cron: SUNDAY_MORNING.hygiene,
      mcpServers: hygiene.mcp,
      opensPr: hygiene.opensPr
    }
  ];

  const perRepo = repos.flatMap((repo) => {
    const pickerPlan: CursorWorkflowPlan = {
      id: `${picker.id}-${repo.name}`,
      name: `${picker.name} (${repo.name})`,
      prompt: promptFor(catalog, kitRoot, picker),
      cron: SUNDAY_MORNING['work-picker'],
      gitRepo: `github.com/${repo.slug}`,
      mcpServers: picker.mcp,
      opensPr: picker.opensPr
    };
    const vendorPlan: CursorWorkflowPlan = {
      id: `${vendor.id}-${repo.name}`,
      name: `${vendor.name} (${repo.name})`,
      prompt: promptFor(catalog, kitRoot, vendor),
      pullRequestRepos: [repo.slug],
      mcpServers: vendor.mcp,
      opensPr: vendor.opensPr
    };
    return [pickerPlan, vendorPlan];
  });

  return [...shared, ...perRepo];
}
