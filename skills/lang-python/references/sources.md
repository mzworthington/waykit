# Sources (Python profile)

This profile restates kit architecture plus a useful subset of public Python practice. Load this file only when citing a source or deciding whether to paste external text.

Canonical texts stay at their URLs. Do not vendor copies into the kit.

| Source | Use | Do not |
|--------|-----|--------|
| [PEP 8](https://peps.python.org/pep-0008/) | Naming and layout intent | Hand-format; `ruff format` owns whitespace |
| [PEP 20](https://peps.python.org/pep-0020/) | Readability, explicitness, one obvious way | Quote the Zen in reviews |
| [PEP 484](https://peps.python.org/pep-0484/) / [526](https://peps.python.org/pep-0526/) / [544](https://peps.python.org/pep-0544/) / [604](https://peps.python.org/pep-0604/) / [695](https://peps.python.org/pep-0695/) | Typing idioms | Invent a second type language |
| [pytest docs](https://docs.pytest.org/) | Fixtures, parametrize, marks | Coverage % as a goal |
| [Ruff](https://docs.astral.sh/ruff/) | Lint + format | Parallel Black/isort/flake8 unless the repo already has them |
| [Pydantic v2](https://docs.pydantic.dev/) | Edge DTOs, `TypeAdapter`, settings | ORM mix-ins; business rules inside validators |
| [proven-python](https://github.com/shanwije/proven-python) | TDD order, small functions, typed signatures, refuse swallow/`Any` | PEP 257-on-everything; coverage theater; paste their files |
| [cortex python skill](https://github.com/alexander-danilenko/cortex-ai-skills/blob/main/skills/python/SKILL.md) | Built-in generics, Protocol, pathlib, TaskGroup, no mutable defaults | Google-style docstring mandate |

Kit wins when those skills conflict:

- No docstrings that restate a name or signature ([CODING_PHILOSOPHY.md](../../../CODING_PHILOSOPHY.md) §4).
- Tests are the behavior catalog, not a coverage target.
- Hexagonal ports, domain purity, and vertical slices beat a `src/` layout lecture when the repo already has a package map.
