import fs from 'fs';
import path from 'path';
import { resolveRepoDir } from '../shared/paths.js';

const defaultRepoDir: string = resolveRepoDir(import.meta.url);

export const HOST_POINTER_TEMPLATE = 'host-pointer.md';

export const IDE_RULE_REL_PATHS: readonly string[] = [
  'GEMINI.md',
  'CLAUDE.md',
  '.windsurfrules',
  '.cursorrules',
  path.join('.github', 'copilot-instructions.md')
];

export const HOST_POINTER_FALLBACK = `# Waykit host pointer

Standards and lifecycle agents live in \`~/.agents\`.
Read \`~/.agents/AGENTS.md\` (thin index) before starting work. Do not bulk-load philosophy or SOPs. Prefer kit-knowledge / memory MCP for chunks and durable facts. Use EDD for prompts, MCP tools, and agent routing (\`~/.agents/docs/edd.md\`). Align on hexagonal boundaries, TDD short-loop execution, and XFN quality requirements.
`;

export function hostPointerContent(kitRepoDir: string): string {
  const templatePath = path.join(kitRepoDir, 'templates', HOST_POINTER_TEMPLATE);
  if (fs.existsSync(templatePath)) {
    return fs.readFileSync(templatePath, 'utf8');
  }
  return HOST_POINTER_FALLBACK;
}

export function exportIDERules(
  targetDir: string = defaultRepoDir,
  checkOnly: boolean = false,
  kitRepoDir: string = defaultRepoDir
): boolean {
  let allValid = true;
  const contentToUse = hostPointerContent(kitRepoDir);

  for (const filename of IDE_RULE_REL_PATHS) {
    const destPath = path.join(targetDir, filename);

    if (checkOnly) {
      if (!fs.existsSync(destPath)) {
        console.error(`❌ [IDE Rule Sync] Missing entry point file: ${filename}`);
        allValid = false;
      } else {
        console.log(`✓ [IDE Rule Sync] Found ${filename}`);
      }
    } else {
      const parentDir = path.dirname(destPath);
      if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir, { recursive: true });
      }
      fs.writeFileSync(destPath, contentToUse, 'utf8');
      console.log(`Exported ${filename}`);
    }
  }

  return allValid;
}
