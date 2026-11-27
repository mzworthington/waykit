import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { closeReview } from './close.js';

describe('closeReview', () => {
  it('drops an unproven finding and says how many were dropped', () => {
    const closed = closeReview(
      [
        { claim: 'the check fails', command: 'wk check', output: 'fail forbidden import' },
        { claim: 'this might be wrong' }
      ],
      { review: 'cursor-grok-4.6-medium' }
    );

    assert.equal(closed.dropped, 1);
    assert.equal(closed.kept.length, 1);
    assert.match(closed.summary, /dropped 1/);
    assert.match(closed.models, /one model/);
    assert.match(closed.models, /a second model is not configured/);
  });

  it('uses the host overlay review model as the second pass', () => {
    const closed = closeReview([{ claim: 'kept', command: 'wk boundaries check', output: 'ok' }], {
      review: 'cursor-grok-4.6-medium',
      reviewSecond: 'cursor-grok-4.7'
    });

    assert.match(closed.models, /second pass cursor-grok-4\.7/);
    assert.equal(closed.models.includes('not configured'), false);
  });
});
