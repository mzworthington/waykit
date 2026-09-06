# C++ Core Guidelines (kit map)

Canonical: [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines). This file is a **lookup**, not a reprint. Open the official rule when a review cites an id.

Load this file when the task is a C++ review, lifetime bug, or C-ism cleanup. Keep [SKILL.md](../SKILL.md) as the always-on profile.

## How to use in reviews

Cite the id (`R.11`, `I.11`) and state the kit action. Do not quote long guideline examples.

| Kit concern | First rules to apply |
|-------------|----------------------|
| Hexagonal leak (HAL in domain) | P.11, SF.1–SF.2, A (architectural ideas) |
| Lifetime / leaks | P.8, R.1, R.11, R.12, E.6 |
| Ownership in APIs | I.11, I.13, F.16, F.18, F.20, R.3, R.14 |
| Const / intent | P.1, P.3, Con.1–Con.5 |
| C-isms / macros | P.2, CPL.1, ES.31, SF.8 |
| Class design | C.2, C.9, C.20, C.21, C.35, C.67 |
| Errors | I.10, E.1, E.6, E.14, E.12 (`noexcept` only when true) |
| Concurrency | CP.1–CP.4; RAII locks (`lock_guard` / `scoped_lock`); no data races |
| Templates | T.1–T.10; concepts over SFINAE soup |
| Casts / C arrays | ES.48 (no C-style casts), SL.con.1–3 (containers), R.14 (`span`) |

## Profiles and GSL

The guidelines define **type / bounds / lifetime** profiles and the Guideline Support Library. Prefer the Standard Library when it already covers the need (`std::span`, `std::unique_ptr`, `std::optional`). Pull GSL (`gsl::not_null`, `Expects`) only if the repo already depends on it.

## Embedded / freestanding

Arduino, ESP-IDF, and similar SDKs are **adapters**. Domain still follows RAII and typed interfaces. When exceptions are off:

- Pick one error type at the firmware boundary and keep it out of hosted libraries.
- Prefer stack / static storage and `std::array` over heap in interrupt or deep-sleep paths.
- `constexpr` pin maps beat `#define` except where the vendor header forces macros.

## Tools (P.12)

- Compiler: `-Wall -Wextra -Wpedantic`; treat warnings as errors in CI when the project already does.
- `clang-tidy` `cppcoreguidelines-*` is the mechanical stand-in for many rules.
- Sanitizers on host tests: ASan/UBSan (and TSan when threads exist).

## Alexandrescu (take / leave)

Take, because they match kit clean code and the Core Guidelines:

- **Types first** - make illegal states unrepresentable (`variant`, `enum class`, `expected`).
- **`Expected<T,E>`** - error as a value when exceptions are the wrong tool (C++23 `std::expected`; see [andralex](https://github.com/andralex)).
- **ScopeGuard** - destructor-run cleanup and dismiss-on-success; today `std::scope_exit` or a tiny local RAII type, not a new framework ([ScopeGuard talk](https://nwcpp.org/september-2000.html), later [N4189](https://www.open-std.org/jtc1/sc22/wg21/docs/papers/2014/n4189.pdf)).
- **Algorithms** - state intent with `<algorithm>` / ranges before a custom loop.
- **Zero-overhead** - abstraction must compile down; virtual/heap stay at edges.
- **Move as a contract** - sink parameters (`T&&` / `unique_ptr`) when the callee takes ownership.

Leave, because kit §4 forbids speculative frameworks:

- Loki / *Modern C++ Design* policy hosts as a default architecture.
- Template metaprogramming that exists to look generic.
- D language constructs (`scope(exit)` as a macro DSL) unless the project already has them.

## What we take from generic "modern C++" skills

Keep: RAII, `make_unique`, `optional`/`variant`/`span`/`string_view`, `enum class`, `nullptr`, no C-style casts, composition over inheritance, sanitizers, GoogleTest/Catch2, CMake.

Drop or constrain:

- Mandatory `m_` / PascalCase / camelCase (follow the repo; Core Guidelines NL is secondary).
- Blanket Doxygen (kit §4: tests and names carry intent).
- Exceptions as the only error policy (firmware often has `-fno-exceptions`).
- Coroutines, modules, and `inline` as default performance advice (opt in when the repo already uses them; measure first).

## Non-rules

Ignore internet myths that contradict the guidelines (NR section): "C++ is too slow without C", "always write a destructor", "exceptions are too expensive to consider". Measure (P.9) instead of folklore.
