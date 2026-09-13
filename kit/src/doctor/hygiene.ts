import type { Ownership } from './ownership.js';

export const REPO_CLASSES = ['kit', 'product', 'dns', 'site', 'template'] as const;
export type RepoClass = (typeof REPO_CLASSES)[number];

export function isRepoClass(value: string | undefined): value is RepoClass {
  return value !== undefined && (REPO_CLASSES as readonly string[]).includes(value);
}

export interface ClassifyRepoMarkers {
  hasKitLayout?: boolean;
  hasTemplateName?: boolean;
  hasPulumiWithoutApp?: boolean;
  hasDocsSiteWithoutApp?: boolean;
}

export function classifyRepo(markers: ClassifyRepoMarkers): RepoClass {
  if (markers.hasKitLayout) return 'kit';
  if (markers.hasTemplateName) return 'template';
  if (markers.hasPulumiWithoutApp) return 'dns';
  if (markers.hasDocsSiteWithoutApp) return 'site';
  return 'product';
}

const SHARED_COMMUNITY_PATHS: readonly string[] = [
  'README.md',
  'LICENSE',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'AGENTS.md',
  '.github/pull_request_template.md',
  '.github/ISSUE_TEMPLATE/config.yml',
  '.github/ISSUE_TEMPLATE/bug_report.yml',
  '.github/ISSUE_TEMPLATE/feature_request.yml',
  '.github/dependabot.yml',
  '.github/workflows/codeql.yml'
];

export function communityRelPaths(repoClass: RepoClass): string[] {
  if (repoClass === 'kit') return [...SHARED_COMMUNITY_PATHS, '.github/CODEOWNERS'];
  return [...SHARED_COMMUNITY_PATHS];
}

export type FindingStatus = 'ok' | 'missing';

export interface HygieneFinding {
  relPath: string;
  status: FindingStatus;
}

export interface PlannedWrite {
  relPath: string;
}

export interface DoctorPlan {
  repoClass: RepoClass;
  ownership: Ownership;
  ok: boolean;
  writeBlocked: boolean;
  skippedReason: Ownership['reason'] | undefined;
  findings: HygieneFinding[];
  writes: PlannedWrite[];
  installHooks: boolean;
}

export interface PlanRepoDoctorOptions {
  repoClass: RepoClass;
  ownership: Ownership;
  existingRelPaths: Set<string>;
  write: boolean;
  installHook: boolean;
  mode?: 'local' | 'fleet';
}

export function planRepoDoctor(opts: PlanRepoDoctorOptions): DoctorPlan {
  const { repoClass, ownership, existingRelPaths, write, installHook } = opts;
  const mode = opts.mode ?? 'local';
  const skipWholeRepo =
    ownership.reason === 'fork' ||
    ownership.reason === 'archived' ||
    (mode === 'fleet' && ownership.reason === 'not-admin');

  if (skipWholeRepo) {
    return {
      repoClass,
      ownership,
      ok: true,
      writeBlocked: true,
      skippedReason: ownership.reason,
      findings: [],
      writes: [],
      installHooks: false
    };
  }

  const findings: HygieneFinding[] = communityRelPaths(repoClass).map((relPath) => ({
    relPath,
    status: existingRelPaths.has(relPath) ? 'ok' : 'missing'
  }));
  const missing = findings.filter((f) => f.status === 'missing');
  const writeBlocked = write && !ownership.inScope;
  const writes =
    write && !writeBlocked ? missing.map((f) => ({ relPath: f.relPath })) : [];

  return {
    repoClass,
    ownership,
    ok: missing.length === 0,
    writeBlocked,
    skippedReason: undefined,
    findings,
    writes,
    installHooks: write && installHook && ownership.inScope
  };
}
