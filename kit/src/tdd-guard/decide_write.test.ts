import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decideWrite } from './decide_write.js';

describe('decideWrite', () => {
  it('allows a single new test when no run has been recorded yet', () => {
    const decision = decideWrite({
      path: 'kit/src/foo.test.ts',
      previousContents: undefined,
      nextContents: "it('fails until parse exists', () => { assert.equal(parse(''), 1); });",
      lastTestOutcome: undefined,
      disabled: false
    });
    assert.equal(decision.permission, 'allow');
  });

  it('blocks adding more than one new test case in a single write', () => {
    const decision = decideWrite({
      path: 'kit/src/foo.test.ts',
      previousContents: "it('one', () => {});",
      nextContents: "it('one', () => {});\nit('two', () => {});\nit('three', () => {});",
      lastTestOutcome: 'fail',
      disabled: false
    });
    assert.equal(decision.permission, 'deny');
    assert.match(decision.agentMessage ?? '', /one test/i);
  });

  it('blocks production writes before any failing test run', () => {
    const decision = decideWrite({
      path: 'kit/src/foo.ts',
      previousContents: undefined,
      nextContents: 'export function foo() { return 1; }',
      lastTestOutcome: undefined,
      disabled: false
    });
    assert.equal(decision.permission, 'deny');
    assert.match(decision.agentMessage ?? '', /failing test/i);
  });

  it('allows the smallest production change after a failing test run', () => {
    const decision = decideWrite({
      path: 'kit/src/foo.ts',
      previousContents: undefined,
      nextContents: 'export function foo() { return 1; }',
      lastTestOutcome: 'fail',
      disabled: false
    });
    assert.equal(decision.permission, 'allow');
  });

  it('allows editing existing production files after green for refactor', () => {
    const decision = decideWrite({
      path: 'kit/src/foo.ts',
      previousContents: 'export function foo() { return 1; }',
      nextContents: 'export function foo(): number { return 1; }',
      lastTestOutcome: 'pass',
      disabled: false
    });
    assert.equal(decision.permission, 'allow');
  });

  it('blocks creating new production files while tests are green', () => {
    const decision = decideWrite({
      path: 'kit/src/bar.ts',
      previousContents: undefined,
      nextContents: 'export function bar() { return 2; }',
      lastTestOutcome: 'pass',
      disabled: false
    });
    assert.equal(decision.permission, 'deny');
    assert.match(decision.agentMessage ?? '', /new production/i);
  });

  it('allows exempt paths and honors disable', () => {
    assert.equal(
      decideWrite({
        path: 'docs/hosts.md',
        nextContents: '# hosts',
        lastTestOutcome: undefined,
        disabled: false
      }).permission,
      'allow'
    );
    assert.equal(
      decideWrite({
        path: 'kit/src/foo.ts',
        nextContents: 'export const x = 1;',
        lastTestOutcome: undefined,
        disabled: true
      }).permission,
      'allow'
    );
  });
});
