# Project Status

## Current Focus

npm publishing is fully set up as of 2026-07-26: the SDK ships as the unscoped
**`sooth`** package (`npm i sooth`), published automatically by CI when
release-please cuts a release. `sooth@0.4.1` is live.

## Recent Changes (Last 5 Sessions)

- 2026-07-26 — npm publishing end-to-end: renamed package `@sooth/sdk` → `sooth`
  (#27), added `npm-publish` job to the release-please workflow (#25), set
  `NPM_TOKEN` repo secret, published `sooth@0.4.1` via CI `workflow_dispatch`,
  deleted the interim `sooth-sdk` package from the registry, closed stale
  release PR #26.
- 2026-07-26 — v0.4.0/v0.4.1 line merged earlier: canonical
  FeeRouter/OrderEngine/SoothBook ABIs, SoothClient wrapper rebuilt on them,
  settlement/claim path reconciled with v0.2.1 contracts, CLI type-checked and
  runnable from dist, npm publish metadata + MIT LICENSE.

## Pending / Blocked

- **Merge #28** (`chore(main): release sooth 0.5.0`) when ready — first
  automated npm publish will happen on that merge.
- **Rotate or replace `NPM_TOKEN` before 2026-10-24** (90-day granular token,
  bypass-2FA). Preferred replacement: npm **Trusted Publishing (OIDC)** — the
  GitHub Actions option is available on the `sooth` package settings page; npm
  deprecates bypass-2FA publishing entirely in Jan 2027.
- **Enable 2FA on the `ladderchaos` npm account** (currently none; also required
  for any future package unpublish/delete, which bypass tokens cannot do).

## Known Issues

- 22 `@typescript-eslint/no-explicit-any` lint warnings across CLI/core (0
  errors).
- The gh CLI OAuth token lacks the `workflow` scope; pushes touching
  `.github/workflows/*` must go over SSH (the `origin` remote of this clone was
  switched to SSH for this reason).
