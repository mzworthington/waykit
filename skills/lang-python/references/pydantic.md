# Pydantic (load on demand)

Load when parsing HTTP, CLI, env, files, queues, or any untrusted `object`. Keep [SKILL.md](../SKILL.md) as the always-on profile. FastAPI wiring stays in [framework-fastapi](../../framework-fastapi/SKILL.md). Current v2 APIs via **context7**.

Pydantic is the **runtime contract at the edge**. It is not the domain kernel and not an ORM.

## Where it sits

```
untrusted input  →  Pydantic (adapter)  →  handler / domain
domain result     →  Pydantic (adapter)  →  HTTP / file / queue
```

| Layer | Type | Rule |
|-------|------|------|
| Inbound DTO | `BaseModel` / `TypeAdapter` | `extra="forbid"`; parse then call the handler |
| Env / secrets names | `pydantic-settings` `BaseSettings` | Names only in docs; no secret values in tests or skills |
| Domain values | frozen dataclass / `enum` | No `BaseModel` subclass, no FastAPI, no SQLAlchemy |
| Outbound DTO | separate `BaseModel` | Do not reuse the inbound or ORM class |

When the repo already uses frozen Pydantic models as values, match that — do not introduce a second model family in one slice.

Prefer Pydantic v2 over a hand parser when the project already depends on it. Use msgspec only if the repo already standardized on it.

## v2 mechanics

- Construct with `Model.model_validate(raw)` or `TypeAdapter(T).validate_python(raw)`. Do not use v1 `parse_obj` in new code.
- Dump with `model_dump()` / `model_dump_json()`. Prefer aliases only when the wire name differs from the domain name.
- `model_config = ConfigDict(frozen=True, extra="forbid")` on trust-boundary models. `extra="ignore"` only for vendor payloads you do not own.
- Field constraints (`Field(ge=0)`, `HttpUrl`, `AwareDatetime`) belong on the DTO. Policy ("this job may poll") stays in the handler.
- `field_validator` / `model_validator` normalize and reject shape. Do not hide use-case rules inside validators — those tests belong on the handler.
- `TypeAdapter` for `list[Item]`, unions, and `TypedDict` at the edge without inventing a wrapper model.

```python
from pydantic import BaseModel, ConfigDict, TypeAdapter

class PollRequest(BaseModel):
    model_config = ConfigDict(frozen=True, extra="forbid")
    repo: str
    limit: int = 20

def parse_jobs(raw: object) -> list[PollRequest]:
    return TypeAdapter(list[PollRequest]).validate_python(raw)
```

Map to domain after validate (`JobId(req.repo)`), or pass the DTO into the handler if the slice is thin and the model is already the command.

## Settings

`pydantic-settings` for process config: typed fields, env prefix, nested models. Load once in the composition root. Domain functions take the values they need (`timeout: timedelta`), not a global `Settings` import.

## Testing the contract

Pin parse failures as behavior: `pytest.raises(ValidationError)` for extra fields, wrong types, and boundary values. Happy-path `model_validate` then assert the handler result — do not re-test Pydantic's own coercions.

Gear 1 stays on the handler with a fake port. Gear 2 covers one adapter that calls `model_validate` on a realistic payload.

## Anti-patterns

| Refuse | Do instead |
|--------|------------|
| One `BaseModel` for request, ORM row, and response | Three types; map in the adapter |
| `dict[str, Any]` past the parser | `model_validate` / `TypeAdapter` |
| Business rules in validators | Handler + domain test |
| v1 `class Config:` / `parse_obj` | v2 `ConfigDict` / `model_validate` |
| `Settings` imported from domain | Inject the few values the use case needs |
| `extra="allow"` on your public API | `extra="forbid"` |
