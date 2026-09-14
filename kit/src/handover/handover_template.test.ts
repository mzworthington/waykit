import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const template = fs.readFileSync(path.join(repoDir, 'templates/handover.md'), 'utf8');

describe('templates/handover.md', () => {
  it('ends with Goal after Pre-commit recapping the user ask', () => {
    const pre = template.indexOf('## Pre-commit');
    const goal = template.indexOf('## Goal');
    assert.ok(pre >= 0, 'missing Pre-commit section');
    assert.ok(goal > pre, 'Goal must follow Pre-commit');
    assert.match(template.slice(goal), /\*\*Asked\*\*/);
    assert.match(template.slice(goal), /\*\*Met by\*\*/);
  });
});
