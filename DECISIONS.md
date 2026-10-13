# Architectural Decision Records

## ADR-001: Publish the SDK as the unscoped npm package `sooth`

- **Date**: 2026-07-26
- **Status**: Accepted
- **Context**: The intended name `@sooth/sdk` is unpublishable — the `@sooth`
  scope belongs to an unrelated registered npm user named `sooth`, and an org
  of that name cannot be created. Our account (`ladderchaos`) owned the
  unscoped `sooth` name, reserved as a placeholder in Feb 2026 for exactly
  this purpose. (Beware: `npm org ls <name>` reports "owner" for any username
  and is not evidence of org ownership.)
- **Decision**: Ship the SDK as unscoped **`sooth`**, publishing over the
  placeholder. An interim `sooth-sdk@0.4.1` publish was deleted from the
  registry the same day; that name is dead. GitHub repo stays `sooth-sdk`.
- **Consequences**: Subpath exports read as `sooth/core`, `sooth/sqf`, etc.
  The rename commits are marked breaking, so the first release under the new
  name is 0.5.0. Package README title/install instructions use `sooth`.

## ADR-002: Automated npm publishing via release-please + granular token

- **Date**: 2026-07-26
- **Status**: Superseded by ADR-003
- **Context**: Releases were tagged by release-please but nothing published to
  npm. The npm account has no 2FA, and npm requires 2FA or a bypass-2FA
  granular token to publish.
- **Decision**: Added an `npm-publish` job to `.github/workflows/release-please.yml`
  gated on `releases_created == 'true'` (plus manual `workflow_dispatch` as a
  backfill path; npm rejects duplicate versions so re-runs are safe). Auth via
  `NPM_TOKEN` repo secret — granular token `sooth-sdk-ci`, read/write all
  packages, bypass-2FA, expires **2026-10-24**.
- **Consequences**: Every release-please release publishes automatically. The
  token must be rotated before 2026-10-24; npm deprecates bypass-2FA
  publishing in Jan 2027, so the durable fix is npm **Trusted Publishing
  (OIDC)** for GitHub Actions (offered on the `sooth` package settings page),
  which removes the long-lived secret entirely. Note that unpublish/delete
  operations require a real 2FA session in the npm web UI — tokens cannot do
  them.

## ADR-003: npm Trusted Publishing (OIDC) replaces the granular token

- **Date**: 2026-07-27
- **Status**: Accepted
- **Context**: The ADR-002 token had a 90-day expiry (2026-10-24) and npm is
  ending bypass-2FA publishing in Jan 2027 — a hard deadline. OIDC removes the
  long-lived credential entirely.
- **Decision**: Configured a Trusted Publisher on the `sooth` package:
  GitHub Actions, `Tora-Build/sooth-sdk`, workflow `release-please.yml`,
  action "npm publish" only. The `npm-publish` job uses `id-token: write` and
  Node 24 (npm ≥ 11.5.1 required for OIDC) with no token env. Verified by the
  `sooth@0.5.1` publish; the `sooth-sdk-ci` token and `NPM_TOKEN` secret were
  then revoked/deleted.
- **Consequences**: Only this exact repo + workflow filename can publish —
  renaming `release-please.yml` or publishing from a fork breaks trust and
  requires updating the publisher config on npmjs.com. `workflow_dispatch`
  re-runs of the same workflow remain trusted. Provenance attestations stay
  unavailable while the repo is private. npm package settings changes sit
  behind a passkey sudo-gate (see STATUS.md known issues).

## ADR-004: Utility-only SQF package

- **Date**: 2026-10-13
- **Status**: Accepted for implementation; release pending review
- **Context**: Alpha is retiring sooth-core integrations. Its Factory paths
  need only the protocol-neutral SQF parser and generator from this package.
- **Decision**: Keep the `sooth` name and `/sqf` API, remove the protocol/CLI
  surface and all runtime dependencies, and use major version 1.0.0. The root
  exports the same SQF API. No Factory protocol client is added.
- **Consequences**: 0.x core consumers must retire or replace their integrations.
  Alpha keeps its workspace alias and integrates the SDK gitlink separately.
  Release, publication, and deployment require separate authorization. Earlier
  ADRs describe historical package and release decisions; their core subpath
  examples no longer describe the current exports.
