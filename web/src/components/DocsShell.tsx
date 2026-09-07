import { type ReactNode, useState } from 'react';
import {
  docsSidebar,
  isDocsNavActive,
  SITE_NAV,
  type DocsNavPage
} from '../docs/nav';
import { SITE_MARK_SRC, SITE_NAME, SITE_SHORT_NAME } from '../seo/siteSeo';
import { SITE_FOOTER_NAV, SITE_GITHUB } from '../site/footerNav';

type Props = {
  children: ReactNode;
  pathname: string;
  pages: readonly DocsNavPage[];
  layout?: 'docs' | 'landing';
  wide?: boolean;
};

export function DocsShell({
  children,
  pathname,
  pages,
  layout = 'docs',
  wide = false
}: Props) {
  const location = pathname.replace(/\/$/, '') || '/';
  const [open, setOpen] = useState(false);
  const sidebar = docsSidebar(location, pages);
  const isLanding = layout === 'landing';

  return (
    <div className={`site${isLanding ? ' site--landing' : ''}`}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="nav-container">
          <a href="/" className="brand" aria-label={SITE_NAME}>
            <img src={SITE_MARK_SRC} alt="" width={36} height={36} />
            <span aria-hidden="true">{SITE_SHORT_NAME}</span>
          </a>
          <nav id="site-nav" className={`nav-links${open ? ' is-open' : ''}`} aria-label="Site">
            <ul>
              {SITE_NAV.map((item) => {
                const active = isDocsNavActive(location, item);
                return (
                  <li key={item.path}>
                    <a
                      href={item.path}
                      className={`nav-link${active ? ' is-active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setOpen(false)}
                    >
                      {item.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
          <a href={SITE_GITHUB} className="btn-github" rel="noopener noreferrer">
            GitHub
          </a>
          <button
            type="button"
            className="nav-toggle"
            aria-controls="site-nav"
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="nav-toggle-bar" aria-hidden="true" />
            <span className="nav-toggle-bar" aria-hidden="true" />
            <span className="nav-toggle-bar" aria-hidden="true" />
          </button>
        </div>
      </header>
      {!isLanding ? (
        <nav className="docs-mobile-nav" aria-label="Documentation chapters">
          {sidebar.map((section) => (
            <nav key={section.title} className="docs-mobile-group" aria-label={section.title}>
              <p className="docs-mobile-label">{section.title}</p>
              <ul>
                {section.items.map((item) => {
                  const active = location === item.path;
                  return (
                    <li key={item.path}>
                      <a href={item.path} className={active ? 'is-active' : undefined}>
                        {item.label}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ))}
        </nav>
      ) : null}
      <div
        className={
          isLanding ? 'landing-shell' : `docs-shell${wide ? ' docs-shell--wide' : ''}`
        }
      >
        {!isLanding ? (
          <aside className="docs-sidebar" aria-label="Documentation">
            {sidebar.map((section) => (
              <section key={section.title} aria-labelledby={`nav-${section.title}`}>
                <h2 id={`nav-${section.title}`} className="docs-sidebar-title">
                  {section.title}
                </h2>
                <ul className="docs-nav">
                  {section.items.map((item) => {
                    const active = location === item.path;
                    return (
                      <li key={item.path}>
                        <a
                          href={item.path}
                          className={active ? 'is-active' : undefined}
                          aria-current={active ? 'page' : undefined}
                        >
                          {item.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </aside>
        ) : null}
        <main id="main">{children}</main>
      </div>
      <footer className="site-footer">
        <nav aria-label="Footer">
          <ul>
            {SITE_FOOTER_NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
            <li>
              <a href={SITE_GITHUB} rel="noopener noreferrer">
                GitHub
              </a>
            </li>
          </ul>
        </nav>
        <p>
          Made by{' '}
          <a href="https://mzworthington.co.uk" rel="noopener noreferrer">
            Matthew Z Worthington
          </a>
        </p>
      </footer>
    </div>
  );
}
