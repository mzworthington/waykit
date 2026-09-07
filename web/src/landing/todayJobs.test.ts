import { describe, expect, it } from 'vitest';
import todayMd from '../../../docs/today-jobs.md?raw';
import { parseTodayJobsMarkdown } from './todayJobs';

describe('parseTodayJobsMarkdown', () => {
  it('parses id, title, blurb, why, steps, command, and actions', () => {
    const md = `# Jobs

## demo | Demo job

> Button blurb with \`kit\`.

Why this path exists.

1. **Write** the case.
2. **Run** \`kit eval run\`
3. Done.

\`\`\`
kit eval run
\`\`\`

- [Proof](#proof)
- [Suite](./evals/edd/demo.yaml)
`;
    const jobs = parseTodayJobsMarkdown(md);
    expect(jobs).toEqual([
      {
        id: 'demo',
        title: 'Demo job',
        blurb: 'Button blurb with `kit`.',
        why: 'Why this path exists.',
        steps: ['**Write** the case.', '**Run** `kit eval run`', 'Done.'],
        cmd: 'kit eval run',
        actions: [
          { label: 'Proof', href: '#proof' },
          { label: 'Suite', href: './evals/edd/demo.yaml' }
        ]
      }
    ]);
  });

  it('skips headings without an id pipe', () => {
    expect(parseTodayJobsMarkdown('## Just a title\n\nNope.\n')).toEqual([]);
  });
});

describe('docs/today-jobs.md', () => {
  it('is the source for the landing-page jobs', () => {
    const jobs = parseTodayJobsMarkdown(todayMd);
    expect(jobs.map((job) => job.id)).toEqual([
      'first-hour',
      'daily',
      'feature',
      'context',
      'wrong-tool',
      'ci-gate',
      'kit-graph',
      'repo-hygiene',
      'consumer-align'
    ]);
    const firstHour = jobs[0]!;
    expect(firstHour.title).toBe('I have never installed Waykit');
    expect(firstHour.blurb).toMatch(/fresh machine/i);
    const daily = jobs.find((job) => job.id === 'daily')!;
    expect(daily.title).toBe('Typo, bug, or failed job');
    expect(daily.blurb).toMatch(/debug/i);
    expect(daily.cmd).toBe('wk debug-board <project> "<symptom>"');
    const feature = jobs.find((job) => job.id === 'feature')!;
    expect(feature.title).toBe('Starting a product feature');
    expect(feature.blurb).toMatch(/lifecycle path/);
    expect(jobs.every((job) => job.cmd.length > 0 && job.actions.length === 3)).toBe(true);
    const wrongTool = jobs.find((job) => job.id === 'wrong-tool')!;
    expect(wrongTool.title).toBe('Wrong tool or made-up args');
    expect(wrongTool.cmd).toBe('wk eval run --suite evals/edd/demo.yaml --model scripted');
    const kitGraph = jobs.find((job) => job.id === 'kit-graph')!;
    expect(kitGraph.title).toBe('I changed a skill or SOP');
    expect(kitGraph.cmd).toBe('wk ontology check');
    const hygiene = jobs.find((job) => job.id === 'repo-hygiene')!;
    expect(hygiene.title).toBe('Owned repos missing README or templates');
    expect(hygiene.cmd).toBe('wk doctor --owned --scan ~/Documents/dev');
    const align = jobs.find((job) => job.id === 'consumer-align')!;
    expect(align.title).toBe('App repo drifted from the Waykit handshake');
    expect(align.cmd).toBe('wk align .');
    expect(firstHour.cmd).toBe(
      'curl -fsSL https://raw.githubusercontent.com/mzworthington/waykit/main/install.sh | sh'
    );
  });
});
