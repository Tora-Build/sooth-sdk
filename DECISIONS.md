# Architectural Decision Records

These dated decisions preserve the context and verification scope of their original
records. Pending-release statements are historical; the [README](./README.md)
distinguishes current source from the published SQF-only package. Alpha and historical
Factory references require private access to Alpha or `sooth-factory-archive`;
the new public Factory repository does not supply those old objects. Local acceptance evidence referenced
through `STATUS.md`, including temporary workstation paths, is historical and not
publicly reproducible; it does not establish current production readiness.

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

## ADR-005: Shared Factory protocol and frontend SDK

- **Date**: 2026-10-16
- **Status**: Accepted for local implementation; verification and release pending.
- **Context**: Alpha's Factory applications implement protocol behavior in
  options-core and app-local copies. The owner requested one production SDK,
  migration of those consumers, and a market widget for unrelated applications.
- **Decision**: Extend the SQF-only scope of ADR-004 with `sooth/factory`,
  explicit supported-release artifacts, a CLI, and optional `sooth/react`
  components and hooks. Extract Alpha's working implementation and migrate its
  consumers; retain SQF root and `/sqf` APIs and keep retired core exports absent.
  The protocol SDK is independent of Alpha configuration and React. Applications
  supply trusted deployments, endpoints and wallet adapters. Alpha hosts the
  embeddable application over the same reusable frontend and protocol APIs.
- **Consequences**: Registry consumes portable SDK wire types without a reverse
  SDK dependency. React and React Query are optional peers with separate entry
  points. Publication and hosted deployment remain separate from this local
  implementation. Acceptance is defined in `FACTORY_MIGRATION_PLAN.md` and
  requires consumer adoption, duplicate removal and external-host verification.

## ADR-006: Host-selected node embed

- **Date**: 2026-10-17
- **Status**: Accepted scope extension; scoped local signed flows verified.
- **Context**: The initial single-market widget did not provide a host-selected
  node's browse-to-market-and-back journey or optional user creation.
- **Decision**: Add `SoothNode` over the existing runtime and `SoothMarket`.
  Scope catalog browsing, search and status filters to the host's chain, Factory,
  node and release. Creation and CLOB default off; AMM remains available. Supply
  native panel/drawer/modal presentations and a node-oriented Alpha generator.
  Preserve direct `SoothMarket` and the hosted market route as supported
  independent integrations. Trusted release/RPC configuration remains application
  owned; host messages never grant signing authority. Wallet handoff preserves
  node/features/action, and interrupted transactions require reconciliation.
- **Consequences**: Node browsing and explicit user creation are accepted additions
  to the migration scope, superseding the existing-market-only limitation.
  Automated creation from article text remains separate product work. SDK owns
  reusable UI/protocol behavior; Alpha owns hosted deployment and integration
  guidance in its [private embed documentation](https://github.com/Tora-Build/sooth-alpha/blob/main/apps/embed/README.md).
  Existing verification records retain their original scope. Node creation,
  AMM buy/sell and book placement/cancellation have separate local signed
  evidence in `STATUS.md`; real extension authentication and deployed-indexer
  acceptance remain outside that evidence.
