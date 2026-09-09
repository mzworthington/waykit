import fs from 'fs';
import path from 'path';
import { composeMCP } from './compose_mcp.js';
import { exportIDERules } from './export_ide_rules.js';
import { gitHooksDir, resolveRepoDir } from '../shared/paths.js';
import { parseMcpHosts, type McpHostId } from './mcp_hosts.js';

const defaultKitRepoDir: string = resolveRepoDir(import.meta.url);

export interface InitProjectOptions {
  targetDir: string;
  mcpProfile: string;
  installMCP: boolean;
  installIDE: boolean;
  installHook: boolean;
  kitRepoDir?: string;
  /** Override for tests; default is `<target>/.cursor`. */
  cursorDir?: string;
  /** Override for tests; default is `<target>/.git/hooks`. */
  hooksDir?: string;
  hosts?: readonly McpHostId[];
}

export function installGitHooks(options: {
  targetDir: string;
  kitRepoDir: string;
  hooksDir?: string;
}): boolean {
  const gitDir = path.join(options.targetDir, '.git');
  if (!fs.existsSync(gitDir)) {
    console.log(`ℹ️  No .git directory found in ${options.targetDir}; skipping git hook installation.`);
    return false;
  }
  const hooksDir = options.hooksDir ?? gitHooksDir(gitDir);
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }
  const hookPath = path.join(hooksDir, 'pre-commit');
  const hookScript = `#!/usr/bin/env bash\n# Pre-Commit Security & Quality Gate via Waykit\nset -e\nWK="$HOME/.agents/bin/kit"\nif [ -x "$WK" ]; then\n  "$WK" audit\nelif command -v wk >/dev/null 2>&1; then\n  wk audit\nfi\n`;
  fs.writeFileSync(hookPath, hookScript, { mode: 0o755 });
  console.log(`✅ Installed pre-commit hook to ${hookPath}`);

  const commitMsgTemplate = path.join(options.kitRepoDir, 'templates', 'git', 'commit-msg');
  const commitMsgPath = path.join(hooksDir, 'commit-msg');
  if (fs.existsSync(commitMsgTemplate)) {
    fs.copyFileSync(commitMsgTemplate, commitMsgPath);
    fs.chmodSync(commitMsgPath, 0o755);
  } else {
    fs.writeFileSync(
      commitMsgPath,
      `#!/usr/bin/env bash\nset -e\nWK="$HOME/.agents/bin/kit"\nif [ -x "$WK" ]; then\n  "$WK" commit-msg "$1"\nelif command -v wk >/dev/null 2>&1; then\n  wk commit-msg "$1"\nelse\n  echo "Waykit not found; cannot check conventional commit message." >&2\n  exit 1\nfi\n`,
      { mode: 0o755 }
    );
  }
  console.log(`✅ Installed commit-msg hook to ${commitMsgPath}`);
  return true;
}

export function initProject(options: InitProjectOptions): void {
  const { targetDir, mcpProfile, installMCP, installIDE, installHook } = options;
  const kitRepoDir = options.kitRepoDir ?? defaultKitRepoDir;

  console.log(`Bootstrap ${targetDir}`);

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const agentsPath = path.join(targetDir, 'AGENTS.md');
  if (fs.existsSync(agentsPath)) {
    console.log(`✓ AGENTS.md already exists in ${targetDir}`);
  } else {
    const templatePath = path.join(kitRepoDir, 'templates', 'project-AGENTS.md');
    if (fs.existsSync(templatePath)) {
      fs.copyFileSync(templatePath, agentsPath);
      console.log(`✅ Created AGENTS.md in ${targetDir}`);
    } else {
      const fallback = `# Agent Bootstrap\n\nStandards and lifecycle agents live in ~/.agents - read ~/.agents/AGENTS.md before starting work.\n`;
      fs.writeFileSync(agentsPath, fallback, 'utf8');
      console.log(`✅ Created AGENTS.md (fallback) in ${targetDir}`);
    }
  }

  if (installIDE) {
    console.log(`Exporting Multi-IDE rule entry points...`);
    exportIDERules(targetDir, false, kitRepoDir);
  }

  if (installMCP) {
    try {
      composeMCP(mcpProfile, undefined, false, {
        repoDir: kitRepoDir,
        installProject: true,
        projectDir: targetDir,
        cursorDir: options.cursorDir,
        hosts: options.hosts ?? parseMcpHosts('all')
      });
      console.log(`✅ Composed MCP profile "${mcpProfile}" for Cursor, Claude Code, Copilot, and Antigravity`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️ MCP profile composition failed: ${msg}`);
    }
  }

  if (installHook) {
    installGitHooks({ targetDir, kitRepoDir, hooksDir: options.hooksDir });
  }

  console.log(`Project bootstrap complete.`);
}
