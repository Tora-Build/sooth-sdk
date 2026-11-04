# Sooth SDK: Factory migration, client adoption and frontend embeds

This is a historical migration plan and acceptance ledger. Its baseline revisions,
service observations and pending-work statements retain their recorded dates and
scope; they are not a current deployment inventory. Alpha and historical Factory
references require private repository access. The historical Factory repository is
now `Tora-Build/sooth-factory-archive`; the new public `sooth-factory` has a separate
history and does not contain the old pinned git objects. Exact bundled SDK inputs
can be checked and regenerated publicly as described in the README. Absolute `/tmp` and `/var/folders` paths below
are historical, temporary workstation evidence, may no longer exist, and are not
publicly reproducible artifacts. Public SDK build/check instructions are in the
[README](./README.md#migration-and-development) and [TEST_PLAN.md](./TEST_PLAN.md).

Status: local implementation and partial acceptance recorded 2026-10-16. Protocol, consumer and embed code has changed; the planned acceptance matrices below remain requirements. No migration npm publication, deployment, commit or Alpha SDK gitlink pin is recorded. The combined plan is not complete.

## Three workstreams

1. **Migrate the protocol SDK from `sooth-core` to `sooth-factory`.** Support Factory identities, release versions, contracts, reads, trading, liquidity, settlement and claims. Retire the old core interfaces.
2. **Investigate current clients, extract reusable code and migrate them to the SDK.** Identify apps and services that implement protocol behavior outside the SDK. Consolidate their reusable logic into the SDK, reconcile duplicates and change every selected consumer to use it wherever the behavior is shared. Keep product-specific UI, policy and wallet orchestration in the applications.
3. **Build an embeddable frontend for other applications.** Deliver a complete host-selected node experience through a one-line hosted embed and a React component: browse/filter markets, enter a market and return, with optional creation and CLOB. Cover wallet connection, trading, positions, transaction recovery and claims so a non-prediction-market app can integrate Sooth with minimal setup. Direct single-market integration remains supported.

Workstreams 1 and 2 proceed together: Alpha's working Factory integration supplies much of the new SDK implementation, and its consumers validate that implementation. Workstream 3 builds on the shared protocol foundation; its design and UI extraction can start once the relevant interfaces are stable.

The detailed P0–P5 phases below execute workstreams 1 and 2 together. F0–F5 execute workstream 3. These are delivery phases within the three workstreams, not additional top-level goals.

Success means our own selected apps and services use the SDK with duplicate protocol logic removed, and an external app can embed a complete Sooth node or individual market without building its own prediction-market integration.

## Decision

Make `sooth-sdk` the owner of the reusable production Factory client. Extract the working protocol layer from Alpha, reconcile its app-local copies, and migrate the consumers to that implementation. Keep `sooth-factory` as the authority for contracts, generated artifacts and protocol behavior. Keep Alpha responsible for its products and hosted services.

This is an extraction and consumer adoption project, not an ABI replacement in the old core SDK. Completion requires Alpha to consume the new package and remove its duplicate protocol implementations.

Retain the npm name `sooth`, the current SQF root API and `sooth/sqf`. Add an explicit `sooth/factory` surface. Do not restore `sooth/core` aliases or core deployment support. The proposal extends SDK ADR-004's SQF-only scope; record that change when implementation begins. Alpha ADR-130's removal of core support remains in force.

The frontend deliverable is an embeddable Sooth node experience for applications whose main purpose is not prediction markets: news sites, communities, event pages and other products. A host selects a node without implementing contract access, financial calculations or a trading interface. Users browse its markets and return from an individual market; creation and CLOB are optional. Direct selected-market integration remains supported. The hosted embed and React integration use the same SDK and reusable UI.

## Research baseline (before local implementation)

| Repository / checkout | Revision | Relevant state |
| --- | --- | --- |
| Standalone sooth-sdk | `9a5f0f4bf1116ece2e40bad05b7070f94f57b47f` | Package 0.6.1; old core client, ABIs, registry v1, CLI |
| sooth-alpha | `7d5284df1101e2d05ce41d1648b6166e59a24dab` | Factory applications, registry v2, indexer and shared client code |
| Alpha packages/sdk gitlink and checked-out HEAD | `a63e22f0a7660bf248d1bc6e8d3bd854d6d46b09` | Package 1.0.0; SQF only; no runtime dependencies or CLI |
| Historical sooth-factory (now private sooth-factory-archive) | `8ab10997ead9f7e0d9afad873aa5799e214f0235` | Reference adapter at the research baseline describes v7.2; not the live target by default |

The standalone SDK checkout differs from the SDK Alpha already consumes. Reconcile with the existing `a63e22f0` cleanup before implementing; do not redo its deletion work or assume this checkout is the current consumer baseline. These revisions identify inspected source, not published npm versions or proof that every working file is committed.

Read-only GET `https://registry.sooth.market/v2/status` during this investigation returned:

| Chain | Supported live interface | Factory | Observed service state |
| --- | --- | --- | --- |
| Sepolia 11155111 | `sooth-factory-v7` | `0x67926F892CaBa6A8b96ee45b0c927031371C9e85` | ready, 3 nodes, 48 markets, lag 2, no quarantine |
| Robinhood testnet 46630 | `sooth-factory-v7.1` | `0x42D11954d64822A7241a40d4cC2257799d87447c` | ready, 2 nodes, 72 markets, lag 2, no quarantine |

Use the exact release IDs, ABI hashes, source/artifact revisions and start blocks in the [private Alpha release seeds at the research baseline](https://github.com/Tora-Build/sooth-alpha/blob/7d5284df1101e2d05ce41d1648b6166e59a24dab/packages/registry/factory-releases.json). Support both recorded live releases. v7.2 requires a separate explicit support entry and conformance evidence; do not silently use Factory main's artifacts for v7/v7.1. An unchanged ABI digest does not imply unchanged behavior or deployment identity.

The old CLI's `node bin/soothcli.js --list` failed with HTTP 410 from `/v1/nodes`. That is consistent with the retired v1 integration, not evidence that Factory discovery is unavailable.

## Why Alpha worked without a protocol SDK (research baseline)

1. Alpha deliberately retired the old SDK protocol surface. [ADR-130 (private baseline)](https://github.com/Tora-Build/sooth-alpha/blob/7d5284df1101e2d05ce41d1648b6166e59a24dab/DECISIONS.md) records factory-only shared services and SDK cleanup, with no required old-claim support. [SDK ADR-004](./DECISIONS.md#adr-004-utility-only-sqf-package) explicitly added no Factory client.
2. The applications still depend on the workspace alias `@sooth/sdk`, but active imports use `/sqf` for question parsing and generation. Old core imports remain in some legacy tests and archived files; dependency declarations alone do not establish a runtime protocol dependency.
3. Alpha built its own production client in the private `@sooth/options-core` package: `factoryClient`, `factoryTransactions`, `factoryPortfolio`, `factoryCatalog`, `factoryIndexer`, `factoryTrade/*`, and generated `factoryAbi/*`.
4. Demo and Mobile use React adapters in `@sooth/ui-hooks`. Market and East also contain app-local financial calculations, binding checks and transaction helpers. Market's `bookOrder.ts` explicitly says it was copied from East and intended to move into a shared package after the milestone.
5. Registry v2 and the persistent indexer provide discovery and historical data. Wallet adapters and viem let the applications read and submit directly. An npm SDK is not required for that architecture to function.

The issue is ownership and duplication: much of the SDK already exists inside the client repository, under a package described as Eastboard option templates. Writing a new independent client would add another implementation to maintain.

Key historical evidence (private repository access required):

- [Shared client and verification](https://github.com/Tora-Build/sooth-alpha/blob/7d5284df1101e2d05ce41d1648b6166e59a24dab/packages/options-core/src/factoryClient.ts)
- [Transaction builders](https://github.com/Tora-Build/sooth-alpha/blob/7d5284df1101e2d05ce41d1648b6166e59a24dab/packages/options-core/src/factoryTransactions.ts)
- [Shared financial plans](https://github.com/Tora-Build/sooth-alpha/tree/7d5284df1101e2d05ce41d1648b6166e59a24dab/packages/options-core/src/factoryTrade/)
- [React adapters](https://github.com/Tora-Build/sooth-alpha/blob/7d5284df1101e2d05ce41d1648b6166e59a24dab/packages/ui-hooks/src/factory.ts)
- [Market's copied order arithmetic](https://github.com/Tora-Build/sooth-alpha/blob/7d5284df1101e2d05ce41d1648b6166e59a24dab/apps/market/src/factory/trade/bookOrder.ts)
- [Mobile migration report](https://github.com/Tora-Build/sooth-alpha/blob/7d5284df1101e2d05ce41d1648b6166e59a24dab/apps/mobile/FACTORY_MIGRATION_REPORT.md)
- [Historical Factory reference adapter and accounting rules (private archive)](https://github.com/Tora-Build/sooth-factory-archive/blob/8ab10997ead9f7e0d9afad873aa5799e214f0235/sdk/README.md)

Do not use the October 12 umbrella migration ledger as current readiness: it predates ADR-130, v7.1 adoption and Mobile's October 14 acceptance update. The Mobile report records remaining real Privy/public-write verification limits; this investigation did not rerun those flows.

## Ownership and package boundary

| Concern | Final owner | Migration treatment |
| --- | --- | --- |
| Solidity behavior, artifact generation, ABI bundles, release commitments, reference conformance | sooth-factory | Consume exact pinned artifacts; do not copy contract policy into a second specification |
| Identity types, release capability dispatch, ABI access, node/market binding, units, reads, quotes, plans, transaction builders, receipt/event interpretation | sooth-sdk | Extract and consolidate existing Alpha code; complete the gaps against the pinned contracts |
| Public catalog/data wire types and HTTP readers | SDK owns reusable consumer definitions/readers; Alpha services own API implementation | Resolve current types once; Alpha registry imports/reuses portable SDK types where needed, avoiding a dependency cycle |
| Registry seeds, branding, curation, moderation policy, cache/storage, indexer acquisition/reorg/persistence and reconciliation | sooth-alpha | Stay in Alpha; consume SDK primitives only where they are the same public contract |
| Public React hooks and reusable node/market UI | sooth-sdk frontend layer | Extract portable hooks/components; optional React dependencies stay outside protocol-only imports |
| Alpha-specific hooks, wallet login, navigation, product text and recovery UI | Alpha packages/ui-hooks and apps | Keep product adapters; adopt public components where suitable without changing product behavior |
| Hosted widget application and its wallet connection/recovery flow | Alpha hosts and operates it; SDK owns reusable UI | Thin host over the SDK frontend layer; no fork of financial logic |
| East option templates, schedules, product-specific canonical-market rules and resolver operations | Alpha options-core/options-resolver | Stay in Alpha; invoke generic SDK creation/lifecycle APIs |
| SQF parser/generator | sooth-sdk | Preserve root and `/sqf` contracts and tests |
| Interactive protocol CLI | sooth-sdk | New Factory adapter over the same SDK, with no separate protocol calculations |

Dependency direction: Factory artifacts → protocol SDK → frontend SDK → hosted widget and Alpha product adapters. Alpha services consume protocol SDK types/primitives as needed. The protocol SDK must not depend on Alpha workspace packages, React, a wallet framework, private credentials, production host configuration, or East-specific node records. React and wallet integration dependencies belong only to optional frontend entry points or the widget host.

Proposed package surface:

- `sooth` and `sooth/sqf`: retain the current SQF exports.
- `sooth/factory`: public types, release support, verification, reads, financial plans and transaction preparation.
- `sooth/factory/abis`: explicit supported-release ABI access, including separately pinned adjudicator capabilities.
- `sooth/factory/data`: catalog and indexer clients with provenance, pagination and freshness metadata.
- `sooth/react`: public hooks and native React node/market components; React is an optional peer and is not loaded by protocol/SQF imports.
- Versioned hosted node and market routes: framework-neutral iframe integration, generated for a selected node or exact market. The domain is selected when deployment is configured; no public deployment is recorded.
- `soothcli`: thin optional executable importing the same Factory APIs; CLI-only dependencies must not enter browser imports.

Keep existing useful function names during extraction where their contracts are sound. Do not recreate both a root `SoothClient` wrapper and a competing `core` client factory. Separate pure planning from RPC reads and signing. SDK callers supply transports, release selection, accounts and endpoints.

## Required protocol coverage

| Area | Existing source to reuse | Required outcome |
| --- | --- | --- |
| Identity and release verification | Alpha registry factory types; options-core factoryClient/anchorClient/nodeChildren; Market marketBinding | Full chain/factory/node/market/venue identity; release and token checks; verified request context and block provenance |
| Discovery and historical data | factoryCatalog/factoryIndexer; Market catalogSource/client; registry v2 schema | Nodes, markets, orders, fills, depth, inventory and trade history; bounded pagination; distinguish stale/unavailable from empty; indexed data never substitutes for pre-sign checks |
| AMM | factoryTrade/ammTradePlan, readFactoryQuote, transaction builders | Buy/sell, exact WAD bounds and native approval budgets, immediate sell payout, per-trade rounding, fresh binding and simulation |
| Order book | East/Market/shared bookOrder and bookOrderPlan | Explicit BUY/SELL and outcome; YES-axis depth; gross/reserved/free inventory; partial fills, post-only/rest/expiry/match bounds; split/merge; cancel-by-ID; expired-head maintenance |
| Creation and liquidity | Demo creation, East useFactoryCreation, options-core factoryMarket; Factory reference prepare functions | Atomic bounded creation, admitted resolver/profile, frozen fees/terms, authoritative created address from event; state-bound sponsor entry and LP receipts |
| Portfolio and claims | factoryPortfolio and factoryTransactions | Separate AMM/book settlement, LP principal/fees, transferable receipt units, deferred book payouts, INVALID fractional carry, timeout refund versus adjudicated resolution fees |
| Roles and lifecycle | Factory NodeRoles/MarketFactory/vault/adjudicator artifacts; Alpha generic action builders | Role-correct creation policy, fee publication/claims, role transfers and node preparation/activation where the protocol exposes them; resolve/attest/dispute/settle/invalidate by supported adjudicator capability |
| Approvals and transaction outcomes | tokenApproval, receiptWait, afterReceipt; app request/receipt checks | Preserve reusable approval choices (the widget offers unlimited or exact for trades and LP deposits; planner limits stay finite), zero-first handling where required, distinct venue spenders, account/chain checks, exact receipt identity and decoded outcomes |

Do not generalize every action through ManualAdjudicator. Adjudicators are admitted separately from node releases. Retain explicitly supported adapters and refuse unknown capabilities.

Important invariants:

- No graduation-based venue switching. AMM and book are independent venues; identical collateral does not merge custody, approvals, balances or claims.
- Node-level book token; market-level AMM token. Shares and many AMM bounds are WAD; approvals, debits and payouts use native token precision. Test both 6 and 18 decimals and rounding boundaries.
- Zero net position does not mean zero ownership. Reserved shares/cash, spendable inventory, deferred payouts and INVALID carries are distinct.
- Use `isTradingOpen` and `isLiquidityOpen`, not `isLive`, for action gates. Resolution/veto behavior is release-specific; do not retrofit v7.2 semantics onto deployed v7/v7.1.
- Catalog/moderation state is product policy. Preserve each app's current exposure and exit behavior; do not make the SDK impose a single listing rule. Typed freshness facts can be shared.
- An approval does not relax the transaction's max-input/min-output bound. Refresh after approval before a trade. Request checks cannot prevent intervening chain changes; simulation and on-chain bounds remain required.
- Successful cancellation/maintenance receipts can indicate progress without cancelling the requested order. Decode events/results and reconcile state.
- Do not aggregate LP WAD principal with native fees without conversion or count recorded entitlements as extra transfers.

## Workstreams 1 and 2 — Protocol migration and client adoption

### P0 — Reconcile baseline and adopt ownership

Owner: SDK integration owner, with Alpha client review.

- Start implementation from the existing SQF-only cleanup lineage; preserve unrelated work in this checkout.
- Record a successor to SDK ADR-004: SQF remains, Factory production client is added, legacy core remains retired.
- Freeze the two live release records and exact artifact sources. Inventory all active consumer imports plus legacy test/tool references.
- Record a feature-to-consumer matrix for Demo, Mobile, Market, East, Admin, resolver, indexer, registry and tools. Treat archives as non-build content; migrate or retire obsolete runnable tests rather than restoring legacy exports.

Gate: one agreed dependency direction and versioned public boundary; every active caller accounted for; no claim that cleanup or npm publication has already happened beyond observed evidence.

### P1 — Establish release artifacts and portable foundations

Owner: SDK; Factory supplies artifact review. Depends on P0.

- Move portable identity and release types into the SDK. Remove SDK-to-Alpha imports by injecting environment configuration and using portable wire contracts.
- Generate reproducible v7 and v7.1 ABI sets from each pinned bundle. Alpha currently vendors a v7 bundle while serving both labels; common signatures are not proof of complete v7.1 support.
- Check exact bundle hash/interface/release binding. Include v7.1 resolver admission, early-resolution and maintenance capabilities where used. Pin adjudicator additions separately.
- Extract binding/anchor checks and numeric units from the strongest existing implementations. Compare variants before choosing one; do not discard stricter checks merely to reduce code.
- Produce a packed package usable from plain Node ESM and a browser build outside the Alpha monorepo.

Gate: correct reads and explicit unsupported-release refusal for both live identities; wrong chain/factory/release/wiring/token fixtures fail; browser package has no Alpha-only or Node-only runtime imports.

### P2 — Extract the production client and close feature gaps

Owner: SDK, with Alpha feature owners. Depends on P1.

Parallel slices after the shared types are fixed:

1. AMM/book plans, approvals and transaction preparation.
2. Market/inventory/LP/claim readers and receipt/event interpretation.
3. Catalog/indexer HTTP readers and wire types.
4. Creation, liquidity, role and adjudicator operations plus Factory CLI adapter.

Use Alpha's tested production paths as extraction inputs and Factory's pinned contracts/reference cases as independent behavior checks. Move consumer-visible boundary tests with the implementation. Keep app formatting, text, product defaults and wallet orchestration in Alpha. Do not copy reference-main v7.2 behavior into live-version adapters.

Gate: every required feature above has an implemented path and scenario, no stubs or synthetic success receipts. CLI smoke covers discovery, identity, reads, preparation, a local signed lifecycle and failure output through the same SDK APIs.

### P3 — Migrate every active Alpha consumer and remove duplicates

Owner: Alpha integration owner; SDK owns shared API changes. Depends on relevant P2 slices.

- First switch options-core's generic consumers and ui-hooks, then Demo/Mobile. This exercises both venues, LP and claim paths with the existing shared seam.
- Switch Market and East in parallel after the shared APIs stabilize. Replace their order math, binding checks, ABI copies and generic request/read helpers; retain product-specific screens, wallet runners and policy.
- Keep Market book-only, per ADR-131. Do not add an AMM trading surface as an SDK migration side effect.
- Switch resolver, Admin, registry, indexer and tools where they use moved generic types, ABIs or preparation logic. Do not move hosted service implementations into the SDK.
- Delete each superseded implementation and change all its callers in the same consumer slice. No long-lived forwarding exports from options-core or old core compatibility aliases.
- Keep dependency boundaries enforceable: applications may format values and orchestrate wallets, but must not maintain alternate protocol math, ABI bundles or node-binding rules.

Gate: active Factory protocol paths import the new SDK; only product logic remains local. All apps build from one packed SDK candidate, with no source-path escape into another repo. Existing wallet recovery, pending transaction identity and receipt-block refresh behavior survives.

### P4 — Prove behavioral parity and complete lifecycle coverage

Owner: SDK/Alpha integration owners. Depends on P2/P3; this is a release gate, not a later follow-up.

- Run existing Factory client/reference and Alpha financial/client/hook suites appropriate to the extracted code. Update tests for public behavior, not filenames, wording or copied implementation.
- Exercise actual SDK/CLI commands and real application surfaces against isolated deployments/forks for both supported release identities. Use both independent nodes and mixed/same collateral.
- Compare calldata, approval spender/budget, quote bounds, decoded receipts, token deltas, holdings, reservations and liabilities with direct contract reads at known blocks. Mocks alone are insufficient.
- Run the consumer matrix below. Reuse recorded scenarios where applicable, but rerun the new package path; historical reports are not proof of this migration.

| Consumer / layer | Required scenarios |
| --- | --- |
| SDK + CLI | Two-release discovery/read; unsupported release; create/AMM/book/cancel/settle/claim on local chain; terminal output and exit status |
| Demo | Market creation; AMM and CLOB buy/sell; split/merge; LP add/transfer/principal/fees; authorized lifecycle and role/config actions |
| Mobile | Same financial paths exposed by Mobile; embedded/external wallet adapters, reconnect, wrong account/chain, double tap, timeout/reload/pending recovery |
| Market | Book-only trade modal, depth/fills, resting and partially filled orders, split/merge, cancel, settlement/claims; listed/unlisted/disabled product behavior |
| East + resolver | Creation terms/canonical-market checks, AMM/book paths used by East, resolver admission, proposal/veto/reproposal/settlement, product-specific scheduling |
| Registry/indexer/Admin | Unchanged v2 wire behavior; block provenance and catalog revisions; selected source projections reconcile; moderation and platform permissions remain separate from on-chain roles |
| Negative/accounting cases | 6/18 decimals; same/different tokens; zero-net nonzero gross inventory; reservations; expired orders/head maintenance; dust; INVALID carry; timeout refunds; changed quote/state; stale catalog; RPC disagreement/outage; malformed or mismatched receipts |

Retain the existing app distinction between new exposure and exits during catalog outages. A successful UI notification is not settlement evidence. Real Privy authentication and public transactions were not established by all historical Mobile runs; mark any unexercised provider path explicitly and complete it before claiming full consumer validation.

Gate: independent chain evidence for migrated financial paths and actual UI/CLI observations; no loss of app functionality, no duplicated financial implementation, no unresolved supported-release mismatch.

### P5 — Release and consumer cutover

Owner: SDK release owner + Alpha release owner. Depends on P4.

- Inspect actual npm tags and release workflow state before selecting a version. The source declares 1.0.0 in Alpha, but this investigation did not establish whether it was published. Preserve SQF and apply semver to the actual published baseline.
- Update SDK package/README/API examples, ABI provenance, migration notes, CLI docs and Alpha's now-stale SDK ownership/migration documents. Update package checks that currently enforce SQF-only/no dependencies/no bin.
- Publish through the existing authorized `sooth` release process; pin Alpha's SDK gitlink/lockfile to that exact tested release. Do not depend on untracked workspace source.
- Record consumer build, SDK version, release records, service schema compatibility and validation evidence together. Deploy consumers in compatible order; API-neutral extraction should not require a service redesign.
- Rollback uses the prior Factory-capable SDK/app pair and preserves outstanding requests/positions. Do not roll back to the obsolete 0.6.1 core SDK or registry v1.

Gate: installed package works in a clean external consumer; Alpha uses the same release; docs and dependency checks name one production client owner; no duplicate financial implementation remains. Publishing and deployments are separate execution actions, not performed by this planning task.

## Workstream 3 — Embeddable frontend

### Product goal and current gap

A non-prediction-market application can place a complete Sooth node next to its own content. The host supplies the node reference and optional features/presentation settings. Sooth supplies catalog browsing, search, Open/Resolved/All filters, market selection and return, market facts, trading, wallet connection, transaction status, positions and claims.

Example host journeys: a news article includes related markets; a community adds predictions to an event page; an existing app offers markets without adding a separate trading section. Host-selected node browsing and explicit user creation are an accepted scope extension (ADR-006), superseding the original existing-market-only limitation. Creation and CLOB default off, while AMM remains available. Automated market creation from article text, cross-market aggregation and commercial revenue-sharing remain separate product work.

At research time no externally embeddable Factory widget was found in the inspected Alpha source. Local implementation now includes the hosted widget and reusable SDK React frontend, with different-origin signed-flow evidence recorded below. This does not establish a public hosted deployment. The original extraction requirement remains: Alpha's router, wagmi/AppKit, notifications and styling must not be prerequisites for external integration.

### Integration contract

| Integration | Host setup | Delivered behavior |
| --- | --- | --- |
| Hosted iframe, delivered first | Select a node and paste one generated HTML line; no npm, React provider or host wallet required | Self-contained node/market UI, isolated styles and widget-managed wallet flow |
| Native React component | Install package and configure trusted runtime; optional host wallet adapter | The same node/market experience in panel/drawer/modal form, with theme and event hooks |
| Headless hooks/protocol SDK | Supply application UI and wallet integration | Full control using the same reads, plans and transaction checks |

Native usage after installation/import and trusted runtime configuration (see the [README example](README.md#react-node-and-market-integration)):

```tsx
<SoothNode node={nodeRef} runtime={runtime} theme="auto" />
```

`nodeRef` identifies chain, factory, full node ID and supported release, with string form `sooth:node:v1:<chainId>:<factory>:<nodeId>:<releaseId>`. The runtime verifies binding and scopes catalog results to that node; catalog display facts do not replace live verified trading state. Host-selected `features.create` and `features.clob` both default to false; AMM cannot be disabled, and a `book` initial venue falls back to AMM when CLOB is off. Creation reuses fresh permissions/profile checks, fee and budget preview, bounded approval, explicit signing and receipt recovery before waiting for catalog indexing.

The generated iframe line contains a versioned widget URL, encoded node reference, feature/presentation settings, descriptive title and usable dimensions. It is executable only after a widget origin is deployed. Do not document a fictional working endpoint. One-line setup means one embed line after selecting a node; React still requires installation/import, and users still connect a wallet and confirm signatures. See [Alpha's private hosted integration guide](https://github.com/Tora-Build/sooth-alpha/blob/main/apps/embed/README.md) for the generator and independent article/native hosts.

`SoothNode` composes the existing selected-market experience; direct `SoothMarket` and the hosted `/v1/market` route remain supported independent integrations. Market references additionally select a market and explicit venue. The runtime must not accept arbitrary contract addresses or RPC endpoints from host messages or query parameters as trusted execution configuration. Native `panel` is the default; drawer (at most 480px) and modal (at most 960px) use native dialogs, Escape and focus restoration, becoming full-screen on narrow displays. Hosts can control `open`/`onClose`.

### Complete user journey

1. Load the question, resolution rules/source, closing time, lifecycle, token and selected venue. Show unavailable/stale data explicitly and offer a canonical market link.
2. Choose YES or NO and an amount. Present the current quote or order price, fees, maximum spend/minimum proceeds and any resting remainder. Never present an unfilled order as purchased shares.
3. Connect a wallet, select the required network and check funding. Explain insufficient funds; do not promise a fiat purchase or automatic funding integration that does not exist.
4. Obtain approval if needed (unlimited or exact, the user's choice), refresh the plan, simulate and request the trade signature. Confirm receipt identity and reconcile actual fills and balances.
5. Show the user's selected-market holdings, reserved inventory and open orders. Support selling and cancellation for the enabled venue.
6. After resolution, show the result and applicable claims. Preserve recovery for pending transactions, closed/reopened embeds and interrupted wallet flows.

The widget supports both live Factory releases. Node embeds always support AMM and optionally expose CLOB; direct market integrations select AMM or book explicitly. It must identify venue-specific holdings and approvals; no implicit aggregation or graduation routing. Advanced operator/LP administration remains available through SDK APIs and Alpha tools and is not required in the compact consumer widget.

### Wallet, host and presentation boundaries

- Hosted mode owns its wallet connection UI. An iframe cannot assume access to the parent page's injected wallet or login session. Use supported wallet connection methods and a user-initiated popup/top-level handoff where needed; prove the chosen provider's actual cross-origin behavior before declaring it supported.
- Native React mode can accept a host wallet adapter through an optional provider. Reuse the host connection without nesting competing wallet providers. SDK requests still check the account, chain, release, market and approval spender before signing.
- A handoff opens only a trusted Sooth origin and preserves the selected node, feature settings, market/action or creation view. Private keys never cross the embed boundary. Parent messages cannot sign or broadcast transactions. An approval, trade or creation broadcast before interruption remains pending until reconciled; reopening must not cause automatic resubmission.
- Treat cross-origin messaging as a small versioned interface: ready, resize, market opened, transaction submitted/confirmed/failed. Validate sender origin, source window, instance ID and payload. Emit transaction details only under the documented host-event option; do not expose wallet/session credentials.
- Support light/dark/automatic themes, a small set of color/radius variables, responsive layouts, keyboard navigation and accessible status/errors. Native CSS is scoped; iframe styles are isolated. No requirement for the host's router, Tailwind build, toast provider or query provider in default mode.
- Document frame policy, required popup/connect capabilities, storage behavior and browser support. Do not assume third-party cookies or iframe storage survive every browser configuration. Provide an explicit open-in-Sooth recovery path with the same market identity when embedded signing is unavailable.
- Show the market's identity and resolution rules honestly. Theme settings cannot change outcomes, fees, token labels or transaction bounds. Host curation selects what to embed; chain verification and the widget's declared exposure/exit policy remain enforced.

### Frontend delivery sequence

| Phase | Dependencies and owner | Deliverable and acceptance gate |
| --- | --- | --- |
| F0 — Define embed contract | P0/P1; SDK frontend owner with Alpha review | Market-reference schema, selected-venue behavior, theme/events API and wallet adapter contract. Choose exact existing app components/hooks to extract and document supported wallet/browser paths. |
| F1 — Extract reusable market UI | Relevant P2 APIs; SDK frontend owner | Portable hooks and components using SDK reads/plans. Isolated mounting with no Alpha router, global CSS, app state or private workspace imports. Preserve relevant financial and recovery protections. |
| F2 — Deliver hosted embed | F1; Alpha widget host owner | Thin hosted application and snippet generator. A plain HTML article page on a different origin renders a market from one line and completes wallet/trade/exit/claim flows, including required handoffs. |
| F3 — Deliver native React integration | F1; SDK frontend owner; follows the hosted integration milestone | `sooth/react` component works in a clean external app with managed defaults and with a supplied host wallet. Reuse the same UI and protocol logic, not a second implementation. |
| F4 — Adopt and prove | F2/F3 and P4; frontend and Alpha owners | Suitable Alpha surfaces use the reusable components/hooks. Preserve Market's book-only policy and Mobile's wallet behavior. Run the external-host acceptance matrix below. |
| F5 — Release frontend product | F4 and tested protocol package; release/hosting owners | Versioned npm frontend entry point, hosted route, copyable snippet, integration docs and support matrix. Pin widget build to the tested SDK/release set and keep a compatible rollback. |

F0 design and UI isolation can proceed alongside protocol extraction once interfaces are fixed. A protocol package may be released before the frontend, but that does not complete the combined plan. A frontend redesign of all Alpha apps is not required; shared financial components should be adopted where their behavior fits.

Node-extension verification is recorded separately in [STATUS.md](STATUS.md#node-embed-extension-2026-10-17): SDK build, React suites with the targeted creation-fixture rerun, Alpha embed tests/builds, native presentation/browser checks and the final packed external host have supplied evidence. Scoped signed local UI creation, AMM buy/sell, native host-adapter sale and book placement/cancellation are complete. Test-signer, local-catalog and environment-repair limits are recorded there; this is not real extension authentication or deployed-indexer acceptance. Existing signed single-market evidence below is retained with its original scope.

### External-host acceptance matrix

| Scenario | Required evidence |
| --- | --- |
| Plain HTML news/community page on another origin | One generated iframe line, no Alpha/npm setup, real data and usable narrow/wide layout; no host styling interference |
| Clean React application | Installed release candidate and component import work without private workspace links; SSR-capable hosts can import safely and mount interactive UI on the client |
| Two live releases and both venue modes | Correct market identity, collateral and supported capabilities; wrong or unsupported references refuse signing |
| New user | Market visible before connecting; wallet/network flow works; insufficient funds has a clear state; approvals and trade require explicit signatures |
| Financial lifecycle | Buy, sell, resting/partial-fill order, cancellation and settlement claim where applicable; decoded receipts and independent token/inventory deltas agree |
| Recovery | Close/reload host during wallet approval and after broadcast; blocked popup, rejected signature, switched account/network and RPC outage; no duplicate submission or lost pending identity |
| Browser/host boundary | Supported desktop/mobile wallet paths; third-party storage restrictions; exact-origin message validation; two independent widgets on one page do not cross accounts, markets or pending state |
| Accessibility and presentation | Keyboard operation, focus restoration after dialogs/handoffs, readable errors, light/dark themes, narrow screens and host CSS isolation |
| Alpha adoption | Selected Alpha screens use the same components/hooks with existing product policies; no copied widget-specific financial logic |

Run actual browser flows on a separate host origin and validate local-chain/fork transactions independently. Recorded Alpha tests and a same-origin component preview do not prove embedding. Report wallet/provider paths not exercised and do not label them supported until verified. Public deployment, provider configuration and publication are execution steps not performed by this plan.

Frontend completion means an unrelated application can embed a market with minimal setup and its user can trade, recover a pending operation, exit and later claim. A read-only card, a link to a trading app or a component requiring Alpha's providers is not the complete deliverable. A wallet handoff may leave the frame when the provider requires it; that limitation must be explicit in the integration documentation.

## Scope boundaries and risks

- This plan does not revive core nodes or old claims; ADR-130 explicitly retired that requirement. Historical core code stays in Git history.
- Convoke/Binary and other repositories may need the same SDK later, but their code changes are not implied by the Alpha request. Publish a portable API without silently adding those migrations to this work.
- The current Factory reference SDK is a local acceptance adapter, not a replacement production indexer or a complete browser wallet runner.
- Protocol-equivalent ABI signatures can hide different release semantics. Preserve release dispatch and pinned conformance cases even when implementation code is shared.
- Extracting catalog types can introduce a registry↔SDK dependency cycle. Make the SDK portable first, then let Alpha reuse types; never publish a dependency on private `@sooth/registry`.
- Existing app copies may have different fixes. Diff behavior and retain consumer-visible protections before deleting copies; do not assume identical names mean identical behavior.
- The protocol migration requires no contract upgrade or source-main v7.2 cutover. The frontend workstream adds a new hosted widget deployment and reusable UI; it does not require redesigning every Alpha application.

## Evidence and completion rule

The research baseline above used local source/decision records, exact checkout/gitlink revisions and a live read-only v2 status response. Implementation and local validation subsequently ran. The following retained results supersede the original statement that no code, tests or wallet flows had changed; they do not close every P0–P5/F0–F5 gate.

### Local implementation and checks (2026-10-16)

The SDK now owns the extracted reusable Factory protocol client and optional React frontend; Alpha adopts that shared implementation while retaining product policy, wallet orchestration, hosted services and the widget host. SQF root/subpath behavior remains, and legacy core APIs remain retired. Source repairs covered review invalidation on polling, exact creation-log provenance, cross-window Web Locks, edited-approval reconciliation, stale-intent cancellation, conditional timeout refund, Manual optional attestation and exhausted-claim UI eligibility. The exhausted-claim fix passed actual 375px widget observation with zero holdings, no claim button and no overflow. After two-tab failure evidence, source changes added immediate `ifAvailable` lock refusal and a final pending check before send; durable save retires memory fallback so remote removal is authoritative. Actual final-module two-window mechanism checks subsequently passed as detailed below; the original timing cause remains unproven.

| Layer | Retained result | Evidence limit |
| --- | --- | --- |
| SDK | Final build and full 29-file/522-test suite passed after the cross-window source repair (retained runner artifact 332); earlier full 517/503, targeted 192 including 10 component tests, and Manual optional attest 45 passed | Supersedes earlier suite counts; actual two-window mechanism proof is separately scoped below |
| Package hygiene | Final lint, formatting and package smoke passed; 180 packaged files (retained runner artifact 332); final candidate repacked and installed in both external consumers | SHA256 `a3b6a879c1a316042f13c052546df6cca665e69cd34735390a58a6d26c1014aa`; no npm publication |
| Alpha tests | Market 54; full Demo 36 files/529 tests; Mobile 9 files/83 tests; Indexer 13 files/143 tests passed; earlier Demo fixture/Operator 41/29 and Mobile profile 15 passed | Admin 15 files/119 passed, 14 database-environment skips: no full persistence proof |
| Alpha builds | Market/East builds and bundle guards passed in retained archive; clean Demo production build passed using `SOOTH_DEMO_ENV_DIR`, then 187-file bundle scan passed; Indexer typechecking passed; hosted embed typechecking/Vite build passed (506 modules, 761.78 kB entry / 176.07 kB gzip, chunk warning only) | Does not establish deployed builds |
| External React | Final installed candidate production typecheck/Vite build passed: 527 modules, 767.06 kB entry / 177.27 kB gzip, chunk warning only (retained job bg88); earlier SSR import passed | [Preparation metadata](/tmp/sooth-external-react-Y7jDWI/preparation.json) records final tarball hash/install; SSR result is scoped to the earlier candidate |
| External Node | Final candidate protocol/SQF imports passed with React, React DOM and React Query absent | [Import result](/tmp/sooth-external-node-jFPGFc/import-smoke-result.json); candidate still declares 1.0.0 |

### Signed local and actual UI evidence

Fixture evidence lives locally in [/tmp/sooth-sdk-migration-74d73071](/tmp/sooth-sdk-migration-74d73071), on a dedicated chain-46630 fork starting at block 134210557. These absolute links are workstation evidence, not published artifacts or public-chain acceptance.

Temporary dev/test signer services and browser tabs were stopped. The fork was saved
to [final Anvil state](/tmp/sooth-sdk-migration-74d73071/final-anvil-state.json) before
shutdown. Throwaway scripts were removed; JSON receipts/proofs and the external
candidate were retained. The local checks recorded here are finished; the broader
release/provider gates below remain open.

| Scenario | Observed result / retained artifact |
| --- | --- |
| CLI | Actual approve → split 1 → merge 1: actor 5 USDG balance 10000 → 9999 → 10000, inventory 0 → 1 YES + 1 NO → 0; [smoke proof](/tmp/sooth-sdk-migration-74d73071/cli-smoke-evidence.json), [split receipt](/tmp/sooth-sdk-migration-74d73071/cli-split.json), [merge receipt](/tmp/sooth-sdk-migration-74d73071/cli-merge.json). This is not full CLI lifecycle coverage. |
| A — Demo AMM | Buy 2 NO, sell 1, finite 1000 USDG approval; [token proof](/tmp/sooth-sdk-migration-74d73071/A-creator-NO-buy-sell-token-proof.json) |
| B — LP/book setup | Two LP classes and book settlement preconditions; [proof](/tmp/sooth-sdk-migration-74d73071/B-creator-two-LP-classes-and-settlement-book-preconditions.json) |
| C — Book/lifecycle | Partial fills and actual guardian veto; [proof](/tmp/sooth-sdk-migration-74d73071/C-taker-partial-fills-and-actual-guardian-veto.json) |
| D — Recovery | Optional attestation initially failed; SDK/UI repaired, then real UI attestation and settlement recovered; [original failure/run](/tmp/sooth-sdk-migration-74d73071/D-creator-cancel-expiry-repropose-attest-settle.json), [recovery advance](/tmp/sooth-sdk-migration-74d73071/D-recovery-advance.json), [settled proof](/tmp/sooth-sdk-migration-74d73071/D-recovery-settled.json) |
| E — INVALID/LP | AMM/book payouts and sequential fees/principal for two LP classes passed; [proof](/tmp/sooth-sdk-migration-74d73071/E-creator-INVALID-payouts-sequential-LP-fees-principal.json) |
| F/G — Timeout | Outsider timeout and refund/book payout passed; [F proof](/tmp/sooth-sdk-migration-74d73071/F-outsider-permissionless-timeout-INVALID.json), [G proof](/tmp/sooth-sdk-migration-74d73071/G-taker-timeout-resolution-fee-refund-and-book-payout.json) |
| Widget and hosts | Exact approval, resting orders 3/5/6 and cancellation; article origin 5181 used popup 5180 to sign order 5 and notify the host; native React origin 5182 managed cancellation of 5 and host-adapter placement/cancellation of 6; [external-flow proof](/tmp/sooth-sdk-migration-74d73071/widget-external-final.json) |
| Widget claims | Timeout refund 0.0008 USDG (800 native) and INVALID payout 0.5 USDG (500000 native), consuming 1 YES with zero final holdings; [claim proof](/tmp/sooth-sdk-migration-74d73071/widget-claims-proof.json) |
| Exhausted-claim presentation | Actual 375px viewport: document scroll width 375px, host 351px/content 349px; zero holdings showed no new claim action and no horizontal overflow. Explicit [dark screenshot](/var/folders/v4/nqrzydc930j241ccxy2gh1q80000gn/T/omp-sshots-15a8a261f720f3e5.webp) and [light screenshot](/var/folders/v4/nqrzydc930j241ccxy2gh1q80000gn/T/omp-sshots-15a8a26fbfa0f3e7.webp) retain this scoped presentation evidence; this does not establish full accessibility acceptance. |
| Two-window mechanism/recovery | Final loaded module: A made one synthetic-adapter call while blocked at the gate after real SDK binding/`eth_call`; B immediately refused with “Another window”, zero adapter calls and no queue. A released a synthetic hash and persisted full identity; reload retained exact reference/account/chain/to/data/hash. B's explicit retry made zero adapter calls and refused the pending action. Removing the synthetic record in B left A's fresh load empty without memory resurrection. [Lock proof](/tmp/sooth-sdk-migration-74d73071/lock-proof-after.json), [recovery proof](/tmp/sooth-sdk-migration-74d73071/lock-recovery-after.json). No broadcast or synthetic successful receipt is claimed; this proves the mechanism only. A repeated run initially loaded cached browser code despite Vite `--force`; acceptance used a cache-busted final module. |

Market's actual UI rendered, but synthetic local trading was blocked by its public pinned RPC; no guard bypass was used. East's actual Sepolia v7 settled drawer and AMM/book reads passed smoke coverage; signed local flows require a matching Sepolia fixture. Neither observation is a substitute for signed acceptance of those consumers.

### Remaining acceptance gaps

Mobile's actual local UI on port 5183 connected actor 5 and rendered market and portfolio without application JavaScript errors; no signing or Privy was exercised. The fork settled while the portfolio loaded, so rendered holdings are not proof of current balances. Retained screenshots: [market](/var/folders/v4/nqrzydc930j241ccxy2gh1q80000gn/T/omp-sshots-15a8a0471bea26fb.webp), [portfolio](/var/folders/v4/nqrzydc930j241ccxy2gh1q80000gn/T/omp-sshots-15a8a08be0aa26fd.webp).

The exhausted-claim visual check, final candidate repack/install/build and actual final-module two-window mechanism checks passed. The original first race's browser storage timing cause remains unproven. The scoped concurrency evidence above uses a synthetic adapter/hash and does not establish signed concurrent transactions or the full cross-browser matrix. Real wallet extensions/Privy, public writes and the complete recovery matrix remain incompletely exercised. The consumer and external-host matrices remain requirements without blanket completion marks. No migration npm publication, deployment, commit or gitlink pin has occurred; P5/F5 and the public release/provider gates remain open. Hosted embed production-environment guard coverage passed 20 tests; its test is now named `productionEnv.spec.ts` and included in CI.

The protocol migration is complete only when the published Factory SDK covers both live releases, all selected Alpha consumers use it, their full financial workflows pass through it, and the superseded client logic is removed. A new package that Alpha can continue to bypass is not completion. The combined plan also requires the hosted embed and native React integration to pass the external-host acceptance matrix, with suitable Alpha adoption and one shared financial implementation.
