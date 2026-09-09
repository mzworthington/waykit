---
title: External skills - install and keep up to date
kind: sop
triggers:
  - external skills
  - gh skill
  - Cloudflare skills
  - Vercel react-best-practices
  - official skills
tools:
  - shell
---
# Standard Operating Procedure: External skills

Use this for **official / third-party** Agent Skills (Cloudflare, Vercel, etc.). Do **not** copy those skills into the kit’s committed `skills/` tree.

## Ownership split

| Kind | Location | Update path |
|------|----------|-------------|
| Kit lifecycle / stack skills | `skills/agent-*`, `lang-*`, `framework-*` | PRs in this repo |
| Official upstream skills | Cursor user scope via `gh skill` | `wk sync` |

Declared list: [skills/external.lock.json](../skills/external.lock.json).

## Prerequisites

- GitHub CLI **v2.90+** with `gh skill` (`gh skill --help`)
- Authenticated `gh` (`gh auth status`)

## Install / refresh

```bash
# Install everything in the lockfile (Cursor --scope user)
wk sync --install

# Preview commands
wk sync --dry-run

# Pull upstream changes for lockfile skills in ~/.cursor/skills only
wk sync --update
```

`--update` refreshes lockfile skill names with `--dir ~/.cursor/skills`. It does **not** run `gh skill update --all`, which scans every agent host and the kit tree and warns on copies that were never installed via `gh skill`.

Optional from bootstrap:

```bash
INSTALL_EXTERNAL_SKILLS=1 ./install.sh
```

## Add a skill to the lockfile

1. Find the upstream: `gh skill search <term>` or the vendor repo (e.g. `cloudflare/skills`, `vercel-labs/agent-skills`).
2. Preview: `gh skill preview OWNER/REPO skills/<name>`.
3. Append an entry to `skills/external.lock.json`:

```json
{
  "id": "short-name",
  "repository": "owner/repo",
  "skill": "skills/short-name",
  "summary": "One line.",
  "pin": "latest"
}
```

Prefer a published version tag (`"pin": "v1.2.0"`). Use `"pin": "latest"` when the repo has no semver tags - `gh skill` then installs the latest GitHub release, else default-branch HEAD. Do not pin commit SHAs unless you are freezing a specific commit. Version tags are passed as `refs/tags/…` so they are not mistaken for SHAs. Tag pins are skipped by `gh skill update` until you change or drop them.

4. Run `wk sync --install --force`.

Prefer the exact path form (`skills/<name>`) so installs skip full-repo discovery.

5. Run `wk verify` to confirm no upstream dirs remain under kit `skills/`.

## Why not vendor into `skills/`?

This kit is symlinked to `~/.agents`. Vendoring upstream skills into `skills/` freezes them in git and mixes ownership with lifecycle roles. `gh skill` writes provenance into frontmatter so upgrades detect real content changes.

## Current defaults

- **Cloudflare:** `cloudflare`, `wrangler`, `workers-best-practices`, `durable-objects`, `agents-sdk` from `cloudflare/skills`
- **Vercel:** `react-best-practices` from `vercel-labs/agent-skills`
