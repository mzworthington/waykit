import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyPath, countTestCases } from './classify_path.js';

describe('classifyPath', () => {
  it('treats spec and test files as tests', () => {
    assert.equal(classifyPath('kit/src/foo.test.ts'), 'test');
    assert.equal(classifyPath('app/src/Bar.spec.tsx'), 'test');
    assert.equal(classifyPath('monitor/tests/test_snapshot.py'), 'test');
    assert.equal(classifyPath('internal/foo/foo_test.go'), 'test');
  });

  it('treats application source as production', () => {
    assert.equal(classifyPath('kit/src/tdd-guard/decide_write.ts'), 'production');
    assert.equal(classifyPath('app/src/domain/Order.ts'), 'production');
    assert.equal(classifyPath('monitor/poller.py'), 'production');
  });

  it('exempts docs, skills, and config so handshake work is not gated', () => {
    assert.equal(classifyPath('SOPs/tdd-guard.md'), 'exempt');
    assert.equal(classifyPath('skills/agent-tdd/SKILL.md'), 'exempt');
    assert.equal(classifyPath('docs/hosts.md'), 'exempt');
    assert.equal(classifyPath('package.json'), 'exempt');
    assert.equal(classifyPath('web/src/index.css'), 'exempt');
  });
});

describe('countTestCases', () => {
  it('counts it, test, and Python/Go test functions', () => {
    assert.equal(countTestCases("it('a', () => {})\nit('b', () => {})"), 2);
    assert.equal(countTestCases('def test_one():\n  pass\ndef helper():\n  pass'), 1);
    assert.equal(countTestCases('func TestFoo(t *testing.T) {}'), 1);
  });
});
