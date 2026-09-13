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

  it('accepts execute code that calls the same cloudflare.request with a return-await wrapper', () => {
    const expected =
      'async () => cloudflare.request({ method: "GET", path: `/accounts/${accountId}/rum/site_info/list` })';
    const failures = evaluateArgumentCorrectness({
      testCase: {
        id: 'cf-live-01',
        prompt: 'Are we collecting RUM on the GitHub Pages origin, and can you pull the live site list?',
        expect: { tool: 'execute', arguments_contains: { code: expected } }
      },
      toolCalls: [
        {
          name: 'execute',
          arguments: {
            code: 'return await cloudflare.request({ method: "GET", path: `/accounts/${accountId}/rum/site_info/list` });'
          }
        }
      ]
    });
    assert.deepEqual(failures, []);
  });

  it('accepts search code as a spec.paths filter that still names rum and site_info', () => {
    const failures = evaluateArgumentCorrectness({
      testCase: {
        id: 'cf-search-01',
        prompt: 'Find the Cloudflare API endpoint for listing RUM site_info.',
        expect: { tool: 'search', arguments_contains: { code: 'rum site_info list' } }
      },
      toolCalls: [
        {
          name: 'search',
          arguments: {
            code: "Object.keys(spec.paths).filter(p => p.includes('rum') && p.includes('site_info'))"
          }
        }
      ]
    });
    assert.deepEqual(failures, []);
  });
});
