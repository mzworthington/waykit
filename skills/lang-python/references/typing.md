# Typing (load on demand)

Load when adding signatures, Protocols, generics, or fighting `mypy`/`pyright`. Keep [SKILL.md](../SKILL.md) as the always-on profile.

## Baseline

- Annotate every public function: parameters and return. A procedure returns `None` explicitly.
- Annotate public attributes and dataclass fields. Locals stay inferred unless inference is wrong or the name is a wide `dict`/`object`.
- Prefer the checker already in the repo (`mypy --strict`, Pyright/Pylance strict, or `ty` if that is the gate). Do not add a second checker.
- Python **3.11+** spelling: `list[str]`, `dict[str, int]`, `str | None`. Do not import `List`, `Dict`, `Optional`, `Union` for new code.

## Ports and narrowing

- Driven ports are `typing.Protocol` (structural). Test doubles need no subclass of a production adapter.
- `ABC` only when you must register implementations or share a tiny template method. Do not grow an inheritance tree for one adapter.
- Illegal states: `enum.StrEnum` / `Literal` / `TypedDict` (closed shapes) over `str` flags and `dict[str, Any]`.
- Generics keep input/output relationships (`TypeVar` / `TypeVarTuple`). Collapsing to `object` or `Any` is not a generic.
- Prefer `Self` for fluent/`copy` returns. Prefer `type` aliases (3.12+) when the repo is 3.12+; otherwise `TypeAlias`.

## Boundary data

JSON, env, CLI, ORM rows, and HTTP bodies are `object` (or a raw `bytes`/`str`) until a parser produces a domain type. Pydantic v2 (`model_validate`, `TypeAdapter`) lives in the adapter — [pydantic.md](pydantic.md). Domain code never sees `Any`.

Prefer `object` over `Any`: `object` forces a narrow; `Any` turns the checker off and spreads.

```python
def parse_status(raw: object) -> Status:
    if not isinstance(raw, str):
        raise ValueError("status must be a string")
    return Status(raw)
```

## Suppressions

No bare `# type: ignore` or `# noqa`. Pin the code and the reason on the same line:

```python
payload = vendor.fetch()  # type: ignore[no-any-return]  # stub is Any; parse_status below
```

`cast` is last resort. Prefer a guard, a parser, or a typed adapter.

## When you are done

Signatures and public fields are annotated. The repo typecheck is green. No unexplained ignore. No `Any` past the adapter.
