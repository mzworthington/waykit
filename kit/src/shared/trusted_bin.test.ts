import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { trustedBin, trustedSpawnEnv } from './trusted_bin.js';

describe('trustedBin', () => {
  it('resolves sh to an existing absolute path instead of searching PATH', () => {
    const resolved = trustedBin('sh');
    assert.equal(path.isAbsolute(resolved), true);
    assert.equal(path.basename(resolved), 'sh');
    assert.equal(fs.existsSync(resolved), true);
    assert.equal(trustedSpawnEnv().PATH?.includes('..'), false);
  });
});
