import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { presentInlineMarkdown } from './presentInlineMarkdown';

describe('presentInlineMarkdown', () => {
  it('turns markdown links and code into elements', () => {
    render(<p>{presentInlineMarkdown('See the [demo suite](/evals/edd/demo.yaml) and `demo-edge`.')}</p>);
    const link = screen.getByRole('link', { name: 'demo suite' });
    expect(link.getAttribute('href')).toBe('/evals/edd/demo.yaml');
    expect(screen.getByText('demo-edge').tagName).toBe('CODE');
    expect(screen.queryByText(/\[demo suite\]/)).toBeNull();
  });

  it('turns bold and code into elements without HTML injection', () => {
    render(<p>{presentInlineMarkdown('**Run** `wk check` <script> and <SCRIPT>')}</p>);
    expect(screen.getByText('Run').tagName).toBe('STRONG');
    expect(screen.getByText('wk check').tagName).toBe('CODE');
    expect(screen.getByText('<script>', { exact: false })).toBeTruthy();
    expect(screen.getByText('<SCRIPT>', { exact: false })).toBeTruthy();
    expect(document.querySelector('script')).toBeNull();
  });
});
