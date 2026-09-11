import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const skillPath = path.join(kitRoot, 'skills/lang-python/SKILL.md');

describe('lang-python profile', () => {
  it('steers readable, typed, testable Python from a navigable skill', () => {
    const body = fs.readFileSync(skillPath, 'utf8');
    for (const marker of [
      '## Navigate',
      'references/style.md',
      'references/typing.md',
      'references/testing.md',
      'references/pydantic.md',
      'TypeAdapter',
      'ruff',
      'Protocol',
      'pathlib',
      'parametrize',
      'mutable default',
      'except:',
      '## Anti-patterns'
    ]) {
      assert.match(body, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  });
});
