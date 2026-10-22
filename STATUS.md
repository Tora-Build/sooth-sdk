# Project Status

## Current Focus

Implement the three workstreams in `FACTORY_MIGRATION_PLAN.md`: Factory protocol
SDK, Alpha consumer adoption and an embeddable node/market frontend. This checkout
extends the published SQF-only 1.0.0 baseline; it has not been published or deployed.

Root and `/sqf` retain their SQF APIs. Factory APIs and the new CLI target pinned
v7/v7.1 releases. Optional React entry points supply reusable node/market UI and hooks.
Alpha supplies production endpoints, hosted services and product policy. Legacy
core exports and registry v1 remain retired.

Collateral approvals default to a finite amount. The React trade and deposit reviews
make "Approve exact amount" the primary action and the default `approve()` mode;
"Approve unlimited {symbol}" is a secondary, explicit opt-in. Planners and the CLI
never choose an unlimited amount.

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

Local implementation and acceptance work has run; the complete migration plan
remains open. After the cross-window source repair, the final SDK build, full
29-file/522-test suite, lint, formatting and package smoke (180 files) all passed
(retained runner artifact 332), superseding the 517-test run. Earlier runs passed 503 tests before final fixes,
targeted 192 tests including 10 component tests, and Manual optional-attestation
coverage of 45 tests; the final full-suite result supersedes the earlier suite count.

Alpha evidence: Market 54 tests, full Demo 36 files/529 tests, Mobile 9 files/83
tests and Indexer 13 files/143 tests passed; Indexer typechecking also passed.
Earlier Demo fixture/Operator runs passed 41/29 tests and Mobile profile tests 15.
Admin passed 119 tests in 15 files with 14 database-environment skips, leaving
full persistence unproven. Hosted embed production typechecking/build passed
(506 modules; chunk-size warning only). Archived Market/East builds and bundle guards
passed. Demo's clean production build passed with `SOOTH_DEMO_ENV_DIR`, followed
by a 187-file bundle scan. A clean external React app installed the packed candidate,
built and passed SSR import; a clean Node app imported the protocol/SQF entry points
without React installed. The packed candidate still declares 1.0.0; it is not a new
npm release. Exact retained package metadata is in the
[React preparation record](/tmp/sooth-external-react-Y7jDWI/preparation.json) and
[Node import result](/tmp/sooth-external-node-jFPGFc/import-smoke-result.json).

