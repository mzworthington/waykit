import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compareLocale, sortedLocale } from './locale_sort.js';

describe('sortedLocale', () => {
  it('orders strings with localeCompare instead of default sort', () => {
    assert.deepEqual(sortedLocale(['c', 'a', 'b']), ['a', 'b', 'c']);
    assert.equal(compareLocale('a', 'b') < 0, true);
  });
});
