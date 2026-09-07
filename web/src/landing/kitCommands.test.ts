import { describe, expect, it } from 'vitest';
import kitMd from '../../../docs/kit.md?raw';
import { parseKitCommandsMarkdown } from './kitCommands';

describe('parseKitCommandsMarkdown', () => {
  it('reads the lead and command table under ## Commands', () => {
    const md = `# What Waykit gives you

## Quality gate

wk check is the merge bar.

## Commands

Skills tell the agent the path. You operate the kit with \`wk\`.

| Command | What it measures or installs |
|---------|------------------------------|
| \`wk check\` | Audit, ontology, evals, EDD CI, context budget |
| \`wk doctor\` | Community files on owned GitHub sources |

EDD loop: [edd.md](./edd.md).
`;
    expect(parseKitCommandsMarkdown(md)).toEqual({
      lead: 'Skills tell the agent the path. You operate the kit with `wk`.',
      rows: [
        { command: 'wk check', purpose: 'Audit, ontology, evals, EDD CI, context budget' },
        { command: 'wk doctor', purpose: 'Community files on owned GitHub sources' }
      ]
    });
  });

  it('returns empty rows when Commands is missing', () => {
    expect(parseKitCommandsMarkdown('# Intro\n\nNo table.\n')).toEqual({ lead: '', rows: [] });
  });
});

describe('docs/kit.md', () => {
  it('is the source for the homepage CLI table', () => {
    const { lead, rows } = parseKitCommandsMarkdown(kitMd);
    expect(lead).toMatch(/operate/i);
    expect(lead).toMatch(/`wk`/);
    expect(lead).toMatch(/align/);
    expect(lead).toMatch(/doctor/);
    expect(lead).toMatch(/check/);
    expect(rows.map((row) => row.command)).toEqual([
      'wk align',
      'wk doctor',
      'wk check',
      'wk version',
      'wk measure-context',
      'wk completion zsh',
      'wk ontology check',
      'wk agents generate',
      'wk agents install',
      'wk agents status',
      'wk agents launch-prompt',
      'wk ontology generate',
      'wk mcp <profile>',
      'wk audit',
      'wk eval ci',
      'wk sync'
    ]);
    expect(rows.every((row) => row.purpose.length > 8)).toBe(true);
  });
});
