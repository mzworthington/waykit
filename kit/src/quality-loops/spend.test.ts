import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('quality-loops spend cap', () => {
  it('SOP and prompts cap spend with dashboard limit, cron, skip_unless, and one item per run', () => {
    const sop = fs.readFileSync(path.join(kitRoot, 'SOPs/quality-loops.md'), 'utf8');
    assert.match(sop, /## Spend cap/);
    assert.match(sop, /no per-Automation token cap/i);
    assert.match(sop, /cursor.com\/dashboard\?tab=spending/);
    assert.match(sop, /cron/i);
    assert.match(sop, /skip_unless/);
    assert.match(sop, /at most one item per run/i);
    assert.match(sop, /Kill if .*spend/i);

    const docs = fs.readFileSync(path.join(kitRoot, 'docs/loops.md'), 'utf8');
    assert.match(docs, /no per-Automation token cap/i);
    assert.match(docs, /dashboard\?tab=spending/);

    const prefix = fs.readFileSync(path.join(kitRoot, 'templates/quality-loops.md'), 'utf8');
    const section = prefix.split('## Cloud catalog missing (any loop)')[1]?.split('## ')[0] ?? '';
    assert.match(section, /at most one item this run/i);
    assert.match(section, /skip_unless/);
  });
});
