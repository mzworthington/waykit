---
name: profile-prose-lint
description: >-
  Adds Vale prose linting for Markdown: Google style, condescension,
  hyperbole, and directness rules, a versioned pre-commit hook, and a
  pull-request check. Use when setting up Vale, prose lint, tone lint, docs
  quality gates, or style rules for documentation.
kind: profile
phase: stack
triggers:
  - vale
  - prose lint
  - docs lint
  - style guide
  - filler words
  - tone lint
  - condescension
  - hyperbole
  - documentation quality gate
depends-on:
  - profile-docs
  - profile-pipeline
  - agent-pre-commit
tools:
  - read
  - write
disable-model-invocation: false
---

# Prose lint profile

Install Vale so documentation style fails in git, not in review comments weeks later. Pair with [profile-docs](../profile-docs/SKILL.md) for structure. Copy the files in [references/](references/) and adapt names. Do not hard-code a product.

## Layout

| File | Role |
| --- | --- |
| `.vale.ini` | Styles, packages, which globs use which styles |
| `.github/styles/Custom/` | Project existence rules (committed) |
| `.github/styles/config/vocabularies/<Project>/accept.txt` | Product names and domain terms (committed) |
| `.github/styles/<Package>/` | Downloaded by `vale sync` (gitignored) |

## Rules

1. Start from [references/vale.ini](references/vale.ini), [Condescending.yml](references/Condescending.yml), [Hyperbole.yml](references/Hyperbole.yml), and [Directness.yml](references/Directness.yml).
2. Add a vocabulary for product names, identifiers, and domain terms before turning on Google spelling.
3. Run `vale sync` after install. Commit custom styles. Do not commit downloaded packages.
4. Put the hook in the repo's versioned hook path (`.husky/pre-commit` or `.githooks/`). Do not write `.git/hooks`: that copy is local and disappears on clone. Snippet: [references/pre-commit.sh](references/pre-commit.sh).
5. If Vale is not on `PATH`, the local hook warns and continues. CI must still fail. Pin Vale in the project toolchain when one exists.
6. Scope `Google` and `Custom` to the Diátaxis trees when the existing corpus would fail the gate. Widen to `*.md` after that corpus is clean. Exclude generated reports and archives.
7. Pull-request workflow: [references/lint-docs.yml](references/lint-docs.yml). Match the repo's checkout action major version. `fail_on_error` is on. The job needs `pull-requests: write` for review comments.
8. `MinAlertLevel = suggestion` means suggestions fail the scoped paths. Do not lower it to hide a dirty tree; narrow the glob instead.

## Check

```bash
vale sync
vale docs/tutorials docs/how-to docs/reference docs/explanation
```
