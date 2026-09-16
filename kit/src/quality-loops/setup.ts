import fs from 'node:fs';
import path from 'node:path';
import {
  automationPrompt,
  loadPromptLibrary,
  type QualityLoopAutomation,
  type QualityLoopCatalog
} from './catalog.js';
import { LOOPS_OVERLAY_REL, LOOPS_PACK_REL } from './status.js';

export { LOOPS_PACK_REL } from './status.js';

export type SetupQualityLoopsResult = {
  written: string[];
  preview: string;
};

function writeIfMissing(filePath: string, body: string): boolean {
  if (fs.existsSync(filePath)) return false;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, body, 'utf8');
  return true;
}

function repoLine(item: QualityLoopAutomation, repo: string): string {
  if (item.repo === 'none') return 'No repository (MCP / Linear only).';
  if (item.repo === 'environment') {
    return `Multi-repo environment that includes ${repo} (work picker opens a draft PR).`;
  }
  return `Single repository: ${repo}.`;
}

function loopFileBody(
  catalog: QualityLoopCatalog,
  prompts: Map<string, string>,
  item: QualityLoopAutomation,
  repo: string
): string {
  return `# ${item.name}

Trigger: ${item.trigger}
Repo: ${repoLine(item, repo)}
MCP: ${item.mcp.join(', ')}
Opens PR: ${item.opensPr ? 'draft only' : 'no'}

Paste this prompt into one Cursor Automation. Prefix is required on every loop.

\`\`\`text
${automationPrompt(catalog, prompts, item)}
\`\`\`
`;
}

function overlayBody(catalog: QualityLoopCatalog, repo: string): string {
  const ids = catalog.automations.map((item) => `  ${item.id}:`).join('\n');
  return `# Record Cursor Automation UUIDs from ${catalog.dashboard.automations} after you create them.
# wk loops status reads this file. Do not put secrets here.
project: ${repo}
automations:
${ids}
`;
}

function readmeBody(catalog: QualityLoopCatalog, repo: string): string {
  const rows = catalog.automations
    .map((item) => `- \`${item.id}\` — ${item.name} (${item.trigger}; ${item.mcp.join(', ')})`)
    .join('\n');
  return `# Waykit quality-loop Automations

Project: \`${repo}\`

Cursor has no Automations create/list API. This pack is the kit catalog on disk.

1. Connect ${catalog.dashboard.mcp.join(', ')} on ${catalog.dashboard.agents} (team: ${catalog.dashboard.integrations}). \`wk mcp --install\` does not wake Cloud sessions.
2. Paste \`AUTOMATE.md\` into Cursor \`/automate\`, or create one Automation per file at ${catalog.dashboard.automations}.
3. Record each UUID in \`overlay.yaml\`, then run \`wk loops status\`.

${rows}
`;
}

export function renderAutomatePrompt(
  catalog: QualityLoopCatalog,
  prompts: Map<string, string>,
  repo: string
): string {
  const loops = catalog.automations
    .map((item) => {
      return `### ${item.name} (\`${item.id}\`)

Trigger: ${item.trigger}
${repoLine(item, repo)}
Enable MCP: ${item.mcp.join(', ')}
${item.opensPr ? 'May open a draft PR only. Never merge.' : 'Do not open a PR from this loop.'}

\`\`\`text
${automationPrompt(catalog, prompts, item)}
\`\`\`
`;
    })
    .join('\n');

  return `# Create quality-loop Automations for ${repo}

Use Cursor \`/automate\` or create them at ${catalog.dashboard.automations}. One Automation per source. Do not collapse every source into one job.

Connect dashboard MCP first: ${catalog.dashboard.mcp.join(', ')} at ${catalog.dashboard.agents}. \`wk mcp --install\` rewrites local host files only; it does not wake this catalog.

Create these Cursor Automations for \`${repo}\`:

${loops}
`;
}

export function setupQualityLoops(opts: {
  catalog: QualityLoopCatalog;
  kitRoot: string;
  targetDir: string;
  write: boolean;
  repo: string;
}): SetupQualityLoopsResult {
  const prompts = loadPromptLibrary(opts.kitRoot);
  const preview = renderAutomatePrompt(opts.catalog, prompts, opts.repo);
  if (!opts.write) {
    return { written: [], preview };
  }

  const written: string[] = [];
  const files: Array<{ rel: string; body: string }> = [
    { rel: `${LOOPS_PACK_REL}/README.md`, body: readmeBody(opts.catalog, opts.repo) },
    { rel: `${LOOPS_PACK_REL}/AUTOMATE.md`, body: preview },
    { rel: LOOPS_OVERLAY_REL, body: overlayBody(opts.catalog, opts.repo) },
    ...opts.catalog.automations.map((item) => ({
      rel: `${LOOPS_PACK_REL}/${item.id}.md`,
      body: loopFileBody(opts.catalog, prompts, item, opts.repo)
    }))
  ];
  for (const file of files) {
    if (writeIfMissing(path.join(opts.targetDir, file.rel), file.body)) {
      written.push(file.rel);
    }
  }
  return { written, preview };
}
