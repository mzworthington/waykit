import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  formatUnitTestErrorMessage,
  githubErrorAnnotations,
  outcomeFromTestEvent,
  relativizeTestFile,
  renderUnitTestReportMarkdown,
  summarizeUnitTests
} from './unit_test_report.mjs';

describe('unit test report helpers', () => {
  it('relativizes absolute paths', () => {
    const abs = `${process.cwd()}/kit/src/foo.test.ts`;
    assert.equal(relativizeTestFile(abs), 'kit/src/foo.test.ts');
    assert.equal(relativizeTestFile('already/relative.ts'), 'already/relative.ts');
  });

  it('ignores suite rollups and maps leaf outcomes', () => {
    assert.equal(
      outcomeFromTestEvent({
        type: 'test:fail',
        data: { details: { type: 'suite', error: { failureType: 'subtestsFailed' } } }
      }),
      null
    );
    assert.equal(
      outcomeFromTestEvent({
        type: 'test:pass',
        data: { skip: true, details: {} }
      }),
      'skip'
    );
    assert.equal(
      outcomeFromTestEvent({
        type: 'test:fail',
        data: { details: { error: { failureType: 'testCodeFailure' } } }
      }),
      'fail'
    );
    assert.equal(outcomeFromTestEvent({ type: 'test:pass', data: { details: {} } }), 'pass');
  });

  it('renders a markdown summary with failures expanded', () => {
    const md = renderUnitTestReportMarkdown([
      {
        name: 'ok',
        file: 'kit/src/a.test.ts',
        outcome: 'pass',
        durationMs: 1.2
      },
      {
        name: 'broken',
        file: 'kit/src/b.test.ts',
        outcome: 'fail',
        durationMs: 3.4,
        errorMessage: 'Expected 1 === 2'
      },
      {
        name: 'later',
        file: 'kit/src/a.test.ts',
        outcome: 'skip',
        durationMs: 0.1
      }
    ]);
    assert.match(md, /Unit tests/);
    assert.match(md, /FAILED/);
    assert.match(md, /1 passed, 1 failed, 1 skipped/);
    assert.match(md, /### Failures/);
    assert.match(md, /broken/);
    assert.match(md, /Expected 1 === 2/);
    assert.match(md, /All test cases/);
    const stats = summarizeUnitTests([
      { name: 'a', file: 'f', outcome: 'pass', durationMs: 1 },
      { name: 'b', file: 'f', outcome: 'fail', durationMs: 2 }
    ]);
    assert.equal(stats.total, 2);
    assert.equal(stats.failed, 1);
    assert.equal(stats.passed, 1);
  });

  it('keeps assertion failures scannable instead of dumping the whole input', () => {
    const sopDump = ['## Cloud catalog', '| Source | File as |', 'x'.repeat(4000)].join('\n');
    const md = renderUnitTestReportMarkdown([
      {
        name: 'returns quality-loops with the Cloud dashboard catalog stop',
        file: 'mcps/servers/kit-knowledge/src/knowledge.test.ts',
        outcome: 'fail',
        durationMs: 7,
        errorMessage: `The input did not match the regular expression /wk loops setup/. Input: '${sopDump}'`
      }
    ]);
    assert.match(md, /did not match the regular expression \/wk loops setup\//);
    assert.ok(!md.includes('## Cloud catalog'), 'job summary must not inherit SOP headings');
    assert.ok(!md.includes('| Source | File as |'), 'job summary must not inherit SOP tables');
    assert.ok(!md.includes('x'.repeat(80)));
  });

  it('strips Node assert input dumps and caps leftover text', () => {
    assert.equal(
      formatUnitTestErrorMessage(
        "The input did not match the regular expression /wk loops setup/. Input: '---\\n' + 'title:'"
      ),
      'The input did not match the regular expression /wk loops setup/.'
    );
    const long = `failure ${'n'.repeat(400)}`;
    const clipped = formatUnitTestErrorMessage(long, 40);
    assert.equal(clipped.endsWith('…'), true);
    assert.ok(clipped.length <= 40);
  });

  it('emits GitHub annotations that point at the failing test file', () => {
    const [annotation] = githubErrorAnnotations([
      {
        name: 'broken',
        file: 'kit/src/b.test.ts',
        line: 12,
        outcome: 'fail',
        durationMs: 3,
        errorMessage: "The input did not match the regular expression /wk loops setup/. Input: '## Cloud catalog'"
      }
    ]);
    assert.equal(
      annotation,
      '::error file=kit/src/b.test.ts,line=12,title=broken::The input did not match the regular expression /wk loops setup/.'
    );
  });

  it('escapes backslashes before pipes in markdown table cells', () => {
    const md = renderUnitTestReportMarkdown([
      {
        name: String.raw`path\to|cell`,
        file: String.raw`dir\file.ts`,
        outcome: 'pass',
        durationMs: 1
      }
    ]);
    assert.match(md, /dir\\\\file\.ts/);
    assert.match(md, /path\\\\to\\\|cell/);
  });
});
