# sooth Test Plan

Run the package checks from the SDK repository on Node.js 22+ with Corepack.
These checks need no private Alpha/Factory checkout. Unit tests use isolated
clients; live RPC and local-chain smoke checks are separate below.

```sh
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install --frozen-lockfile
pnpm lint:check
pnpm fmt:check
pnpm typecheck
pnpm test
pnpm build
pnpm test:package
```

SQF tests preserve parsing, rule fields, multi-line questions, round trips
and plain-text fallback. Factory tests cover release binding, numeric units,
approval limits, order/inventory semantics, catalog validation and receipts.
React tests cover query scope, node/market identity, wallet boundaries and recovery.
The package smoke imports SQF, Factory and React in Node ESM, runs CLI help,
and checks the packed files. Retired `sooth/core` paths must remain unavailable.
The build clears stale output before compiling.

Regenerate the supported node/manual ABI modules from the committed inputs:

```sh
node src/factory/factoryAbi/regenerate.mjs
```

This command validates all three pinned ABI bundles and both source archives before
writing outputs. It needs no Factory or Alpha clone and does not change the bundle
bytes or release pins. Regeneration tests cover stable outputs and refusal of
corrupted or mismatched inputs without partial writes. The curated oracle, IMD and
Swarm interfaces retain their separate review requirements. Passing these checks
proves integrity against the SDK's pinned snapshots, not independent verification
of git objects held only in the private historical Factory archive or Alpha.

Inspect the publication file list without publishing:

```sh
npm pack --dry-run --ignore-scripts --json
```

## Consumer and runtime proof

The Alpha consumer scenarios below require access to the private
[sooth-alpha repository](https://github.com/Tora-Build/sooth-alpha) and its configured
services/fixtures. They are integration acceptance requirements, not prerequisites
for the public SDK checks above. Historical results in `STATUS.md` and
`FACTORY_MIGRATION_PLAN.md`, including temporary workstation paths and private
evidence, are not publicly reproducible artifacts or proof of current deployments.

Build the SDK before Alpha's registry and consumers. Alpha's `@sooth/sdk`
workspace alias must resolve the same candidate package as external consumers.
Run the affected app/service tests and production builds after installing the
candidate. Check a clean packed installation outside both repositories.

Use isolated local forks for signed scenarios. Verify the chain, Factory
release, node, market, selected venue and collateral decimals before writes.
For each feature, correlate account/destination/calldata with the successful
canonical receipt, then compare token, position, reservation and claim state.
Fixture creation and funding are setup, not proof of the application flow.

Exercise the actual CLI and the Demo/Mobile/Market/East surfaces affected by
the migration. Test the hosted embed in an unrelated page on a different
origin, and native React in a clean host. Cover wallet handoff, approval,
trade, cancellation, settlement claim and pending recovery. Verify that
iframe messages cannot substitute a signing request or cross widget identities.

For `SoothNode`, exercise host-selected node resolution, search and
Open/Resolved/All filters, market selection and return to the list. Reject
foreign node/release catalog entries and initial markets. Distinguish catalog
display provenance from verified live trade state. Confirm creation and CLOB
default off, AMM stays available and a disabled `book` initial venue falls back
to AMM. Keep direct `SoothMarket` integration covered independently.

Check panel, 480px drawer and 960px modal, narrow full-screen presentation,
keyboard navigation, Escape, focus restoration and host-controlled open/close.
Use the actual Alpha generator output in an independent article host, plus the
native React host described in [Alpha's private embed guide](https://github.com/Tora-Build/sooth-alpha/blob/main/apps/embed/README.md).
Verify URL/message data cannot replace trusted release/RPC configuration or
cross instance/node identities. Wallet handoff must preserve node, feature
settings, selected market/action and creation view without authorizing signing.

With creation enabled, cover fresh permissions/profile admission, exact fee and
budget preview, bounded approval, explicit creation, canonical receipt recovery,
and catalog indexing before opening the new market. Interrupt approval and
creation, reopen, change account/chain and refuse duplicate submission. Correlate
signed creation and AMM/CLOB flows with receipts and balances before recording
acceptance. Historical node-extension evidence is recorded separately in
[STATUS.md](./STATUS.md#node-embed-extension-2026-10-17); that record reports scoped
signed local creation, AMM buy/sell, native host-adapter sale and book
placement/cancellation for its candidate. Real extension authentication and
deployed-indexer acceptance remain outside that evidence, independently of earlier
market-widget records.

The detailed matrix is in [FACTORY_MIGRATION_PLAN.md](./FACTORY_MIGRATION_PLAN.md).
Record checks actually run and distinguish unit tests, local-chain UI evidence,
production builds and untested wallet/provider behavior. Local test wallets do
not prove real extension prompts, Privy authentication or public deployments.
