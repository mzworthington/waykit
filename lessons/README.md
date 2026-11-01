# Waykit lessons (local, per project)

This directory captures **learnings from real sessions** so the kit can improve over time. Entries stay local and gitignored until you promote them into the shared repository during [kit review](../tasks/kit-review.md).

## Layout

```text
lessons/
└── <project>/              # e.g. blueprint, my-app (match handover/<project>/)
    └── YYYY-MM-DD.md       # one file per day; append multiple entries
```

Use the project directory name, or the `project` field in `system/config.json` when set.

## When to write a lesson

Append an entry when any of these happen:

- The user corrects your approach or output
- You had to ask because requirements were ambiguous
- A rule was missing, outdated, or contradictory
- A pattern worked well and should be reused
- The same mistake or friction appears more than once
- Test-case impact was skipped, or catalog cases were rewritten without alignment
- An XFN matrix was omitted, or qualities were skipped without rationale
- Load SLOs existed in XFN but never reached telemetry
- An **agent/tool/prompt** miss in session (wrong tool, bad args, schema drift) - also capture an EDD case ([templates/lesson.md](../templates/lesson.md) **EDD case** field; [SOPs/hypothesis-driven-debug.md](../SOPs/hypothesis-driven-debug.md) §11)

Skip logging for routine, one-off typos with no broader lesson.

## Entry format

Copy [templates/lesson.md](../templates/lesson.md) or append entries using the same structure. One file per day per project (`YYYY-MM-DD.md`); multiple lessons can live in the same file.

Set **Promote to** to a philosophy/SOP/skill path and/or an `evals/edd/*.jsonl` suite. For agent-routing misses, **EDD case** must not stay `none` once the case is written.

## Promotion flow

1. Agent logs lesson with `Status: pending` (and EDD case path when applicable)
2. You run [tasks/kit-review.md](../tasks/kit-review.md) (weekly or on demand)
3. Approved lessons update the shared kit (rules **and/or** eval JSONL); mark `promoted` or `rejected` in the local file
4. Project-only quirks go in the **app repo** (`.cursor/skills/` / app `evals/`), not here

Do not auto-commit kit changes from lesson capture. Human review keeps the shared kit stable.
