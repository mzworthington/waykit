# GitHub Actions defaults

Use with [SKILL.md](SKILL.md). Prefer one reusable workflow file; thin `on:` wrappers for `pull_request` and `push` to `main`.

## Job graph

| Job | When | Notes |
|-----|------|--------|
| **Verify** | PR + `main` | Same steps. Lint, typecheck, test, build. Write `$GITHUB_STEP_SUMMARY`. Upload JUnit / coverage / Playwright HTML. |
| **Merge gate** | PR + `main` | `needs: [verify, …]` and succeeds even when siblings are skipped, so required checks stay green. |
| **Plan** | PR + `main` when IaC paths change | Upload the **exact** plan/preview file as an artifact. Comment a short highlight on the PR. |
| **Apply** | `main` + environment approval | Download that artifact; apply it. Refuse if missing, stale, consumed, or state drifted. `concurrency: { group: iac-<env>, cancel-in-progress: false }`. |
| **Deploy** | `main` after verify, not changelog-only | Promote the canonical artifact. GitHub Environment `production` (and optional `staging`/`preprod`). |
| **Smoke** | after each deploy | Health + one path + live SHA. On failure, redeploy previous successful SHA, smoke again, fail the job. |
| **Promote** | `main` after verify | Release detect → optional GitHub Release → changelog → push `chore(changelog)` if needed. `permissions: contents: write` **only here**. |

PR preview deploy is a **separate opt-in job** (repo var, `workflow_dispatch`, or extra workflow). Default templates omit it. First-party `pull_request` from the same repo only.

## Permissions and OIDC

```yaml
permissions:
  contents: read
```

Raise per job: `id-token: write` for cloud OIDC, `pull-requests: write` for plan comments, `contents: write` only on Promote. Environment secrets live on GitHub Environments; PR jobs do not reference production secrets.

Pin third-party actions by **git SHA**, not a moving tag.

Registry installs of the package manager (for example `pnpm/setup` fetching `@pnpm/linux-x64` from npm) should retry once on 5xx/timeout. A 504 on that **binary download** is not a product failure. Do not retry `ERR_PNPM_NO_PKG_MANIFEST` as if it were a 504.

Nested workspaces (`package.json` under `app/`): pass `working-directory` to `pnpm/setup`. Job `defaults.run.working-directory` applies only to `run:` steps, not to `uses:`. Do not set deprecated `package-json-file` hoping it changes cwd — some action versions still run `pnpm install` at `GITHUB_WORKSPACE`, which fails when the manifest is nested. Classify with `wk debug-ci` before wrapping setup in sleep+retry.

Do not treat a green sibling workflow (CodeQL) as the verify graph.

## Skip re-entry

- Release detect: `docs` / `chore` / `ci` / `test` alone → no tag.
- Deploy `paths-ignore` (or equivalent): `CHANGELOG.md` and other note-only files.
- Changelog commit author: `github-actions[bot]`. Retry push once if `main` advanced; never `--force`.

## Site identity

Emit SHA at a well-known URL (`/version.json` or equivalent) from the **same artifact** that was deployed. Smoke compares that value to the GitHub SHA (or build id) of the job. Treat CDN cache as part of the check (cache-bust or `Cache-Control` on the version document).

## Rollback

Store the last **successful** deployment identity (Pages/Workers deployment id, object key, or git SHA) on the environment or as an artifact. Smoke failure restores **that** identity, not `main~1` (which may be the failing commit). Do not `pulumi destroy` or apply a new IaC plan from a smoke failure.

## Reports

```bash
{
  echo "## Deploy"
  echo "- env: production"
  echo "- sha: \`$GITHUB_SHA\`"
  echo "- url: $DEPLOY_URL"
} >> "$GITHUB_STEP_SUMMARY"
```

Link uploaded artifacts from the same summary. Do not duplicate the test log as a PR comment.
