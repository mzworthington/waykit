import fs from 'node:fs';
import path from 'node:path';

/** Profile names only. Never secrets. Gitignored. Project-local (not `~/.agents`). */
export const MCP_PROFILE_STAMP_REL = '.wk-mcp-profile.stamp';
export const MCP_PROFILE_STAMP_IGNORE = '.wk-mcp-profile.stamp';

export interface McpProfileStamp {
  previous: string | undefined;
  current: string;
  servers?: readonly string[];
}

export function mcpProfileStampPath(projectDir: string): string {
  return path.join(projectDir, MCP_PROFILE_STAMP_REL);
}

export function ensureStampGitignored(projectDir: string): void {
  const gitignorePath = path.join(projectDir, '.gitignore');
  const comment = '# Waykit session MCP profile name (names only)';
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, `${comment}\n${MCP_PROFILE_STAMP_IGNORE}\n`, 'utf8');
    return;
  }
  const body = fs.readFileSync(gitignorePath, 'utf8');
  const lines = body.split(/\r?\n/).map((line) => line.trim());
  if (lines.includes(MCP_PROFILE_STAMP_IGNORE) || lines.includes(`/${MCP_PROFILE_STAMP_IGNORE}`)) {
    return;
  }
  const sep = body.length === 0 || body.endsWith('\n') ? '' : '\n';
  fs.appendFileSync(gitignorePath, `${sep}${comment}\n${MCP_PROFILE_STAMP_IGNORE}\n`);
}

export function readMcpProfileStamp(projectDir: string): McpProfileStamp | undefined {
  const filePath = mcpProfileStampPath(projectDir);
  if (!fs.existsSync(filePath)) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
    const rec = parsed as Record<string, unknown>;
    const current = typeof rec.current === 'string' ? rec.current : undefined;
    if (!current) return undefined;
    const previous = typeof rec.previous === 'string' ? rec.previous : undefined;
    const servers = serverNames(rec.servers);
    return servers ? { current, previous, servers } : { current, previous };
  } catch {
    return undefined;
  }
}

export function writeMcpProfileStamp(projectDir: string, stamp: McpProfileStamp): string {
  const filePath = mcpProfileStampPath(projectDir);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const body: { previous: string | null; current: string; servers?: readonly string[] } = {
    previous: stamp.previous ?? null,
    current: stamp.current
  };
  if (stamp.servers) body.servers = stamp.servers;
  fs.writeFileSync(filePath, `${JSON.stringify(body, null, 2)}\n`);
  ensureStampGitignored(projectDir);
  return filePath;
}

function serverNames(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw.filter((name): name is string => typeof name === 'string');
}

export function recordComposedProfile(
  projectDir: string,
  profileName: string,
  servers?: readonly string[]
): McpProfileStamp {
  const prior = readMcpProfileStamp(projectDir);
  const stamp: McpProfileStamp = {
    previous: prior?.current,
    current: profileName,
    ...(servers ? { servers: [...servers] } : {})
  };
  writeMcpProfileStamp(projectDir, stamp);
  return stamp;
}

export function profileToRestore(projectDir: string): string {
  return readMcpProfileStamp(projectDir)?.previous ?? 'default';
}
