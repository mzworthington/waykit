/**
 * Node.js custom test reporter - emits Markdown for CI job summaries.
 * Plain ESM so `node --test --test-reporter=...` can load it without tsx.
 */
import {
  githubErrorAnnotations,
  outcomeFromTestEvent,
  relativizeTestFile,
  renderUnitTestReportMarkdown
} from './unit_test_report.mjs';

export default async function* githubTestReporter(source) {
  const cases = [];

  for await (const event of source) {
    if (
      event.type !== 'test:pass' &&
      event.type !== 'test:fail' &&
      event.type !== 'test:skip' &&
      event.type !== 'test:todo'
    ) {
      continue;
    }

    const outcome = outcomeFromTestEvent(event);
    if (!outcome) continue;

    const err = event.data.details?.error;
    cases.push({
      name: event.data.name ?? '(unnamed)',
      file: relativizeTestFile(event.data.file),
      line: event.data.line,
      outcome,
      durationMs: event.data.details?.duration_ms ?? 0,
      errorMessage: err?.message ?? err?.cause?.message
    });
  }

  if (process.env.GITHUB_ACTIONS === 'true') {
    for (const line of githubErrorAnnotations(cases)) {
      console.error(line);
    }
  }

  yield renderUnitTestReportMarkdown(cases);
}
