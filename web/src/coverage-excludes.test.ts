import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const vitestConfig = readFileSync(resolve(import.meta.dirname, '../vitest.config.ts'), 'utf8');

describe('coverage report omits test files', () => {
  it('excludes test folders, scripts, and Vite config from Vitest coverage', () => {
    expect(vitestConfig).toMatch(/\*\*\/test\/\*\*/);
    expect(vitestConfig).toMatch(/\*\*\/tests\/\*\*/);
    expect(vitestConfig).toMatch(/\*\*\/scripts\/\*\*/);
    expect(vitestConfig).toMatch(/\*\*\/vite\.config\.\*/);
    expect(vitestConfig).toMatch(/\*\*\/vitest\.config\.\*/);
    expect(vitestConfig).toMatch(/\*\*\/\.vite\/\*\*/);
    expect(vitestConfig).toMatch(/\*\*\/vite\/\*\*/);
  });
});
