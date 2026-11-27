import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'node:url';
import { backupExistingFile } from '../shared/backup_file.js';

export const MCP_HOSTS = ['cursor', 'claude', 'copilot', 'antigravity'] as const;
export type McpHostId = (typeof MCP_HOSTS)[number];

const HOST_ALIASES: Record<string, McpHostId> = {
  cursor: 'cursor',
  claude: 'claude',
  'claude-code': 'claude',
  copilot: 'copilot',
  vscode: 'copilot',
  'vs-code': 'copilot',
  antigravity: 'antigravity',
  gemini: 'antigravity',
  agy: 'antigravity'
};

export function canonicalizeMcpHost(raw: string): McpHostId | undefined {
  return HOST_ALIASES[raw.trim().toLowerCase()];
}

export function parseMcpHosts(raw: string | undefined): McpHostId[] {
  const value = (raw ?? 'all').trim().toLowerCase();
  if (value === '' || value === 'all') return [...MCP_HOSTS];
  const parts = value.split(/[,\s]+/).filter(Boolean);
  const out: McpHostId[] = [];
  for (const part of parts) {
    const id = canonicalizeMcpHost(part);
    if (!id) {
      if (part === 'windsurf') {
        throw new Error(
          `Unknown host '${part}'. Windsurf is rules-only forever (.windsurfrules); wk mcp does not write it. Use cursor, claude, copilot, antigravity (gemini/agy), or all.`
        );
      }
      throw new Error(
        `Unknown host '${part}'. Use cursor, claude, copilot, antigravity (gemini/agy), or all.`
      );
    }
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

export type McpServers = Record<string, unknown>;

export interface McpHostPaths {
  homedir: string;
  projectDir?: string;
  cursorDir?: string;
}

export function userMcpPath(host: McpHostId, paths: McpHostPaths): string {
  switch (host) {
    case 'cursor':
      return path.join(paths.cursorDir ?? path.join(paths.homedir, '.cursor'), 'mcp.json');
    case 'claude':
      return path.join(paths.homedir, '.claude.json');
    case 'copilot':
      return path.join(paths.homedir, '.copilot', 'mcp-config.json');
    case 'antigravity':
      return path.join(paths.homedir, '.gemini', 'config', 'mcp_config.json');
  }
}

export function projectMcpPath(host: McpHostId, projectDir: string, cursorDir?: string): string {
  switch (host) {
    case 'cursor':
      return path.join(cursorDir ?? path.join(projectDir, '.cursor'), 'mcp.json');
    case 'claude':
      return path.join(projectDir, '.mcp.json');
    case 'copilot':
      return path.join(projectDir, '.vscode', 'mcp.json');
    case 'antigravity':
      return path.join(projectDir, '.agents', 'mcp_config.json');
  }
}

export function toVsCodeMcpFile(mcpServers: McpServers): { servers: McpServers } {
  const servers: McpServers = {};
  for (const [name, raw] of Object.entries(mcpServers)) {
    servers[name] = toVsCodeServer(raw);
  }
  return { servers };
}

function toVsCodeServer(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const cfg = raw as Record<string, unknown>;
  if (typeof cfg.url === 'string') {
    const next: Record<string, unknown> = { type: 'http', url: cfg.url };
    if (cfg.headers && typeof cfg.headers === 'object') next.headers = cfg.headers;
    return next;
  }
  if (typeof cfg.command === 'string') {
    return { type: 'stdio', ...cfg };
  }
  return raw;
}

function readJsonObject(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {};
  const text = fs.readFileSync(filePath, 'utf8');
  if (text.trim() === '') return {};
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${filePath} must contain a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

function writeJson(filePath: string, body: unknown): void {
  const parent = path.dirname(filePath);
  if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
  backupExistingFile(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
}

const WAYKIT_SERVERS = 'waykitServers';

function serversWaykitWrote(existing: Record<string, unknown>): ReadonlySet<string> | undefined {
  const raw = existing[WAYKIT_SERVERS];
  if (!Array.isArray(raw)) return undefined;
  return new Set(raw.filter((name): name is string => typeof name === 'string'));
}

let catalogServerIds: ReadonlySet<string> | undefined;

function kitCatalogServerIds(): ReadonlySet<string> {
  if (catalogServerIds) return catalogServerIds;
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../mcps/servers');
  if (!fs.existsSync(dir)) {
    catalogServerIds = new Set();
    return catalogServerIds;
  }
  catalogServerIds = new Set(
    fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  );
  return catalogServerIds;
}

function mergeMcpServers(existing: Record<string, unknown>, next: McpServers): McpServers {
  const prior = existing.mcpServers;
  const recorded = serversWaykitWrote(existing);
  const drop = recorded ?? kitCatalogServerIds();
  const kept: McpServers = {};
  if (prior && typeof prior === 'object' && !Array.isArray(prior)) {
    for (const [key, value] of Object.entries(prior)) {
      if (!drop.has(key)) kept[key] = value;
    }
  }
  return { ...kept, ...next };
}

function documentForHost(host: McpHostId, mcpServers: McpServers, existing: Record<string, unknown>): unknown {
  if (host === 'copilot') {
    return { ...existing, ...toVsCodeMcpFile(mcpServers), mcpServers };
  }
  return { ...existing, mcpServers };
}

export function writeHostMcpFile(
  filePath: string,
  host: McpHostId,
  mcpServers: McpServers,
  options?: { reset?: boolean }
): void {
  const existing = readJsonObject(filePath);
  const merged = options?.reset ? mcpServers : mergeMcpServers(existing, mcpServers);
  const body = documentForHost(host, merged, existing);
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    (body as Record<string, unknown>)[WAYKIT_SERVERS] = Object.keys(mcpServers);
  }
  writeJson(filePath, body);
}

export function installMcpOnHosts(
  mcpServers: McpServers,
  hosts: readonly McpHostId[],
  options: McpHostPaths & { scope: 'user' | 'project'; reset?: boolean }
): string[] {
  const written: string[] = [];
  for (const host of hosts) {
    const filePath =
      options.scope === 'user'
        ? userMcpPath(host, options)
        : projectMcpPath(host, options.projectDir ?? process.cwd(), options.cursorDir);
    writeHostMcpFile(filePath, host, mcpServers, { reset: options.reset });
    written.push(filePath);
  }
  return written;
}
