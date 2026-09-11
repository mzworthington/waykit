# Testing (load on demand)

Load when writing or changing pytest. TDD loop ownership stays with [agent-tdd](../../agent-tdd/SKILL.md) and [SOPs/tdd-guard.md](../../../SOPs/tdd-guard.md). This file is Python mechanics.

## Cycle

One failing test, run it, confirm it failed for the assertion you meant (not `ImportError` / `NameError`), then the smallest production change. Do not batch production.

A bug fix starts with a test that reproduces the bug.

## What to pin

Observable behavior through the public type or handler: inputs, outputs, raised exceptions, port calls you care about. Do not assert on private helpers or incidental mock call counts.

Cover: happy path, empty/one/limit, and the error type the caller must see. Untested branches are unproven.

Name the behavior, not the function: `test_stale_job_is_skipped_when_poll_is_fresh`, not `test_poll_2`.

No branches or loops inside a test. Tables go through `@pytest.mark.parametrize`. Each case reports as its own failure.

```python
@pytest.mark.parametrize(
    ("status", "expected"),
    [
        ("queued", Lamp.AMBER),
        ("failed", Lamp.RED),
        ("success", Lamp.GREEN),
    ],
)
def test_maps_ci_status_to_lamp(status: str, expected: Lamp) -> None:
    assert lamp_for(CiStatus(status)) is expected
```

## Doubles

Prefer an in-memory fake that implements the `Protocol` over `unittest.mock.MagicMock` / `AsyncMock`. Mocks couple tests to call shape and go green while the adapter is wrong.

Inject time, clocks, and RNG. Do not call `datetime.now()` or `uuid.uuid4()` inside domain code you need to test.

Gear 1: fake ports. Gear 2: one integration test per new adapter (temp dir, `httpx` ASGI, or a recorded transport). Do not hit live GitHub/Cloudflare from a unit test.

## Async and properties

- `pytest-asyncio` (or the repo's plugin) for async tests. Mark only the tests that need a loop.
- Hypothesis when the input space is wide (parsers, codecs, round-trips). Assert an invariant, not a pile of examples. Keep it out of the default suite if it is slow — mark it.

Coverage reports find untested code. They are not a merge target. Weak assertions at 100% prove nothing.

## Layout

Co-locate slice tests with the capability when the package already does (`features/<slice>/` or `test/monitor/service/`). Mirror the package path. `conftest.py` stays local; do not grow a global fixture dump.

`src/` layout is fine when the repo already uses it. Do not reshuffle packages to match a blog.

## When you are done

New behavior has a test. The suite is deterministic and green. Time, network, and filesystem seams are injected or marked as integration.
