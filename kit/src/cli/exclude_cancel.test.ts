import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { excludeCancel } from './exclude_cancel.js';

describe('excludeCancel', () => {
  const isCancel = (value: unknown): boolean => typeof value === 'symbol';

  it('returns null for cancel symbols so callers can exit', () => {
    assert.equal(excludeCancel(Symbol('clack:cancel'), isCancel), null);
  });

  it('returns a select value after cancel is excluded', () => {
    const value: 'check' | symbol = 'check';
    const kept = excludeCancel(value, isCancel);
    if (kept === null) {
      assert.fail('expected a kept value');
    }
    const action: 'check' = kept;
    assert.equal(action, 'check');
  });
});
