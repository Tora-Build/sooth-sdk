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
- **Status**: Accepted (interim — migrate to Trusted Publishing)
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
