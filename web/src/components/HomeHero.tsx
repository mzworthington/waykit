import { HOME_BADGES, HOME_BRAND, HOME_EYEBROW, HOME_HEADLINE, HOME_LEDE } from '../landing/copy';
import { HomeCtas } from './HomeCtas';

export function HomeHero() {
  return (
    <section className="hero" aria-labelledby="hero-heading">
      <p className="hero-eyebrow">{HOME_EYEBROW}</p>
      <h1 id="hero-heading" className="hero-brand">
        {HOME_BRAND}
      </h1>
      <p className="hero-title">{HOME_HEADLINE}</p>
      <p className="hero-subtitle">{HOME_LEDE}</p>
      <ul className="badge-bar">
        {HOME_BADGES.map((badge) => (
          <li key={badge.alt}>
            <a href={badge.href} rel={badge.href.startsWith('http') ? 'noopener noreferrer' : undefined}>
              <img
                src={badge.src}
                alt={badge.alt}
                width={badge.width}
                height={badge.height}
                fetchPriority="high"
              />
            </a>
          </li>
        ))}
      </ul>
      <HomeCtas />
    </section>
  );
}
