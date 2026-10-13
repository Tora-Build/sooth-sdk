# Project Status

## Current Focus

Prepare `sooth@1.0.0` as a protocol-neutral SQF utility. The package name stays
`sooth`, and Alpha keeps the `@sooth/sdk` workspace alias. Root and `/sqf`
exports expose only SQF functions and types. SQF semantics are unchanged.

Core ABIs, contract helpers, client and registry implementations, the embedded
v1 snapshot, CLI, scenarios, and their tests are removed. There are no runtime
dependencies. No Factory client is implemented.

## Integration and Release

The SDK PR must be reviewed before Alpha integrates its gitlink. Alpha's
consumer owners retire legacy paths and remove the old snapshot/type guards.
The 1.0.0 version is pending release. No merge, npm publication, deployment,
or parent gitlink change is part of this cleanup.

The release-please manifest still records the last release, 0.6.3. The cleanup commit
requests the next release with a `Release-As: 1.0.0` footer. The release workflow remains manual.

## Verification

See `TEST_PLAN.md` for the local checks. Historical releases and decisions
remain in `CHANGELOG.md` and `DECISIONS.md`; older status is available in Git.
