import fs from 'node:fs';
import path from 'node:path';

const TRUSTED_BIN_DIRS = ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'] as const;

export const TRUSTED_PATH = TRUSTED_BIN_DIRS.join(':');

export function trustedBin(name: string): string {
  if (name.includes('/') || name.includes('\\') || name.includes('\0')) {
    throw new Error(`refusing non-basename executable: ${name}`);
  }
  for (const dir of TRUSTED_BIN_DIRS) {
    const candidate = path.join(dir, name);
    if (fs.existsSync(candidate)) return candidate;
  }
  return path.join('/usr/bin', name);
}

export function trustedSpawnEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  return { ...base, PATH: TRUSTED_PATH };
}
