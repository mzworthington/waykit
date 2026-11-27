import fs from 'node:fs';
import path from 'node:path';

export interface PendingLesson {
  title: string;
  enforcer?: string;
}

export interface LessonAudit {
  stillPending: string[];
  wroteLesson: boolean;
  summary: string;
}

export function auditPendingLessons(lessons: readonly PendingLesson[]): LessonAudit {
  const stillPending = lessons.filter((lesson) => !lesson.enforcer).map((lesson) => lesson.title);
  const summary =
    stillPending.length === 0
      ? 'audit: every pending lesson already has an enforcer'
      : `audit: still pending ${stillPending.join(', ')}`;
  return { stillPending, wroteLesson: false, summary };
}

export function loadPlanContext(repoDir: string): { text: string } {
  const rules = fs.readFileSync(path.join(repoDir, 'rules.md'), 'utf8');
  const lessonsDir = path.join(repoDir, 'lessons');
  const pending: string[] = [];
  if (fs.existsSync(lessonsDir)) {
    for (const name of fs.readdirSync(lessonsDir).sort()) {
      if (!name.endsWith('.md')) continue;
      const body = fs.readFileSync(path.join(lessonsDir, name), 'utf8');
      if (!body.includes('Status: pending')) continue;
      const title = body.match(/^## (.+)$/m)?.[1] ?? name;
      pending.push(title);
    }
  }
  return { text: `${rules}\n${pending.join('\n')}` };
}
