import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateArgumentCorrectness } from './argument-correctness.js';

describe('argument_correctness meaning', () => {
  it('accepts cloudflare-ops as the analytics SOP stem', () => {
    const failures = evaluateArgumentCorrectness({
      testCase: {
        id: 'kit-sop-cf-01',
        prompt: 'Open the kit SOP for Cloudflare analytics ops.',
        expect: { tool: 'get_sop', arguments_contains: { name: 'cloudflare-analytics-ops' } }
      },
      toolCalls: [{ name: 'get_sop', arguments: { name: 'cloudflare-ops' } }]
    });
    assert.deepEqual(failures, []);
  });

  it('accepts a search query that keeps the expected keywords', () => {
    const failures = evaluateArgumentCorrectness({
      testCase: {
        id: 'kit-search-01',
        prompt: 'Search the kit for hexagonal architecture boundaries.',
        expect: { tool: 'search_kit', arguments_contains: { query: 'hexagonal architecture' } }
      },
      toolCalls: [{ name: 'search_kit', arguments: { query: 'hexagonal architecture boundaries' } }]
    });
    assert.deepEqual(failures, []);
  });
});
