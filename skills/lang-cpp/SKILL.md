---
name: lang-cpp
description: >-
  Enforces modern ISO C++ (C++20 default), hexagonal ports-and-adapters,
  RAII ownership, const-correct APIs, and C++ Core Guidelines safety rules.
  Use when writing or reviewing C++, .cpp/.hpp/.h/.cc/.cxx, CMake/PlatformIO
  firmware, clang-tidy, or embedded Arduino/ESP-IDF adapters.
kind: profile
phase: stack
triggers:
  - cpp
  - c++
  - cmake
  - clang-tidy
  - raii
  - platformio
  - arduino
depends-on: []
tools:
  - read
  - write
  - shell
disable-model-invocation: false
---
# C++ Coding Philosophy

Apply these rules when writing C++. Kit hexagonal / clean-code invariants win on structure. Language safety follows the [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines) (rule ids in [references/core-guidelines.md](references/core-guidelines.md)). Idioms also take the useful subset of [Mindrally cpp](https://github.com/Mindrally/skills/blob/main/cpp/SKILL.md) and [Alexandrescu](https://github.com/andralex) (types first, `expected`, ScopeGuard, algorithms, zero-overhead). Do not paste guideline prose into code or reviews; cite the rule id and apply it.

## Architecture

- **Domain purity** - Domain types and use cases live in namespaces (or modules) with no Arduino, ESP-IDF, POSIX, Wi-Fi, display, or HTTP client includes. HAL and vendor SDKs are adapters.
- **Ports** - Driven ports are abstract classes or C++20 concepts at the application boundary. Firmware `setup`/`loop` and `main` are driving adapters only.
- **Vertical slices** - Co-locate a capability's types, parser/policy, and tests (e.g. `duty_cycle.hpp` + `duty_cycle_test.cpp`). Do not grow a god `main.cpp`.
- **Composition over deep hierarchies** - Prefer concrete types and composition (C.2, C.129). Abstract bases exist for ports, not for every noun. Do not inherit to reuse implementation.
- **Invalid states unrepresentable** - Prefer `enum class` and `std::variant` over boolean flags plus "don't touch that field". Make the domain type the spec.
- **Policy only when axes are real** - Compile-time policy / concept parameters are for independent variation that already exists. Do not introduce a Loki-style policy host or template library for one call site ([CODING_PHILOSOPHY.md](../../CODING_PHILOSOPHY.md) §4).
- **Messy constructs stay boxed** - Vendor macros, GPIO pin maps, and C APIs stay behind a thin adapter (P.11). Domain code uses `enum class`, `constexpr`, and named functions.
- **Zero-overhead on the hot path** - Virtuals, heap, and exceptions are fine at adapter boundaries. Do not pay for them in inner loops unless a measurement says they are free.

## Language (Core Guidelines)

- **ISO C++** - Prefer Standard C++ over C APIs and macros (P.2, CPL.1). Default language is **C++20**. Drop to C++17 only when the toolchain (typical Arduino cores) cannot do C++20.
- **RAII ownership** - Every resource has a destructor-owned handle (R.1). No bare `new`/`delete`, `malloc`/`free`. Create with `std::make_unique` / `std::make_shared`. `T*` / `T&` are non-owning. Transfer exclusive ownership with `std::unique_ptr`; `shared_ptr` only when shared lifetime is real; `weak_ptr` to break cycles. Recurring resources get a named handle type. One-off rollback uses a scope guard (`std::scope_exit` / equivalent), not a new class hierarchy.
- **Typed interfaces** - Prefer `std::span`, `std::string_view`, `std::array`, and value types over pointer+length pairs (I.4, I.13, R.14). Do not pass ownership via raw pointer (I.11).
- **Absence, sums, algorithms** - `std::optional` for maybe-values, `std::variant` for closed sums. Prefer `<algorithm>` / ranges over index loops when intent is clearer. Structured bindings and `if constexpr` when they make intent obvious.
- **Const and compile-time** - Default objects and member functions `const` (Con.1–Con.4). Prefer `constexpr` / `consteval` over runtime tables (P.5).
- **Rule of Zero** - Prefer types that need no custom special members (C.20). If you define one of copy/move/destructor, define or `= delete` all five (C.21). Move with `std::move` only at the last use of an object; do not sprinkle it.
- **Type safety** - `enum class`, `nullptr` (not `NULL` / `0`), no C-style casts (`static_cast` / `dynamic_cast` / `const_cast` only with a reason). Concepts constrain templates; skip SFINAE soup and skip coroutines/modules unless the repo already uses them.
- **Error policy (one per target)** - Hosted/library code: exceptions for failure to complete a required task (I.10); catch by `const&`; aim for the strong guarantee via RAII. `noexcept` only when it is true (E.12). Freestanding / `-fno-exceptions` (MCU firmware): `std::expected` (C++23) or a project result type (`Expected<T,E>` as a value, not a parallel errno). Never mix exceptions and error codes in the same layer without an adapter.
- **Concurrency** - No data races (CP). RAII locks (`std::lock_guard` / `std::scoped_lock`); `std::jthread` when threads exist. `std::atomic` for simple flags, not as an architecture.
- **Names** - Intention-revealing domain names ([CODING_PHILOSOPHY.md](../../CODING_PHILOSOPHY.md) §4). Match the repo's layout (gpio firmware is snake_case). Do not invent `m_` / Hungarian prefixes.
- **No narrative comments** - Names and tests document why. Do not add Doxygen that restates the signature. Keep a comment only when the constraint is not expressible in types (e.g. a silicon errata).

## Tooling

- **Build** - CMake for hosted/cross-platform. PlatformIO (or the repo's IDF/Arduino flow) for firmware. Do not add vcpkg/Conan unless the repo already has them.
- Format with the repo `clang-format` (or `.clang-format` you add with the user).
- `clang-tidy` checks: `cppcoreguidelines-*`, `modernize-*`, `bugprone-*`. Do not disable a check to keep a C-ism; fix the code.
- Host tests: ASan/UBSan (TSan when threads exist).
- Fetch current Standard Library / CMake details via **context7** when the toolchain version matters.

## Testing defaults

Prefer tools already in the repo.

| Layer | Default |
|-------|---------|
| Unit / slice | GoogleTest, Catch2, or doctest; PlatformIO `test/` for firmware |
| Hardware / on-device | Thin adapter tests on host with a fake GPIO/display port; on-device smoke only when the fake cannot prove the contract |
| Security regression | Bounds, lifetime, and parser-boundary tests; no `reinterpret_cast` in domain |
| Load / performance | Measure before changing algorithms; P.9. Clever partition/sort tricks need a benchmark in the catalog, not folklore |

## Additional resources

- Rule-id map: [references/core-guidelines.md](references/core-guidelines.md)
- Canonical text: [C++ Core Guidelines](https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines) (do not vendor a copy into this kit)
- Alexandrescu: [GitHub](https://github.com/andralex), [erdani.com](https://erdani.com)
