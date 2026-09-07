import { useMemo, useState } from 'react';
import demoMd from '../../../docs/landing/demo.md?raw';
import { presentInlineMarkdown } from '../landing/presentInlineMarkdown';

export type DemoStep = {
  title: string;
  body: string;
  code: string;
};

export function parseDemoMarkdown(md: string): { lead: string; steps: DemoStep[] } {
  const parts = String(md).split(/^## /m);
  const lead = (parts[0] ?? '')
    .replace(/^#.*$/m, '')
    .trim();
  const steps = parts.slice(1).map((part) => {
    const newline = part.indexOf('\n');
    const title = (newline === -1 ? part : part.slice(0, newline)).trim();
    const rest = newline === -1 ? '' : part.slice(newline + 1);
    const fence = rest.match(/```[a-z]*\n([\s\S]*?)```/);
    const body = rest.replace(/```[\s\S]*?```/, '').trim();
    return { title, body, code: fence?.[1]?.trim() ?? '' };
  });
  return { lead, steps };
}

export function EvalDemo() {
  const { lead, steps } = useMemo(() => parseDemoMarkdown(demoMd), []);
  const [index, setIndex] = useState(0);
  const step = steps[index];
  if (!step) return null;

  return (
    <section id="demo" className="demo" aria-labelledby="demo-heading">
      <h2 id="demo-heading">Demo: a miss becomes a failing eval</h2>
      <p className="demo-lead">{presentInlineMarkdown(lead)}</p>
      <div className="demo-shell">
        <ul className="demo-tabs" role="tablist" aria-label="Eval demo steps">
          {steps.map((entry, i) => (
            <li key={entry.title} role="presentation">
              <button
                type="button"
                className="demo-tab"
                role="tab"
                aria-selected={i === index}
                onClick={() => setIndex(i)}
              >
                {entry.title}
              </button>
            </li>
          ))}
        </ul>
        <div className="demo-body">
          <div className="demo-stage is-active" role="tabpanel">
            <h3>{step.title}</h3>
            <p>{step.body}</p>
            {step.code ? (
              <pre className="demo-code" tabIndex={0}>
                <code>{step.code}</code>
              </pre>
            ) : null}
          </div>
          <div className="demo-nav">
            <button type="button" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
              Previous
            </button>
            <button
              type="button"
              className="demo-next"
              disabled={index === steps.length - 1}
              onClick={() => setIndex((i) => i + 1)}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
