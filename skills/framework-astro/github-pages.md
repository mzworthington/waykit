# Astro on GitHub Pages

Official deploy notes: [Astro GitHub Pages guide](https://docs.astro.build/en/guides/deploy/github/).

## Config

```ts
export default defineConfig({
  site: 'https://example.com',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [react()]
});
```

- Custom domain: `site` is the canonical origin (this kit: `https://waykit.dev`).
- Project pages under `https://user.github.io/repo/` need `base: '/repo'`. Apex/custom domains use `base: '/'` (default).
- Prefer directory output (`/path/index.html`). GitHub Pages serves `/path/` and redirects `/path` there. `trailingSlash: 'ignore'` is fine: do not force a slash in the address bar.

## Artifact

The Pages artifact is **built HTML plus allowlisted public files**, not the git tree.

This kit: `pnpm --dir web build` writes `web/dist`, then `wk site assemble` copies that dist, overlays raw Markdown (`llms.txt`, `docs/`, `SOPs/`, …), and writes `CNAME` + `.nojekyll`.

`.nojekyll` is required so GitHub does not run Jekyll on `_astro/` asset folders.

## Workflow

Use `actions/upload-pages-artifact` + `actions/deploy-pages` (not `peaceiris/actions-gh-pages` unless the repo already standardizes on it).

Path-filter the workflow so kit-only commits do not redeploy. Keep `pnpm --dir web build` then assemble; do not upload `web/` source.

## 404

Add `src/pages/404.astro`. Astro emits `404.html` at the dist root, which GitHub Pages uses for unknown paths.

## DNS

Custom-domain A/AAAA and `www` CNAME are **not** Astro config. This kit’s DNS lives in [edge-dns](https://github.com/mzworthington/edge-dns).
