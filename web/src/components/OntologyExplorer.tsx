import { useEffect, useRef, useState } from 'react';
import { HOMEPAGE_TYPE_FILTERS, TYPE_COLOR } from '../../../kit/src/ontology/graph_view';
import { mountOntologyExplorer } from '../ontology/map';

export function OntologyExplorer() {
  const rootRef = useRef<HTMLElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    void mountOntologyExplorer(root);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('ontology-map-fullscreen', fullscreen);
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.documentElement.classList.remove('ontology-map-fullscreen');
    };
  }, [fullscreen]);

  return (
    <section
      id="ontology"
      className={`ontology-explorer${fullscreen ? ' ontology-explorer--fullscreen' : ''}`}
      aria-label="Kit ontology map"
      ref={rootRef}
    >
      <header className="ontology-chrome">
        <h2 id="ontology-heading" className="ontology-heading">
          Explore the graph
        </h2>
        <form className="ontology-toolbar" role="search">
          <label className="ontology-search">
            Find
            <input
              id="ontology-q"
              type="search"
              name="q"
              placeholder="tdd, hexagonal, playwright"
              autoComplete="off"
              aria-describedby="ontology-stats"
            />
          </label>
          <fieldset className="ontology-types" id="ontology-types">
            <legend>Show types</legend>
          </fieldset>
          <p id="ontology-stats" className="ontology-stats">
            Loading index…
          </p>
          <button type="button" id="ontology-clear">
            Clear focus
          </button>
        </form>
      </header>
      <div className="ontology-stage">
        <div className="ontology-canvas-frame">
          <div id="ontology-canvas" className="hero-d3-wrapper" />
          <aside className="ontology-key" aria-labelledby="ontology-key-heading">
            <h3 id="ontology-key-heading">Key</h3>
            <ul className="ontology-key-nodes">
              {HOMEPAGE_TYPE_FILTERS.map((filter) => (
                <li key={filter.type}>
                  <span
                    className="ontology-key-swatch"
                    aria-hidden="true"
                    style={{ backgroundColor: TYPE_COLOR[filter.type] }}
                  />
                  {filter.label}
                </li>
              ))}
            </ul>
          </aside>
          <button
            type="button"
            className="ontology-fs-toggle"
            aria-pressed={fullscreen}
            onClick={() => setFullscreen((value) => !value)}
          >
            {fullscreen ? 'Exit full screen' : 'Full screen'}
          </button>
        </div>
        <aside id="ontology-inspector" aria-labelledby="ontology-inspector-heading" aria-live="polite">
          <h3 id="ontology-inspector-heading">Selected entity</h3>
          <div id="ontology-inspector-body" />
        </aside>
      </div>
      <ol id="ontology-matches" className="ontology-matches" hidden />
    </section>
  );
}
