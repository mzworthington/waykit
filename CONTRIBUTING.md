# Contributing

Thanks for helping improve Waykit. This repo is the `.agents` kit: skills, SOPs, learning loops (including the EDD harness), and the `wk` CLI.

## Prerequisites

* Node.js **22+**
* [pnpm](https://pnpm.io/) 9+
* `git`

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm wk check
```

If this clone has lint wired: `pnpm lint`.

## Workflow

1. Work on **main**. Do not create a feature branch.
2. Leave changes **uncommitted** unless asked to commit. Output a conventional commit subject (include the Linear id when playing a ticket).
3. Prefer the smallest change that matches [CODING_PHILOSOPHY.md](./CODING_PHILOSOPHY.md) (and its **Applicability & opt-out** section). Names and tests document intent; skip comments that restate the code.
4. For prompt / MCP schema / agent-routing changes, follow **EDD (alpha)**: add or extend evals first, then implement ([docs/edd.md](./docs/edd.md)).

## Commit and PR titles

Use [Conventional Commits](./SOPs/conventional-commits.md) for the **output** commit subject. Stay on main, uncommitted unless asked. Include the Linear id when playing a ticket.

Examples: `feat(skills): …`, `fix(cli): …`, `docs: …`, `ci: …`.

Husky `.husky/commit-msg` (and `wk commit-msg`) reject a non-conventional **commit subject**. CI on pull requests also checks the **PR title**. `wk doctor` reports missing community files on GitHub sources you admin. `wk align` reports consumer handshake drift (host pointers, kit MCP, commit-msg). Product repos can fail PRs on that report via `.github/workflows/align-consumer.yml`.

## Checks we expect green

| Check | Command / location |
|-------|--------------------|
| Typecheck | `pnpm typecheck` |
| Unit tests | `pnpm test` / `pnpm test:ci` |
| Kit gate | `pnpm wk check` (audit, layout, EDD routing thresholds, context budget) |
| Pre-commit | Husky: audit, validate, verify (skill layout + role line budget), **measure-context**, ontology, typecheck, mermaid |
| Commit message | Husky `commit-msg` → `wk commit-msg`; PR title checked in Verify |

## Docs and ADRs

* Narrative docs: prefer clear, human voice ([agent-docs](./skills/agent-docs/SKILL.md) / [agent-copy](./skills/agent-copy/SKILL.md) when rewriting README/site copy).
* Diagrams in docs/ADRs: **Mermaid only** (no ASCII architecture diagrams). TTY CLI chrome may use box-drawing.
* Hard-to-reverse kit decisions: sparse ADRs under [docs/ADRs/](./docs/ADRs/README.md).

## Security

See [SECURITY.md](./SECURITY.md) for vulnerability reporting. Do not commit secrets, tokens, or real customer data into skills, evals, or fixtures.

## License

Contributions are accepted under the same [Unlicense](./LICENSE) terms as the rest of the kit.
