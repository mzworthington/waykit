import { describe, expect, it } from 'vitest';
import { queueMermaidRender } from './mermaidRenderer';

describe('queueMermaidRender', () => {
  it('runs overlapping renders one at a time so mermaid does not throw', async () => {
    let inflight = 0;
    let maxInflight = 0;
    const render = async (label: string) => {
      inflight += 1;
      maxInflight = Math.max(maxInflight, inflight);
      if (inflight > 1) throw new Error(`concurrent ${label}`);
      await Promise.resolve();
      inflight -= 1;
      return label;
    };

    const [first, second] = await Promise.all([
      queueMermaidRender(() => render('a')),
      queueMermaidRender(() => render('b'))
    ]);

    expect(maxInflight).toBe(1);
    expect([first, second]).toEqual(['a', 'b']);
  });
});
