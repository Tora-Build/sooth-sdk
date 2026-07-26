# Project Status

## Current Focus

`sooth@0.5.2` restores deployed-contract ABI parity for XAPP: AMMEngine now
exposes all 35 deployed functions and the SDK exports the complete
ManualAdjudicator ABI. Their function/event/error surfaces are pinned with
regression tests. npm publishing remains automated through Trusted Publishing
(OIDC).

## Recent Changes (Last 5 Sessions)

- 2026-07-27 — `sooth@0.5.2`: replaced the stale AMMEngine ABI with the complete
  deployed v0.2.1 surface and added/exported the complete ManualAdjudicator ABI,
  including parity and XAPP `getPhase` / `getOutcome` encoding tests (#32).
- 2026-07-27 — `sooth@0.5.1`: fixed plain-Node ESM resolution (NodeNext +
  explicit `.js` extensions; dist shipped 14 extensionless imports that only
  bundlers could resolve) with a CI import-smoke regression guard (#29).
  Migrated publishing to npm Trusted Publishing (OIDC) — trusted publisher
  configured on the `sooth` package for `Tora-Build/sooth-sdk` /
  `release-please.yml`, `sooth-sdk-ci` token revoked, `NPM_TOKEN` secret
  deleted. 0.5.1 was published by the OIDC path.
- 2026-07-26 — `sooth@0.5.0` released via the automated pipeline (#28).
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

- XAPP (Telegram mini app) can replace its interim `sooth-client` package with
  `sooth@0.5.2`; that integration remains in the XAPP repository.

## Known Issues

- 22 `@typescript-eslint/no-explicit-any` lint warnings across CLI/core (0
  errors).
- The gh CLI OAuth token lacks the `workflow` scope; pushes touching
  `.github/workflows/*` must go over SSH (the `origin` remote of this clone was
  switched to SSH for this reason).
- npm account (`ladderchaos`) uses a security-key passkey for 2FA; npm web
  sudo-prompts require a passkey-capable browser (the Orca embedded browser is
  not — use Aside). Registry writes from the CLI (unpublish/deprecate) need an
  OTP-capable factor and currently can't be done non-interactively.
