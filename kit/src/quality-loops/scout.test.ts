import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('quality-loops scout filing', () => {
  it('files one scout ticket with Work type, no tokens, and no PR', () => {
    const sop = fs.readFileSync(path.join(kitRoot, 'SOPs/quality-loops.md'), 'utf8');
    const scout = sop.split('\n').find((line) => line.includes('Scheduled scout'));
    assert.ok(scout, 'SOP must name scheduled scout');
    assert.match(scout, /Work type/);
    assert.match(scout, /One source/);
    assert.match(scout, /no tokens/i);
    assert.match(scout, /No PR/i);
  });
});
