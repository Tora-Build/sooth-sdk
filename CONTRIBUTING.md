# Contributing to sooth-sdk

Thanks for your interest in improving the Sooth SDK. Current source includes
Factory protocol APIs, a CLI, optional React components and protocol-neutral SQF
utilities. The published npm `sooth@1.0.0` remains SQF-only; see [README.md](./README.md).

If you're reporting a security issue, **do not open a public issue** —
see [`SECURITY.md`](./SECURITY.md).

## Getting set up

Prerequisites: [Node.js 22+](https://nodejs.org/) with Corepack. The pinned package
manager is pnpm 9.15.9. CI uses the latest Node.js 22 patch; publishing uses Node.js
24 for npm Trusted Publishing, independently of the minimum SDK runtime.

```bash
git clone https://github.com/Tora-Build/sooth-sdk
cd sooth-sdk
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install --frozen-lockfile # installs deps + sets up git hooks via husky
pnpm build
```

Before pushing, at minimum:

```bash
pnpm fmt:check    # no diff expected
pnpm lint:check   # zero warnings
pnpm typecheck    # no type errors
pnpm test         # SQF, Factory, CLI and React regression coverage
pnpm build        # clean compile
pnpm test:package # public exports and removed subpaths
```

## Branch and PR conventions

- `main` is the release branch. Only `develop` merges into it via a titled release PR.
- `develop` is the integration branch. Feature and fix branches merge into it via PR.
- Feature branches use the form `<author>/<short-topic>`, e.g. `zak/decimals-fix`.

### PR expectations

- Tests are required. New behavior must come with unit coverage; bug fixes must include
  a regression test that fails without the fix.
- `pnpm typecheck` and `pnpm build` must pass. `pnpm fmt:check` and `pnpm lint:check`
  must be clean. CI gates on all four.
- No TODO / FIXME without a linked issue.
- Exported types and public functions need JSDoc where behavior isn't obvious from
  the name alone.
- Breaking changes to exported types or function signatures must be called out
  prominently in the PR description.

### Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): short imperative subject

Longer body explaining why (not what).
```

Types used in this repo: `fix`, `feat`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`, `perf`.

Example:

```
fix(sqf): preserve plain question fallback
```

## Code style

- TypeScript strict mode. No `any` unless absolutely unavoidable (lint will catch it).
- Formatted by Prettier (config in `.prettierrc.json`). Run `pnpm fmt` to apply.
- ESLint via `typescript-eslint`. Run `pnpm lint` to see issues, `pnpm lint:check` for CI-clean output.
- No commented-out code.

## Review process

- CI (lint, fmt, typecheck, test, build, package exports) must be green.
- At least one approving review from a `CODEOWNERS` maintainer.
- Large PRs should be split. If a PR touches more than ~400 lines across unrelated concerns,
  expect a request to split it.

## Licensing

This repo is MIT. By submitting a contribution you agree your work is offered under
the same license.

## Questions

For non-security discussion, open a GitHub Discussion or a draft PR.