The loopback Robinhood fork (chain 46630, starting block 134210557) has actual
signed Demo, CLI and embed evidence in
[/tmp/sooth-sdk-migration-74d73071](/tmp/sooth-sdk-migration-74d73071).
It covers AMM buy/sell, finite approvals, two LP classes, partial book fills,
guardian veto, recovered Manual attestation/settlement, INVALID payouts, sequential
LP fees/principal, outsider timeout and refund/book payout. Different-origin article
and native React hosts exercised signed orders and cancellation; widget claims
proved a 0.0008 USDG timeout refund and 0.5 USDG INVALID payout. See the
[migration completion record](FACTORY_MIGRATION_PLAN.md#evidence-and-completion-rule)
for scenario files and limits.

Market's actual UI renders, but its public pinned RPC blocks synthetic local trades;
no guard was bypassed. East's actual Sepolia v7 settled drawer and AMM/book reads
passed a smoke run; signed local acceptance needs a matching Sepolia fixture.
Mobile's actual local UI on port 5183 connected actor 5 and rendered market and
portfolio without application JavaScript errors; signing and Privy were not exercised.
The fork settled while the portfolio loaded, so this does not prove current balances.
The exhausted-claim UI fix passed actual 375px-wide widget observation: zero
holdings, no claim button and no horizontal overflow. An actual two-tab browser
test then found that tab B reached signing after tab A persisted a pending intent;
the source now refuses unavailable locks immediately, rechecks pending intent before
send and retires memory fallback after durable save. The original browser storage
timing cause is unproven. Actual final-module two-window mechanism checks passed:
immediate refusal without queued signing, exact pending identity after reload,
blocked explicit retry and authoritative removal without memory resurrection.
A synthetic adapter/hash was used without broadcast; this is mechanism evidence.
Full cross-browser/provider and recovery matrices remain open. No migration
publication, deployment, commit or gitlink pin is recorded. Final candidate SHA256
`a3b6a879c1a316042f13c052546df6cca665e69cd34735390a58a6d26c1014aa`
was installed in both external consumers; no-React Node imports and the refreshed
React production build passed (527 modules, chunk-size warning only). Earlier SSR
import evidence remains scoped to the earlier candidate. Hosted embed production
environment guards passed 20 tests and now run in CI as `productionEnv.spec.ts`.

### Node embed extension (2026-10-17)

`SoothNode` now provides host-selected node browsing, search, Open/Resolved/All
filters, market/back navigation and native panel/drawer/modal presentations.
Creation and CLOB default off; AMM remains available. Direct `SoothMarket` is
still an independent integration. Alpha's [host documentation](../sooth-alpha/apps/embed/README.md)
covers node snippet generation, presentation containers and wallet handoff.

For this extension, the SDK build passed. The React run passed 230 tests and
failed 14 because of a creation fixture; after correcting `creation.spec.ts`,
its targeted rerun passed 25/25 (244 passing tests across the suites, not a new
single full-suite run). Alpha embed tests passed 31 tests; the embed and native
React example builds passed. Browser checks passed native browsing/search,
optional feature toggles, 480px desktop drawer, 960px modal, Escape with focus
return, and a full-screen 390×844 mobile layout without horizontal overflow.
The generator produces a node snippet consumed by an independent article host.
Affected Alpha IMD/Demo helper-adoption checks also passed 317 tests in 15 suites.

Further browser checks exercised the generator's panel snippet in the independent
article host, its 480px drawer and 960px modal, and iframe removal on close. The
raw generated modal snippet executed on the independent host at port 5181:
close and Escape each left zero frames, and reopening restored one frame. Native
search, an empty Resolved filter, and clearing a no-match search passed. With
default features, creation/CLOB controls stayed absent even with URL `venue=book`.
Editing the title while generation was in flight prevented the delayed response
from publishing a stale snippet. The actual `/v1/node/wallet` popup carried the
correct node, feature flags and `view=create`; it rendered the creation form
without automatically sending a transaction. These observations establish
presentation and handoff behavior, not signed creation success.

The final source passed SDK build, lint and formatting; package smoke passed with
194 files. The current node-extension candidate is
[/tmp/sooth-packed-node-sdk-final.CFZI6J/sooth-1.0.0.tgz](/tmp/sooth-packed-node-sdk-final.CFZI6J/sooth-1.0.0.tgz),
SHA256 `154b3bb6ec6b7132f8267ce2c6677e2a936df1a09c815f95748bbaf3eb3c02a8`.
Installed in the clean external host
[/tmp/sooth-packed-node-host.alM04U](/tmp/sooth-packed-node-host.alM04U), it passed
a 534-module production build and SSR import (`SoothNode` is a function).
Actual browser checks on port 5186 mounted the catalog, enabled feature toggles,
opened the modal and closed it with Escape without JavaScript errors. This
candidate supersedes earlier package candidates for node-extension evidence;
historical verification above retains its original scope. Its version remains
1.0.0 and no publication is implied.

Signed node UI evidence now covers creation and AMM buy/sell on local chain 46630,
original fork block 137051500. The archive was restored with the same state and
the clock corrected by empty block 137051522. Creation transaction
`0xd85d6e86090fbfe6e73e2d85716c39bac3c0988515887af6ac644a7835f82549`
at block 137051523 created `0x0f744b3d028B6D3CcD17AAC1677f4481b2a0eD5d`,
with exact question/node binding and a 69.314719 USDG debit within the 100 USDG
cap. The catalog discovered the market and the UI navigated to it. After an exact
AMM approval, buying 10 YES showed a position of 10 and 52.5% probability; selling
4 showed a remaining position of 6 and 51.5%. Browser evidence is retained in
[/tmp/sooth-node-embed-74d73071/browser-evidence.json](/tmp/sooth-node-embed-74d73071/browser-evidence.json).
The native host on port 5182 then used its supplied wallet adapter to sell 1 YES,
showing confirmation and a remaining AMM position of 5 YES. Book placement of
2 YES at 40 cents created resting order 12 in transaction
`0x0d638820ad24947ed5b6f33a204b579d39170b351f3fa96cf55394471bd8f7f8`,
with 0.80 USDG escrow. Cancellation succeeded; the UI showed no open orders,
zero escrow and a 9650.818 USDG displayed balance. The independent
[final chain audit](/tmp/sooth-node-embed-74d73071/final-chain-evidence.json)
verified all nine receipts and captured calldata, registration and node wiring,
prior-block AMM quotes, fee identities, native rounding and slippage bounds.
Exact collateral changes were −5.176198 USDG for buying 10 YES, +2.059155 for
selling 4 and +0.508609 for the native-host sale of 1. Order 12 reserved and
returned exactly 0.800000 USDG without a fill or fee. Final state was 5 YES,
zero book positions/orders/escrow and 9650.817971 USDG. These scoped local flows
are complete. Pre-restoration approval balance history is not used as evidence;
approval checks use their decoded events and allowances.
Environment repair restored the archive backend and corrected the fork clock.
A cold-read preflight refused before signing, then succeeded on retry; no product
guard was relaxed. These flows used a test signer, not real extension
authentication, and local catalog synthesis, not a deployed indexer. Earlier
signed market-widget records above retain their original scope. No tests or
builds were run as part of this documentation update.

Historical releases and decisions remain in `CHANGELOG.md` and `DECISIONS.md`;
older status is available in Git.
