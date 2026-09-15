import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { parse as parseYaml } from 'yaml';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('work-picker allowlist', () => {
  it('defaults auto-play to Bug Security Performance Improvement and blocks hold', () => {
    const raw = fs.readFileSync(path.join(kitRoot, 'lists/work-picker-allowlist.yaml'), 'utf8');
    const list = parseYaml(raw) as {
      auto_play: string[];
      wait_unless_auto_work: string[];
      block: string[];
      override: string[];
    };
    assert.deepEqual(list.auto_play, ['Bug', 'Security', 'Performance', 'Improvement']);
    assert.deepEqual(list.wait_unless_auto_work, ['Feature', 'UX']);
    assert.deepEqual(list.block, ['hold']);
    assert.deepEqual(list.override, ['auto-work']);
  });
});
