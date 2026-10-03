---
name: lang-typescript
description: >-
  Enforces strict TypeScript typing, hexagonal ports-and-adapters layout, DDD
  domain purity, vertical-slice feature folders, and Zod boundary validation.
  Use when writing or reviewing TypeScript or Node.js code, .ts/.tsx files,
  or when the project uses npm/pnpm workspaces.
kind: profile
phase: stack
triggers:
  - typescript
  - node
  - tsx
  - vitest
  - jest
  - zod
depends-on: []
tools:
  - read
  - write
  - shell
disable-model-invocation: false
---
# TypeScript / Node.js Coding Philosophy

Apply these rules strictly when writing TypeScript or Node.js code:

- **Strict typing** - Enable `strict`. Never use `any`, `as any`, or `as unknown as`. Reach for `unknown` plus a type guard/Zod parse, explicit generics, or `satisfies T`. Tests use typed fakes, `Partial<T>`, and `vi.fn<typeof impl>` - not `as any`. Vitest `expect.any(Number)` is a matcher, not a type `any`. Turn on `typescript/no-explicit-any` (oxlint or ESLint) as an error so this cannot regress.
- **Ports & adapters** - Driving ports as interfaces (e.g. `CreateOrderUseCase`). Driven ports as interfaces; use DI tokens or functional injection for implementations.
- **Domain purity (DDD)** - Aggregates and value objects in `domain/` with no TypeORM, Prisma, or class-validator decorators.
- **Vertical slices** - Co-locate `*Handler`, request/response types, and slice tests under `features/<capability>/`. Extra modules for that capability go in the same folder (`index.ts` barrel). Never add prefixed siblings in the parent (`fooBar.ts` next to `foo.ts`); never leave `foo.ts` beside a `foo/` directory.
- **Validation** - Zero-trust parsing at infrastructure boundaries with `Zod` or `ArkType` before data reaches handlers.
- **No narrative comments** - Names and tests document why ([CODING_PHILOSOPHY.md](../../CODING_PHILOSOPHY.md) §4). Do not add JSDoc that restates the identifier.
- **Sonar default profile** - Before the change is done, it must satisfy SonarCloud's default quality profile at BLOCKER, HIGH, and MEDIUM ([sonarqube-findings](../../SOPs/sonarqube-findings.md)). Two rules that must not regress:
  - `typescript:S9383` — await the promise, end it with `.catch`, end it with `.then` that has a rejection handler, or mark it `void`. Do not call an async function and drop the return value.
  - `typescript:S8786` — do not add a regular expression whose quantifiers backtrack super-linearly (repeated `\s+` around a literal is the usual shape). Scan the string by index instead.

## Testing defaults

Prefer project-existing tools; otherwise these defaults for [agent-tdd](../agent-tdd/SKILL.md) / [agent-xfn](../agent-xfn/SKILL.md):

| Layer | Default |
|-------|---------|
| Unit / slice | Vitest (or Jest if already in repo) |
| Browser E2E | Playwright |
| Accessibility | `@axe-core/playwright`; `eslint-plugin-jsx-a11y` for static UI |
| Security regression | Vitest/Playwright abuse and authz cases; OWASP ZAP only if CI already has it |
| Load / performance | k6 |
