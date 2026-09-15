import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import {
  planBacklogHygiene,
  type HygieneAction,
  type HygieneTicket
} from './hygiene.js';

const kitRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function ticket(partial: Partial<HygieneTicket> & Pick<HygieneTicket, 'id' | 'title'>): HygieneTicket {
  return {
    body: '',
    statusType: 'backlog',
    labels: [],
    ...partial
  };
}

function actionsFor(actions: HygieneAction[], id: string): HygieneAction[] {
  return actions.filter((action) => action.ticketId === id);
}

describe('quality-loops backlog hygiene', () => {
  it('keeps one fingerprint twin playable and marks the other Duplicate without cloning', () => {
    const actions = planBacklogHygiene([
      ticket({
        id: 'MZW-1',
        title: 'ServiceWorker install fails on archlens.dev/sw.js',
        body: 'Fingerprint: `source:archlens:sw.js:install`\nBroken install.',
        createdAt: '2026-09-01T00:00:00Z'
      }),
      ticket({
        id: 'MZW-2',
        title: 'ServiceWorker install still failing on archlens.dev/sw.js',
        body: 'Fingerprint: `source:archlens:sw.js:install`\nSame install failure.',
        createdAt: '2026-09-02T00:00:00Z'
      })
    ]);

    assert.ok(actions.some((action) => action.type === 'keep-playable' && action.ticketId === 'MZW-1'));
    assert.ok(
      actions.some((action) => action.type === 'mark-duplicate' && action.ticketId === 'MZW-2' && action.of === 'MZW-1')
    );
    assert.equal(
      actions.filter((action) => action.type === 'keep-playable' || action.type === 'mark-duplicate').length,
      2
    );
    assert.ok(!actions.some((action) => 'create' in action));
  });

  it('treats near-duplicate title and body as Duplicate, not a third clone', () => {
    const body =
      'The guide Lighthouse performance dropped versus last main. Recover the performance category score.';
    const actions = planBacklogHygiene([
      ticket({ id: 'MZW-10', title: 'Recover TraceLens guide Lighthouse performance vs last main', body }),
      ticket({ id: 'MZW-11', title: 'Recover TraceLens guide Lighthouse performance versus last main', body })
    ]);

    const duplicate = actions.find((action) => action.type === 'mark-duplicate');
    const playable = actions.find((action) => action.type === 'keep-playable');
    assert.ok(playable);
    assert.ok(duplicate);
    assert.notEqual(playable!.ticketId, duplicate!.ticketId);
    assert.ok(!actions.some((action) => action.type === 'rewrite' && action.body.includes(body + body)));
  });

  it('rewrites a Backlog ticket missing Story or Then and sets one Work type', () => {
    const actions = planBacklogHygiene([
      ticket({
        id: 'MZW-20',
        title: 'Shim window in dagre layout worker',
        body: 'ReferenceError: window is not defined in the layout worker.',
        statusType: 'backlog',
        labels: []
      })
    ]);

    const rewrite = actions.find((action) => action.type === 'rewrite' && action.ticketId === 'MZW-20');
    assert.ok(rewrite);
    assert.equal(rewrite!.type, 'rewrite');
    if (rewrite?.type !== 'rewrite') throw new Error('expected rewrite');
    assert.equal(rewrite.workType, 'Bug');
    assert.match(rewrite.body, /As an operator/);
    assert.match(rewrite.body, /I want/);
    assert.match(rewrite.body, /so that/);
    assert.match(rewrite.body, /\bThen\b/i);
    assert.match(rewrite.body, /Work type: Bug/);
  });

  it('leaves Done and Canceled tickets unchanged', () => {
    const actions = planBacklogHygiene([
      ticket({
        id: 'MZW-30',
        title: 'ServiceWorker install failure',
        body: 'Fingerprint: `source:archlens:sw.js:install`',
        statusType: 'completed',
        labels: []
      }),
      ticket({
        id: 'MZW-31',
        title: 'Canceled draft',
        body: 'No Story and no Then.',
        statusType: 'canceled',
        labels: []
      })
    ]);

    assert.deepEqual(actionsFor(actions, 'MZW-30'), [{ type: 'skip', ticketId: 'MZW-30', reason: 'completed' }]);
    assert.deepEqual(actionsFor(actions, 'MZW-31'), [{ type: 'skip', ticketId: 'MZW-31', reason: 'canceled' }]);
  });

  it('parents or relates similar tickets instead of pasting them into one blob', () => {
    const actions = planBacklogHygiene([
      ticket({
        id: 'MZW-40',
        title: 'Restore Cloudflare Web Analytics beacon',
        body: [
          '## Story',
          'As an operator, I want the beacon restored, so that RUM is honest.',
          '## Acceptance criteria',
          '- [ ] Given the beacon is missing, when the scout runs, then one Bug ticket exists.',
          'Fingerprint: `source:archlens:rum:beacon`'
        ].join('\n'),
        labels: ['Bug']
      }),
      ticket({
        id: 'MZW-41',
        title: 'Restore Cloudflare analytics beacon on the marketing host',
        body: 'Fingerprint: `source:archlens:rum:spa`\nBeacon is still missing on the SPA host.',
        labels: []
      })
    ]);

    assert.ok(
      actions.some(
        (action) =>
          (action.type === 'relate-child' && action.ticketId === 'MZW-41' && action.parentId === 'MZW-40') ||
          (action.type === 'relate' && action.ticketId === 'MZW-41' && action.otherId === 'MZW-40')
      )
    );
    assert.ok(!actions.some((action) => action.type === 'rewrite' && action.body.includes('one Bug ticket exists') && action.body.includes('SPA host') && action.ticketId === 'MZW-40'));
  });

  it('relates duplicates that disagree on acceptance criteria instead of merging them', () => {
    const actions = planBacklogHygiene([
      ticket({
        id: 'MZW-50',
        title: 'Fix ServiceWorker install failure',
        body: [
          'Fingerprint: `source:archlens:sw.js:install`',
          '- [ ] Given install fails, when the worker registers, then sw.js returns 200.'
        ].join('\n')
      }),
      ticket({
        id: 'MZW-51',
        title: 'Fix ServiceWorker install failure',
        body: [
          'Fingerprint: `source:archlens:sw.js:install`',
          '- [ ] Given install fails, when the worker registers, then the page shows a retry affordance.'
        ].join('\n')
      })
    ]);

    assert.ok(actions.some((action) => action.type === 'relate' && action.ticketId === 'MZW-51' && action.otherId === 'MZW-50'));
    assert.ok(!actions.some((action) => action.type === 'mark-duplicate'));
  });

  it('comments and leaves the ticket when unsure, and never cancels product work', () => {
    const actions = planBacklogHygiene([
      ticket({
        id: 'MZW-60',
        title: 'Map hover',
        body: 'Something about the map. No story. No then. No work type.'
      }),
      ticket({
        id: 'MZW-61',
        title: 'Map hover focus',
        body: 'A completely different product bet about pricing and seats with no shared evidence.'
      })
    ]);

    assert.ok(actions.some((action) => action.type === 'comment' && action.ticketId === 'MZW-60'));
    assert.ok(!actions.some((action) => action.type === 'skip' && action.reason === 'canceled'));
    assert.ok(!actions.some((action) => action.type === 'mark-duplicate'));
  });

  it('skips gated PostHog bet rows', () => {
    const actions = planBacklogHygiene([
      ticket({
        id: 'MZW-58',
        title: 'Turn PostHog signals into confirmed Linear work',
        body: 'Gated PostHog bet. See MZW-58. Do not rewrite.',
        gatedPosthogBet: true
      })
    ]);

    assert.deepEqual(actions, [{ type: 'skip', ticketId: 'MZW-58', reason: 'gated-posthog-bet' }]);
  });

  it('names the SOP and prompt contract: group, rewrite INVEST, Duplicate, leave Done, comment when unsure', () => {
    const sop = fs.readFileSync(path.join(kitRoot, 'SOPs/quality-loops.md'), 'utf8');
    const prompt = fs.readFileSync(path.join(kitRoot, 'templates/quality-loops.md'), 'utf8');
    const hygiene = sop.split('## Hygiene')[1] ?? '';
    assert.match(hygiene, /fingerprint/i);
    assert.match(hygiene, /Duplicate/);
    assert.match(hygiene, /INVEST/);
    assert.match(hygiene, /Done/);
    assert.match(hygiene, /Canceled/);
    assert.match(hygiene, /comment/i);
    assert.match(hygiene, /Work type/);
    assert.match(hygiene, /blob/);
    assert.match(prompt, /## Hygiene/);
    assert.match(prompt, /Do not cancel product work/);
    assert.match(prompt, /Done or Canceled|Leave Done/);
  });
});
