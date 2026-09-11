# Style and readability (load on demand)

Load when names, function size, control flow, or stdlib choice is the job. Keep [SKILL.md](../SKILL.md) as the always-on profile.

## Formatter owns the mechanical bits

`ruff format` and `ruff check` settle quotes, imports, and line length. Do not bikeshed PEP 8 by hand. A diff should show behavior, not whitespace.

Match the repo: snake_case modules and functions, PascalCase types. Do not invent `m_` / Hungarian prefixes.

## Names

- Domain vocabulary: `BuildJob`, not `DataManager`. No `data`, `info`, `manager`, `helper`, `util` without a precise role ([CODING_PHILOSOPHY.md](../../../CODING_PHILOSOPHY.md) §4).
- Functions are verbs (`aggregate_statuses`); values are nouns; booleans read as questions (`is_stale`, `has_token`).
- A name that needs a comment is the wrong name. Rename, then delete the comment.
- Length tracks scope: `i` in a 3-line loop is fine; a module-level constant is not `n`.

## Size and shape

One job per function, one level of abstraction. If the name needs "and", split. Maximum three parameters; beyond that a dataclass or named tuple.

Keep nesting shallow. Guard clauses first; happy path last and left-aligned.

```python
def next_poll_at(job: Job, now: datetime) -> datetime:
    if job.is_terminal:
        raise TerminalJobError(job.id)
    if job.next_at is not None:
        return job.next_at
    return now + job.interval
```

Prefer iterating items (`for row in rows`), `enumerate` when the index matters, `zip(..., strict=True)` for parallel sequences. Comprehensions for a simple map/filter; a loop when the body has branches.

## Idioms that prevent bugs

- **No mutable defaults.** `def f(items: list[str] | None = None)` then `items = list(items or ())` inside — never `def f(items=[])`.
- **`pathlib.Path`** over `os.path` string joins.
- **`with`** for files, sockets, locks, sessions. No manual `close` on the happy path.
- **Dataclasses** (`slots=True`, `frozen=True` for values) for records. Hand-written `__init__` is where fields drift.
- **Pydantic** at the infrastructure boundary ([pydantic.md](pydantic.md)); frozen dataclasses for domain records.
- Standard library first: `collections.abc`, `itertools`, `contextlib`, `dataclasses`, `enum`, `functools.cached_property` when it is a real cache.
- `match` / `case` for closed sums (enums, tagged tuples). Do not use it as a prettier `if` chain on booleans.

## Errors and side effects

- Catch the exception you can handle. Never `except:` (swallows `KeyboardInterrupt` / `SystemExit`). Never `except Exception: pass`.
- Translate at the adapter: `raise DomainError(...) from err`.
- No import-time I/O, network, or env reads in library modules. Composition root / `main` / FastAPI lifespan owns that.
- No `print` / `breakpoint` left behind. Logging stays in adapters with structured fields, not interpolated secrets.

## Comments and docstrings

Names and tests carry *why*. Do not add comments or docstrings that restate the signature. Keep a one-line comment only for a compiler, runtime, or vendor constraint names cannot express.

## When you are done

`ruff format` and `ruff check` are green (or the repo's equivalent). Functions are small, names read at the call site, nothing dead remains.
