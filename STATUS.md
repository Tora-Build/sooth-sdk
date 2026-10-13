# Project Status

## Current Focus

Maintain the published `sooth@1.0.0` protocol-neutral SQF utility. The package name
stays `sooth`, and Alpha keeps the `@sooth/sdk` workspace alias. Root and `/sqf`
exports expose only SQF functions and types. SQF semantics are unchanged.

Core ABIs, contract helpers, client and registry implementations, the embedded
v1 snapshot, CLI, scenarios, and their tests are removed. There are no runtime
dependencies. No Factory client is implemented.

## Integration and Release

`sooth@1.0.0` was published on 2026-10-13 from merged SDK commit
`a63e22f0a7660bf248d1bc6e8d3bd854d6d46b09` through the existing Trusted Publishing
workflow. The release-please manifest and package version both record 1.0.0.
`CHANGELOG.md` describes the SQF-only release separately from historical core work.

Alpha integrates its SDK gitlink separately after consumer cleanup. Release
tracking changes do not update that pin or republish the npm package.

The release workflow remains manual and attempts npm publication on each dispatch.
Do not dispatch it for already-published 1.0.0; it needs an idempotency guard or a
separate path for release metadata before that operation is safe. GitHub release/tag
tracking is separate from npm publication.

## Verification

See `TEST_PLAN.md` for the local checks. Historical releases and decisions
remain in `CHANGELOG.md` and `DECISIONS.md`; older status is available in Git.
