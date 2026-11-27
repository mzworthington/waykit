import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { auditPendingLessons, loadPlanContext } from './audit.js';

describe('auditPendingLessons', () => {
  it('keeps a pending lesson that has no enforcer and names it', () => {
    const audit = auditPendingLessons([
      { title: 'unstamped server', enforcer: 'check' },
      { title: 'missing rule owner' }
    ]);

    assert.deepEqual(audit.stillPending, ['missing rule owner']);
    assert.equal(audit.wroteLesson, false);
  });

  it('does not treat a fully enforced pass as the moment the lesson is written', () => {
    const audit = auditPendingLessons([{ title: 'pin pnpm', enforcer: 'check' }]);

    assert.deepEqual(audit.stillPending, []);
    assert.equal(audit.wroteLesson, false);
    assert.match(audit.summary, /audit/);
    assert.doesNotMatch(audit.summary, /wrote the lesson/);
  });

  it('reads the rule table and pending lessons and skips a learning doc written for this change', () => {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-plan-'));
    fs.writeFileSync(path.join(repo, 'rules.md'), '| Rule | Enforces |\n| pin pnpm | check |\n', 'utf8');
    fs.mkdirSync(path.join(repo, 'lessons'));
    fs.writeFileSync(
      path.join(repo, 'lessons', '2026-11-27.md'),
      '## missing owner\nStatus: pending\n',
      'utf8'
    );
    fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(repo, 'docs', 'learning-this-change.md'), 'do not load this learning doc\n', 'utf8');

    const context = loadPlanContext(repo);

    assert.match(context.text, /pin pnpm/);
    assert.match(context.text, /missing owner/);
    assert.equal(context.text.includes('do not load this learning doc'), false);
  });
});
