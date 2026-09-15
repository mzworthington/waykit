import { spawnSync } from 'node:child_process';
import { trustedBin, trustedSpawnEnv } from '../shared/trusted_bin.js';
import type { RepoView } from './ownership.js';

export interface GitHubPort {
  currentUser(): string | undefined;
  viewFromCwd(cwd: string): RepoView | undefined;
  listSources(login: string): RepoView[];
  remoteFileExists(nameWithOwner: string, relPath: string): boolean;
}

type GhJsonOwner = { login?: string };
type GhRepoJson = {
  nameWithOwner?: string;
  isFork?: boolean;
  isArchived?: boolean;
  viewerPermission?: string;
  owner?: GhJsonOwner;
};

function gh(args: string[], cwd?: string): { status: number; stdout: string } {
  const result = spawnSync(trustedBin('gh'), args, {
    encoding: 'utf8',
    cwd,
    env: trustedSpawnEnv()
  });
  return { status: result.status ?? 1, stdout: result.stdout ?? '' };
}

function parseRepo(raw: unknown): RepoView | undefined {
  if (raw === null || typeof raw !== 'object') return undefined;
  const row = raw as GhRepoJson;
  const nameWithOwner = row.nameWithOwner?.trim();
  if (!nameWithOwner) return undefined;
  const ownerLogin = row.owner?.login?.trim() || nameWithOwner.split('/')[0] || '';
  return {
    nameWithOwner,
    ownerLogin,
    isFork: Boolean(row.isFork),
    isArchived: Boolean(row.isArchived),
    viewerPermission: String(row.viewerPermission ?? '')
  };
}

export function ghGitHubPort(): GitHubPort {
  return {
    currentUser(): string | undefined {
      const result = gh(['api', 'user', '--jq', '.login']);
      if (result.status !== 0) return undefined;
      const login = result.stdout.trim();
      return login || undefined;
    },
    viewFromCwd(cwd: string): RepoView | undefined {
      const result = gh(
        ['repo', 'view', '--json', 'nameWithOwner,isFork,isArchived,viewerPermission,owner'],
        cwd
      );
      if (result.status !== 0) return undefined;
      try {
        return parseRepo(JSON.parse(result.stdout) as unknown);
      } catch {
        return undefined;
      }
    },
    listSources(login: string): RepoView[] {
      const result = gh([
        'repo',
        'list',
        login,
        '--source',
        '--no-archived',
        '--limit',
        '200',
        '--json',
        'nameWithOwner,isFork,isArchived,viewerPermission,owner'
      ]);
      if (result.status !== 0) return [];
      try {
        const rows = JSON.parse(result.stdout) as unknown;
        if (!Array.isArray(rows)) return [];
        return rows.map(parseRepo).filter((row): row is RepoView => row !== undefined);
      } catch {
        return [];
      }
    },
    remoteFileExists(nameWithOwner: string, relPath: string): boolean {
      const result = gh(['api', `repos/${nameWithOwner}/contents/${relPath}`, '--jq', '.path']);
      return result.status === 0 && result.stdout.trim().length > 0;
    }
  };
}
