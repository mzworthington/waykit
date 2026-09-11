---
name: lang-python
description: >-
  Enforces typed Python 3.11+, hexagonal Protocol ports, ruff-formatted
  readable modules, pytest/parametrize, pathlib, and Pydantic at boundaries.
  Use when writing or reviewing Python, pytest, ruff, mypy/pyright, uv/Poetry,
  or FastAPI/Django backends.
kind: profile
phase: stack
triggers:
  - python
  - pytest
  - pydantic
  - poetry
  - uv
  - mypy
  - pyright
  - ruff
  - type hints
  - pathlib
  - protocol
depends-on: []
mcp:
  - context7
tools:
  - read
  - write
  - shell
disable-model-invocation: false
---
# Python Coding Philosophy

Apply when writing Python. Kit hexagonal / clean-code rules win on structure ([CODING_PHILOSOPHY.md](../../CODING_PHILOSOPHY.md) §4). HTTP/ASGI delivery lives in [framework-fastapi](../framework-fastapi/SKILL.md). Load a `references/` file only when the table says so. Distilled from PEP 8/20, typing PEPs, and public Python agent skills — kit wins on docstrings and coverage theater ([references/sources.md](references/sources.md)).

## Navigate

| Need | Load |
|------|------|
| Always | This file |
| Types, `Any`, Protocol, ignores | [references/typing.md](references/typing.md) |
| Names, size, pathlib, dataclasses | [references/style.md](references/style.md) |
| Pydantic v2 DTOs, `TypeAdapter`, settings | [references/pydantic.md](references/pydantic.md) |
| pytest, fakes, parametrize, TDD | [references/testing.md](references/testing.md) + [agent-tdd](../agent-tdd/SKILL.md) |
| FastAPI routes / `Depends` | [framework-fastapi](../framework-fastapi/SKILL.md) |
| Current stdlib / ruff / pytest / Pydantic API | **context7** |

## Architecture

- **Ports** - Driven ports are `Protocol` (structural). Handlers take ports as arguments. Composition root binds adapters. `ABC` only when you must register types.
- **Domain purity** - Aggregates and value objects in `domain/` / `core/` (or the repo's equivalent) with no SQLAlchemy, Django ORM, FastAPI, or HTTP client imports. Frozen dataclasses / `enum` for values. Pydantic is the edge, not the kernel ([references/pydantic.md](references/pydantic.md)).
- **Vertical slices** - Co-locate handler, boundary models, and tests under `features/<capability>/` when greenfield. Match an existing package map (`monitor/service/` is fine). Do not invent a parallel tree.
- **Pydantic at the edge** - v2 `BaseModel` / `TypeAdapter` parse untrusted input (`model_validate`) before the handler. Separate inbound, outbound, and persistence types. `ConfigDict(frozen=True, extra="forbid")` on APIs you own. `pydantic-settings` in the composition root only. Field constraints on the DTO; use-case policy in the handler.
- **Invalid states** - `StrEnum` / `Literal` / closed dataclasses over boolean flags and stringly APIs.

## Language (always on)

- **3.11+** - Built-in generics, `X | None`, `Self`, `tomllib`, `asyncio.TaskGroup`. No `typing.List` / `Optional` in new code.
- **Readable shape** - One job per function; guard clauses; early return. Max three parameters; then a dataclass. Intention-revealing names; no `manager` / `helper` / `util` without a role.
- **Idioms** - `pathlib.Path`; `with` for resources; no mutable default arguments; iterate items, not indices; stdlib before a new helper.
- **Errors** - Catch what you can handle. Never a bare `except:` or `except Exception: pass`. Translate with `raise DomainError(...) from err` in adapters.
- **Async** - `async` only for I/O. Hold a reference to every `create_task`. Prefer `TaskGroup` over fire-and-forget `gather`. Domain stays sync when it is CPU/policy.
- **No narrative comments** - Names and tests document why. Do not add docstrings that restate the signature.

## Tooling

Prefer tools already in the repo. Greenfield / when missing:

| Gate | Default |
|------|---------|
| Env / lock | `uv` (`poetry` / `pip` only if the repo already uses them) |
| Lint + format | `ruff check` and `ruff format` (replaces Black/isort/flake8) |
| Types | `mypy --strict` or Pyright strict; no bare `# type: ignore` |
| Config | `pyproject.toml` (PEP 621) as the one file |

Leave the toolchain green before calling the task done. Fetch current CLI flags via **context7**.

## Testing defaults

Prefer project-existing tools; otherwise these defaults for [agent-tdd](../agent-tdd/SKILL.md) / [agent-xfn](../agent-xfn/SKILL.md). Mechanics: [references/testing.md](references/testing.md).

| Layer | Default |
|-------|---------|
| Unit / slice | pytest; `@pytest.mark.parametrize` for tables; Protocol fakes over `MagicMock` |
| Async | pytest-asyncio only on tests that need a loop |
| Browser E2E | Playwright |
| Accessibility | axe on UI when present; otherwise skip with rationale |
| Security regression | pytest abuse/authz cases; Semgrep/ZAP if CI already has them |
| Load / performance | k6 (or locust if already standardized) |

## Anti-patterns

| Refuse | Do instead |
|--------|------------|
| Implementation before a failing test | Red → green → next case |
| ORM / FastAPI types in domain | Protocol + parser at the adapter |
| One `BaseModel` for request, row, and response | Inbound DTO → handler → outbound DTO |
| `Any`, bare `# type: ignore` | Parser + pinned ignore with a reason |
| Mutable default (`def f(xs=[])`) | `None` + build inside |
| `os.path` joins, `print` debugging | `pathlib`, logging in adapters |
| Wall of `MagicMock` | In-memory fake of the Protocol |
| Docstrings that paraphrase the name | Rename; pin *why* in a test |
| Coverage % as the goal | Behavior catalog cases |
