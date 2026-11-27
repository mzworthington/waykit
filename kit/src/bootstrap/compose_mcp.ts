import fs from 'fs';
import path from 'path';
import os from 'os';
import { backupExistingFile } from '../shared/backup_file.js';
import { resolveRepoDir } from '../shared/paths.js';
import { profileToRestore, recordComposedProfile } from './mcp_profile_stamp.js';
import { installMcpOnHosts, parseMcpHosts, type McpHostId } from './mcp_hosts.js';

const defaultRepoDir: string = resolveRepoDir(import.meta.url);

interface ServerConfig {
  mcp?: Record<string, unknown>;
  requiredEnv?: string[];
}

interface ProfileConfig {
  name?: string;
  servers?: string[];
}

export interface ComposeMcpOptions {
  repoDir?: string;
  homedir?: string;
  env?: NodeJS.ProcessEnv;
  /** Override for tests; default is `~/.cursor`. */
  cursorDir?: string;
  hosts?: readonly McpHostId[];
  /** Write project-scoped host files under this directory (`wk init` / `wk mcp --project`). */
  projectDir?: string;
  installProject?: boolean;
  reset?: boolean;
}

export function composeMCP(
  profileName: string,
  outputFile?: string,
  installGlobally: boolean = false,
  options: ComposeMcpOptions = {}
): void {
  const repoDir = options.repoDir ?? defaultRepoDir;
  const mcpsDir = path.join(repoDir, 'mcps');
  const env = options.env ?? process.env;
  const homedir = options.homedir ?? os.homedir();

  let profilePath: string;

  if (profileName.endsWith('.json') || profileName.includes('/') || profileName.includes('\\')) {
    profilePath = path.resolve(process.cwd(), profileName);
  } else {
    profilePath = path.join(mcpsDir, 'profiles', `${profileName}.json`);
  }

  if (!fs.existsSync(profilePath)) {
    throw new Error(`Profile JSON not found: ${profilePath}`);
  }

  let profile: ProfileConfig;
  try {
    profile = JSON.parse(fs.readFileSync(profilePath, 'utf8')) as ProfileConfig;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid JSON in profile ${profilePath}: ${message}`);
  }

  const serverIds = profile.servers || [];
  if (!Array.isArray(serverIds)) {
    throw new Error(`profile.servers in ${profilePath} must be an array`);
  }

  const mcpServers: Record<string, unknown> = {};
  const missingEnv: string[] = [];

  for (const serverId of serverIds) {
    const serverFile = path.join(mcpsDir, 'servers', serverId, 'server.json');
    if (!fs.existsSync(serverFile)) {
      throw new Error(`Server definition missing: ${serverFile}`);
    }

    let data: ServerConfig;
    try {
      data = JSON.parse(fs.readFileSync(serverFile, 'utf8')) as ServerConfig;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Invalid JSON in server ${serverFile}: ${message}`);
    }

    const fragment = data.mcp;
    if (!fragment || typeof fragment !== 'object' || Object.keys(fragment).length === 0) {
      throw new Error(`${serverFile} must contain a non-empty mcp object`);
    }

    for (const [key, value] of Object.entries(fragment)) {
      if (key in mcpServers) {
        throw new Error(`Duplicate mcpServers key '${key}' from ${serverId}`);
      }
      mcpServers[key] = value;
    }

    for (const envName of data.requiredEnv || []) {
      if (!env[envName]) {
        missingEnv.push(`${serverId}:${envName}`);
      }
    }
  }

  if (missingEnv.length > 0) {
    console.warn(
      'WARN: required env vars not set in this shell (the host may still resolve them): ' +
        missingEnv.join(', ')
    );
  }

  const resultJSON = JSON.stringify({ mcpServers }, null, 2);
  const hosts = options.hosts ?? parseMcpHosts('all');

  if (outputFile) {
    const targetPath = path.resolve(process.cwd(), outputFile);
    const parentDir = path.dirname(targetPath);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }
    backupExistingFile(targetPath);
    fs.writeFileSync(targetPath, resultJSON, 'utf8');
    console.log(`Composed profile '${profileName}' saved to ${targetPath}`);
    return;
  }

  let wrote = false;
  if (installGlobally) {
    const written = installMcpOnHosts(mcpServers, hosts, {
      scope: 'user',
      homedir,
      cursorDir: options.cursorDir,
      reset: options.reset
    });
    for (const targetPath of written) {
      console.log(`Installed profile '${profileName}' to ${targetPath}`);
    }
    wrote = true;
  }
  if (options.installProject) {
    const projectDir = options.projectDir ?? process.cwd();
    const written = installMcpOnHosts(mcpServers, hosts, {
      scope: 'project',
      homedir,
      projectDir,
      cursorDir: options.cursorDir,
      reset: options.reset
    });
    for (const targetPath of written) {
      console.log(`Installed profile '${profileName}' to ${targetPath}`);
    }
    recordComposedProfile(projectDir, profileName, Object.keys(mcpServers));
    wrote = true;
  }
  if (!wrote) {
    console.log(resultJSON);
  }
}

/** Recompose the profile recorded before the last `--project` compose, or kit `default`. */
export function restoreProjectMcp(options: ComposeMcpOptions = {}): void {
  const projectDir = options.projectDir ?? process.cwd();
  const profileName = profileToRestore(projectDir);
  console.log(`Restoring MCP profile '${profileName}'`);
  composeMCP(profileName, undefined, false, {
    ...options,
    installProject: true,
    projectDir
  });
}
