# Used on our own product repos

Waykit is the agent lifecycle we run on first-party apps, not a pack that only exists in this kit. First-party checkouts pass `wk align`: thin `AGENTS.md`, host rule pointers, kit `default` MCP, conventional `commit-msg`.

Open the repo, read `AGENTS.md`, then:

```bash
wk align .
```

Cloudflare stays on a named profile. For live Worker or Pages work: `wk mcp cloudflare-ops --project`, then `wk mcp restore --project`.

| Product | GitHub | What to look at |
|---------|--------|-----------------|
| ArchLens | [mzworthington/archlens](https://github.com/mzworthington/archlens) | Hexagonal `@archlens/core`, TDD for parsers, sparse ADRs. Origin matches the clone folder. |
| RoMini | [mzworthington/RoMini](https://github.com/mzworthington/RoMini) | Screen-free NFC audio player on a Pi. Parent dashboard maps tags. Hexagon, TDD, local bedtime-script skill. |
| steerco | [mzworthington/steerco](https://github.com/mzworthington/steerco) | In-app docs, Cloudflare Pages, handovers under `steerco/`. |
| React Cloudflare template | [mzworthington/react-cloudflare-template](https://github.com/mzworthington/react-cloudflare-template) | The handshake `wk init` writes, so clones start aligned. |
| GPIO build monitor | [mzworthington/gpio-build-monitor](https://github.com/mzworthington/gpio-build-monitor) | Python on the Pi, Pulumi + Worker for the public UI. Commit-msg lives in `.githooks/`. |
| Personal site | [mzworthington/mzworthington](https://github.com/mzworthington/mzworthington) | Jekyll + `infra/cloudflare`. Commit-msg lives in `.githooks/`. |
| edge-dns | [mzworthington/edge-dns](https://github.com/mzworthington/edge-dns) | Zones, GitHub Pages origin DNS, shared Cloudflare CI. |

These are maintainer repos, not a customer logo wall. If a handshake drifts, `wk align` fails the same way `wk doctor` fails missing community files. First-party product PRs that wire the reusable [align-consumer](./align.md#consumer-ci) workflow fail that check on the pull request.

Fleet `--owned --scan` matches GitHub `nameWithOwner` to `origin`. Align a clone path directly when you already have it: `wk align ~/Documents/dev/archlens`.

Related: [Consumer align](./align.md), [Repo doctor](./doctor.md), [Hosts](./hosts.md).
