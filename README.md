# sooth

Sooth Factory protocol APIs, an optional React node and market interface, a CLI, and
protocol-neutral Sooth Question Format (SQF) utilities.

The Factory and frontend additions in this checkout are under local integration.
The published 1.0.0 release contains SQF only. Do not assume the new entry points
are available from npm until a release is published.

## Package boundaries

| Import | Purpose |
| --- | --- |
| `sooth` or `sooth/sqf` | SQF parsing and generation; unchanged root API |
| `sooth/factory` | Factory verification, reads, financial plans and transaction preparation |
| `sooth/factory/abis` | Pinned Factory ABI sets and explicit release selection |
| `sooth/factory/data` | Catalog and indexed-data readers |
| `sooth/factory/schema` | Portable identity, release and wire types/validators |
| `sooth/react` | Node and market components, runtime, wallet adapters and embed helpers |
| `sooth/react/factoryHooks` | Optional React Query adapters |

Alpha consumes this package through `@sooth/sdk` with
`"@sooth/sdk": "workspace:sooth@*"`. External consumers use `sooth`.
The protocol APIs depend on viem. React, React DOM and React Query are optional
peers used only by their frontend entry points. No Alpha workspace dependency
is required by the SDK.

## Factory clients

Supported artifacts are pinned for `sooth-factory-v7` and `sooth-factory-v7.1`.
Use an exact deployment/release record and trusted RPC endpoints selected by
your application. Registry responses do not select trusted RPCs or signing
contracts. The current Factory source branch is not an automatic ABI upgrade.

```ts
import {
  SUPPORTED_FACTORY_RELEASES,
  anchorEndpoints,
  verifyFactoryNode,
} from 'sooth/factory';

const release = SUPPORTED_FACTORY_RELEASES.find(
  candidate => candidate.chainId === chainId &&
    candidate.factory.toLowerCase() === factory.toLowerCase(),
);
if (!release) throw new Error('Unsupported Factory deployment');

const context = await verifyFactoryNode({
  identity: { chainId, factory, nodeId },
  release,
  endpoints: anchorEndpoints(chainId, trustedRpcUrls),
});
```

`chainId`, `factory`, full bytes32 `nodeId` and `trustedRpcUrls` above are
application configuration. Use at least two independent endpoint sources.
Two aliases of one local fork are suitable only for controlled local testing;
they do not establish independent production agreement.

Readers use verified node context and explicit clients. Financial plans keep
WAD shares/bounds separate from native token approvals and payments.
`buildFactoryTransaction` prepares a request after fresh binding verification;
it does not submit it. The application simulates, obtains a wallet signature,
and validates the actual canonical receipt before reporting success.

AMM and book are separate venues. Preserve venue-specific tokens, spenders,
positions and claims even when the collateral token addresses match. Book
ownership includes gross YES/NO balances and reservations; a zero net balance
is not an empty position. Unsupported releases and adjudicator capabilities
must be handled explicitly.

## Expert swarm resolution

The local `swarm-expert-sqf` profile uses a trusted relay to record the network's
accepted research reports. It preserves the complete SQF and permits subjective
judgment and unrestricted research. It does not require an IMD oracle certificate.
The profile is not deployed or included in the published SQF-only package.

Use `prepareSwarmAcceptance` to bind the intended creator, relay, exact SQF,
deadline, job ID and report hash. Register that acceptance before creating a
market with `prepareSwarmCreationConfig`. After the deadline,
`prepareSwarmJudgment` produces `recordCall` and `resolveCall`, in that order.
Settlement uses the existing guardian veto window. A veto requires a fresh job
and report; missing results are not settlement outcomes.

These helpers are offline encoders. The caller must first verify the accepted
network report and its decision. Job IDs use SHA-256 of canonical lowercase UUID
text; report hashes use SHA-256 of the original bytes. The relay is a settlement
authority, and artifact hashes do not prove IMD authenticity or panel consensus.
Use an explicit trusted profile binding; there is no default swarm deployment.
The generic transaction builder and CLI also support `acceptMandate` and
`recordJudgment`; `soothcli actions` shows their fields.

## React node and market integration

`SoothNode` embeds a host-selected node: browse and search its catalog, filter
Open/Resolved/All, open a market, then return to the list. Catalog facts retain
their provenance; opening a market obtains the verified trading state.

Configure a trusted runtime once. The native component assumes neither Alpha
endpoints nor a host wallet framework:

```tsx
import {
  SoothNode, createSoothRuntime,
  type SoothNodeReference, type SoothRuntimeConfiguration,
} from 'sooth/react';

export function createArticleMarkets(config: SoothRuntimeConfiguration) {
  const runtime = createSoothRuntime(config);
  return function ArticleMarkets({ node }: { node: SoothNodeReference }) {
    return <SoothNode node={node} runtime={runtime} theme="auto" />;
  };
}
```

