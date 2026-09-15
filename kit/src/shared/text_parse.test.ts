import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseNumberedHeading, slugifyAscii } from './text_parse.js';

describe('text_parse', () => {
  it('parses numbered headings and ascii slugs without quantified regexes', () => {
    assert.deepEqual(parseNumberedHeading('8. Interaction Mandate'), {
      id: '8',
      title: 'Interaction Mandate'
    });
    assert.equal(slugifyAscii('Hello, World!'), 'hello-world');
  });
});
