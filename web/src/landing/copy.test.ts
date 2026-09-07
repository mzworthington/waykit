import { describe, expect, it } from 'vitest';
import {
  HOME_BADGES,
  HOME_BRAND,
  HOME_CLI_HEADING,
  HOME_EYEBROW,
  HOME_HEADLINE,
  HOME_NEXT,
  HOME_USED_IN
} from './copy';

describe('homepage copy', () => {
  it('puts the kit name first, then the job line', () => {
    expect(HOME_EYEBROW).toMatch(/lifecycle/i);
    expect(HOME_BRAND).toBe('Waykit');
    expect(HOME_CLI_HEADING).toBe('The wk CLI');
    expect(HOME_HEADLINE).toMatch(/grill/i);
    expect(HOME_NEXT).toHaveLength(4);
    expect(HOME_NEXT[0]?.body).toMatch(/debug vs feature/i);
    expect(HOME_NEXT[1]?.href).toBe('/docs/lifecycle');
    expect(HOME_NEXT[2]?.href).toBe('/docs/kit');
    expect(HOME_NEXT[2]?.body).toMatch(/wk /i);
    expect(HOME_NEXT[3]?.href).toBe('/docs/map');
    expect(HOME_NEXT[3]?.body).toMatch(/live graph/i);
    expect(HOME_USED_IN).toHaveLength(4);
    expect(HOME_USED_IN.map((repo) => repo.href)).toEqual([
      'https://github.com/mzworthington/blueprint',
      'https://github.com/mzworthington/steerco',
      'https://github.com/mzworthington/react-cloudflare-template',
      'https://github.com/mzworthington/gpio-build-monitor'
    ]);
  });

  it('mirrors the README status strip plus a live GitHub release badge', () => {
    const alts = HOME_BADGES.map((badge) => badge.alt);
    expect(alts).toEqual([
      'CI passing',
      'Feature lifecycle',
      'Docs at waykit.dev',
      'Unlicense',
      'Latest GitHub release'
    ]);
    expect(HOME_BADGES[4]?.src).toContain('github/v/release/mzworthington/waykit');
  });
});