Supply application-trusted `releases`, `chains` (including at least two independent
RPC URLs per chain), `catalogUrl` and `canonicalOrigin` in `config`. A node reference
contains `chainId`, `factory`, full `nodeId` and `releaseId`; its string form is
`sooth:node:v1:<chainId>:<factory>:<nodeId>:<releaseId>`. Catalog data, URL parameters
and host messages cannot supply trusted RPC endpoints or contract authority.

`features={{ create: true, clob: true }}` enables market creation and order-book
trading. Both flags default to `false`; AMM trading is always available. A `book`
`initialVenue` falls back to AMM when CLOB is disabled. `initialMarket` selects a
market within the configured node. Creation uses current permissions, supported
profiles and fee/budget previews, bounded approval and a separate explicit create
action; a confirmed market waits for catalog indexing before opening.

`presentation` defaults to `panel`; `drawer` and `modal` use native dialogs with
Escape dismissal and focus restoration. Drawers are at most 480px wide and modals
960px; both fill narrow screens. Use `open` and `onClose` for host-controlled
visibility. Theme and `appearance={{ accent, radius }}` customize scoped styles.
Neither a router nor a React Query provider is required. A shared runtime can
also be supplied through `SoothProvider`; query hooks live in
`sooth/react/factoryHooks`.

Direct `<SoothMarket market={marketRef} runtime={runtime} />` remains supported
for independent single-market integrations. Its reference additionally includes
the market address and explicit `amm` or `book` venue; it does not require a node
browsing shell. `generateSoothEmbed` remains the direct-market snippet helper.

For HTML/CMS hosts, Alpha's [hosted embed documentation](../sooth-alpha/apps/embed/README.md)
describes the node generator, one-line iframe, host containers and wallet handoff.
No public widget deployment is implied by this checkout.

Native mode accepts a `wallet` adapter and rechecks account, chain and transaction
identity before signing. An iframe cannot assume access to the parent site's
wallet; hosted mode uses a user-initiated trusted-origin handoff preserving node,
feature settings and selected market/action (or creation view). Host messages
cannot request signatures. Pending approvals, trades and creation transactions
must be reconciled after interruption rather than automatically resubmitted;
users still explicitly approve signatures. Only enabled, validated widget events
are exposed to the host.

## CLI

Build the package, then inspect the command contract:

```sh
node bin/soothcli.js --help
```

The CLI supports catalog discovery, verified identity/read/quote commands,
transaction preparation and explicit signing. Supply `--chain`, `--factory`,
`--release <json-file>` and `--node` where applicable. Chain operations require
repeatable trusted `--rpc` endpoints; market operations select `--market` and
`--venue`. The release file can be one release record or Alpha's full release
seed document.

Actions accept JSON through `--input <file>` or `--input -`; integer token/share
amounts are decimal strings. Preparation is the default. `--send` explicitly
enables submission and `--wallet-env <name>` reads a private key from the named
process environment variable. Never pass a key as a command-line argument or
commit it. A timed-out pending hash is not a failed transaction; use the receipt
recovery path in `--help` before attempting another send.

## SQF

```ts
import { generateSQF, parseSQFSafe, type SQFData } from 'sooth/sqf';

const data: SQFData = {
  question: 'Will X happen?',
  rule: { description: 'Resolves YES if X.', source: 'example' },
};
const text = generateSQF(data);
const parsed = parseSQFSafe(text);
```

The root and `/sqf` export `parseSQF`, `generateSQF`, `extractQuestion`,
`parseSQFSafe`, `SQFData` and `SQFRule`. Supported sections are `§question`,
`§rule`, `§event`, `§category` and `§meta`. These functions format text; they do
not validate resolution rules or decide outcomes. SQF calls make no network
requests and do not import the Factory or React layers.

## Migration and development

Legacy `sooth/core` subpaths, core client classes, registry v1 and old scenarios
remain retired. Factory APIs do not reinterpret old core deployment addresses.
The new CLI targets Factory explicitly. Keep versioned deployment identities
when moving consumers.

Use Node.js 22+ and the pinned pnpm version:

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm typecheck
pnpm test
pnpm build
pnpm test:package
```

See [FACTORY_MIGRATION_PLAN.md](./FACTORY_MIGRATION_PLAN.md) for the three
workstreams and acceptance matrix, [TEST_PLAN.md](./TEST_PLAN.md) for runtime
verification, and [DECISIONS.md](./DECISIONS.md) for package ownership.
