# sooth Test Plan

Run these local checks from the SDK repository. They need no RPC, wallet,
registry service, or transactions.

```sh
pnpm install --frozen-lockfile
pnpm lint:check
pnpm fmt:check
pnpm typecheck
pnpm test
pnpm build
pnpm test:package
```

The SQF tests preserve parsing, rule fields, URL descriptions, multi-line
questions, round trips, and plain-text fallback. The package check imports
both public entry points in Node ESM and verifies the removed subpaths fail.
The build clears stale output before compiling so old core files cannot ship.

Inspect the publication file list without publishing:

```sh
npm pack --dry-run --ignore-scripts --json
```

Only SQF build output and package documentation may ship. No CLI, snapshot,
core ABI, protocol implementation, or runtime dependency may remain.

Alpha Factory East and Market must import only `@sooth/sdk/sqf`. Verify their
imports separately and coordinate legacy consumer removal before integrating
the SDK commit. The SDK checks do not prove Alpha app builds or wallet flows.
