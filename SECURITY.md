# Security Policy

## Supported versions

This repository is distributed primarily as a **git checkout** (`install.sh` / `wk _REF`). Security fixes land on `main` and on the latest `vX.Y.Z` GitHub Release when release automation is enabled.

| Track | Supported |
|-------|-----------|
| `main` | Yes |
| Latest `v*` release | Yes |
| Older tags | Best effort only |

## Reporting a vulnerability

**Do not open a public GitHub issue for security reports that include exploit details or secrets.**

Email the maintainer at the address on the [GitHub profile for @mzworthington](https://github.com/mzworthington) (or use GitHub **Private vulnerability reporting** on this repo when enabled) with:

* A short description of the issue and impact
* Steps to reproduce or a proof of concept
* Affected commit / tag / install method (`main`, `wk _REF=…`, curl installer, etc.)

You should receive an acknowledgement within **7 days**. We aim to publish a fix or mitigation guidance within **30 days** for confirmed issues in supported tracks, sooner for supply-chain or secret-exposure class bugs.

## Scope

In scope examples:

* `install.sh` / bootstrap supply-chain issues
* Secrets or high-entropy tokens leaking via skills, evals, or `wk audit` false negatives that hide real secrets
* Prompt-injection gadgets in shipped skills/SOPs that cause destructive tool use by default
* Vulnerabilities in the TypeScript `wk` CLI or first-party MCP servers under `mcps/servers/`

Out of scope examples:

* Issues only in third-party skills pulled via `wk sync` (report upstream; we can pin/remove)
* Social-engineering of individual agent sessions without a kit defect
* Theoretical LLM jailbreaks with no kit-specific amplification

## Hardening tips for consumers

* Pin installs with `wk _REF=vX.Y.Z` once releases exist
* Run `wk audit` / `wk check` in CI on consuming repos
* Keep MCP profiles lean ([mcps/README.md](./mcps/README.md)); do not stack unrelated servers
