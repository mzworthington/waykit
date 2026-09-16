import {
  HOME_BRAND,
  HOME_EYEBROW,
  HOME_HEADLINE,
  HOME_INIT,
  HOME_INSTALL,
  HOME_LEDE
} from '../landing/copy';
import { HomeCtas } from './HomeCtas';

export function HomeHero() {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <div className="hero-split">
        <div className="hero-copy">
          <p className="hero-eyebrow">{HOME_EYEBROW}</p>
          <h1 id="hero-heading" className="hero-brand">
            {HOME_BRAND}
          </h1>
          <p className="hero-title">{HOME_HEADLINE}</p>
          <p className="hero-subtitle">{HOME_LEDE}</p>
          <div className="hero-install">
            <pre>
              <code>{HOME_INSTALL}</code>
            </pre>
            <p className="hero-install-then">
              Then <code>{HOME_INIT}</code>
            </p>
          </div>
          <HomeCtas />
        </div>
        <figure className="hero-loops">
          <img
            src="/assets/waykit-loops.svg"
            alt="Four concentric rings: Waykit, Signals, Plan, and Build"
            width={800}
            height={800}
          />
        </figure>
      </div>
    </section>
  );
}
