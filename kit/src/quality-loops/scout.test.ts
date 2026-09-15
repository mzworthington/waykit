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

  it('files one Performance ticket on a category drop, not a chase-100 or a PR', () => {
    const sop = fs.readFileSync(path.join(kitRoot, 'SOPs/quality-loops.md'), 'utf8');
    const row = sop.split('\n').find((line) => line.includes('Lighthouse drop vs last main'));
    assert.ok(row, 'SOP must name Lighthouse drop vs last main');
    assert.match(row, /Performance/);
    assert.match(row, /chase 100/);

    const prompt = fs.readFileSync(path.join(kitRoot, 'templates/quality-loops.md'), 'utf8');
    const section = prompt.split('## File from a Lighthouse drop')[1]?.split('## ')[0] ?? '';
    assert.match(section, /If a category dropped/);
    assert.match(section, /Performance ticket/);
    assert.match(section, /do not file a ticket to chase 100/i);
    assert.match(section, /comment instead of cloning/);
    assert.match(section, /Do not open a PR/);
  });
});
