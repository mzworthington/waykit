import { useEffect, useId, useState } from 'react';
import { queueMermaidRender } from './mermaidRenderer';

type MermaidApi = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, code: string) => Promise<{ svg: string }>;
};

const MERMAID_KEY = '__waykitMermaid';

function mermaidSvgId(seed: string): string {
  const safe = seed.replace(/[^a-zA-Z0-9]/g, '') || 'x';
  return `mmd${safe}`;
}

async function getMermaid(): Promise<MermaidApi> {
  const slot = globalThis as typeof globalThis & { [MERMAID_KEY]?: Promise<MermaidApi> };
  slot[MERMAID_KEY] ??= (async () => {
    const { default: mermaid } = await import('mermaid');
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
        flowchart: { useMaxWidth: true, htmlLabels: false },
        sequence: { useMaxWidth: true }
      });
    } catch {
      // HMR may re-enter after mermaid already initialized.
    }
    return mermaid;
  })();
  return slot[MERMAID_KEY];
}

type Props = { code: string };

export function MermaidPreview({ code }: Props) {
  const reactId = mermaidSvgId(useId());
  const [svg, setSvg] = useState('');
  const [error, setError] = useState('');
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let gen = 0;
    const run = async () => {
      if (!code.trim()) return;
      const my = ++gen;
      setRendering(true);
      setError('');
      try {
        const mermaid = await getMermaid();
        if (cancelled || my !== gen) return;
        const id = `${reactId}${Math.random().toString(36).slice(2, 8)}`;
        const { svg: rendered } = await queueMermaidRender(() => mermaid.render(id, code));
        if (!cancelled && my === gen) {
          setSvg(rendered);
          setError('');
          setRendering(false);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled && my === gen) {
          setError('Could not render diagram.');
          setRendering(false);
        }
      }
    };
    void run();
    document.addEventListener('astro:page-load', run);
    return () => {
      cancelled = true;
      document.removeEventListener('astro:page-load', run);
    };
  }, [code, reactId]);

  if (error) {
    return (
      <div className="docs-mermaid docs-mermaid-error" role="alert">
        <p>{error}</p>
        <pre>
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  if (rendering && !svg) {
    return (
      <div className="docs-mermaid docs-mermaid-loading" aria-busy="true">
        Loading diagram…
      </div>
    );
  }

  return (
    <div
      className="docs-mermaid"
      data-testid="docs-mermaid"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
