import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import mermaid from 'mermaid';
import { MermaidPreview } from './MermaidPreview';

describe('MermaidPreview security', () => {
  it('initializes mermaid in strict mode so diagram HTML is sanitized', async () => {
    delete (globalThis as { __waykitMermaid?: unknown }).__waykitMermaid;
    const initialize = vi.spyOn(mermaid, 'initialize');

    render(<MermaidPreview code={'flowchart TD\n  A["<img src=x onerror=alert(1)>"]'} />);

    await waitFor(() => {
      expect(initialize).toHaveBeenCalled();
    });

    expect(initialize.mock.calls.at(-1)?.[0]).toMatchObject({ securityLevel: 'strict' });
  });
});
