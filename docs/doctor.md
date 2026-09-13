# Repo doctor

`wk doctor` checks **community files** on GitHub repos you admin. It does not walk every clone on disk, and it does not overwrite README or LICENSE.

`wk init` still owns the agent handshake (AGENTS.md, IDE stubs, MCP, hooks). Doctor owns README, license, contributing, security, and GitHub templates.

## Ownership gate

A checkout is in scope only when `gh` says:

- origin is a **source** (not a fork)
- it is not archived
- `viewerPermission` is `ADMIN` or `MAINTAIN`

Forks, clones you cannot admin, and `github-unavailable` never get `--write`. `wk init --hook` still works offline; it skips hooks when GitHub says the checkout is a fork.

## Commands

```bash
wk doctor                     # this checkout, report only
wk doctor --owned             # gh: your sources (not forks)
wk doctor --owned --scan ~/Documents/dev
wk doctor . --write           # fill missing files; never overwrite
wk doctor . --write --hook    # also install git hooks, owned repos only
wk doctor --class product     # skip auto class (kit | product | dns | site | template)
wk doctor . --json            # machine-readable findings on stdout (exit 1 still means fail)
```

`--owned` needs the GitHub CLI (`gh`). Pass `--login` if you do not want `gh api user`. Uncloned sources are checked remotely and are never written; pass `--scan` so local worktrees can receive `--write`.

On product, DNS, site, and template reports, doctor also prints that handshake quality is `wk align .`. Doctor still only checks community files.

Default license for **kit** class is Unlicense. Other classes get an MIT stub. Existing LICENSE files stay put. Set `WK_COPYRIGHT_HOLDER` when `--write` creates MIT.

## What it looks for

Shared: `README.md`, `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `AGENTS.md`, PR template, issue templates, Dependabot, CodeQL workflow.

Kit class also requires `.github/CODEOWNERS`.

Templates live under `templates/community/` in the Waykit checkout. Product copy still needs an `agent-docs` pass after a stub README.

## Related

- Handshake: `wk init . --mcp default --hook`
- Consumer handshake after init: [Consumer align](./align.md) (`wk align .`)
- Kit merge bar: `wk check` (audit, evals, ontology, context budget). Doctor is not part of that gate.
- Conventional commits: [SOP](/SOPs/conventional-commits)
