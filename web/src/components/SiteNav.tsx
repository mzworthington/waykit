import { useState } from 'react';
import { isDocsNavActive, SITE_NAV } from '../docs/nav';

const GITHUB = 'https://github.com/mzworthington/waykit';

type Props = {
  pathname: string;
};

export function SiteNav({ pathname }: Props) {
  const location = pathname.replace(/\/$/, '') || '/';
  const [open, setOpen] = useState(false);

  return (
    <>
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
      <a href={GITHUB} className="btn-github" rel="noopener noreferrer">
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
    </>
  );
}
