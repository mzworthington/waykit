import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownView } from './MarkdownView';

describe('MarkdownView', () => {
  it('puts fenced commands in a code figure and tables in a scroll wrapper', () => {
    render(
      <MarkdownView
        docPaths={['/docs/edd']}
        fromDir="docs"
        markdown={`# Kit

\`\`\`bash
kit check
\`\`\`

| Command | Role |
|---------|------|
| \`kit check\` | gate |
`}
      />
    );

    const figure = document.querySelector('figure.docs-code');
    expect(figure).toBeTruthy();
    expect(figure?.querySelector('pre')?.textContent).toContain('kit check');
    expect(document.querySelector('.table-wrapper table')).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Command' })).toBeTruthy();
  });

  it('resolves in-catalog markdown links from docPaths without importing the catalog module', () => {
    render(
      <MarkdownView
        docPaths={['/docs/edd']}
        fromDir="docs"
        markdown="See the [EDD guide](edd.md)."
      />
    );
    expect(screen.getByRole('link', { name: 'EDD guide' }).getAttribute('href')).toBe('/docs/edd');
  });
});
