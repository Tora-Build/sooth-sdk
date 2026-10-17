---
name: sooth-protocol
description: Create, inspect, trade, resolve, settle and claim Sooth Factory prediction markets with the sooth SDK and CLI. Use for agent workflows that interact with Sooth markets or format their resolution rules as SQF.
metadata: { "openclaw": { "homepage": "https://github.com/Tora-Build/sooth-sdk" } }
---

# Sooth Protocol

Use the `sooth` SDK and its Factory CLI. This skill replaces the older
SoothSayer agent skill. Market creation, trading and resolution use Factory
releases, not the old LaunchpadEngine or TruthMarket interfaces.

## Availability and setup

The published `sooth@1.0.0` contains SQF only. Factory APIs, the CLI and this
skill are local integration work until a new package release is published.
Use a built checkout or its packed package for these workflows. Do not assume
that installing the current npm release provides Factory commands.

From the `sooth-sdk` checkout, use Node.js 22+ and its pinned pnpm version:

```sh
pnpm install --frozen-lockfile
pnpm build
node bin/soothcli.js --help
node bin/soothcli.js actions
```

`actions` prints the current JSON fields and types for every supported action.
Run the examples below from this checkout. A packaged installation exposes
`soothcli` as its executable.

## Select and verify the deployment

Obtain the intended chain ID, Factory address, full bytes32 node ID, account,
release record and at least two independent trusted RPC endpoints from the
host's configuration. Select the exact supported release; never guess an
address from the project name or reuse an old deployment table.

`SUPPORTED_FACTORY_RELEASES` in `sooth/factory` contains the pinned v7/v7.1
release records. The CLI's `--release` file accepts one such record or Alpha's
release seed document. Unsupported releases require an SDK update.
Catalog results help discover markets; they do not choose trusted RPCs,
contracts or signing authority.

Set these shell variables from that configuration before running CLI examples:
`CHAIN_ID`, `FACTORY_ADDRESS`, `NODE_ID`, `RELEASE_FILE`, `RPC_A`, `RPC_B`,
`ACCOUNT_ADDRESS` and, for an existing market, `MARKET_ADDRESS`.

```sh
node bin/soothcli.js identity \
  --chain "$CHAIN_ID" --factory "$FACTORY_ADDRESS" --node "$NODE_ID" \
  --release "$RELEASE_FILE" --rpc "$RPC_A" --rpc "$RPC_B"

node bin/soothcli.js read \
  --chain "$CHAIN_ID" --factory "$FACTORY_ADDRESS" --node "$NODE_ID" \
  --release "$RELEASE_FILE" --rpc "$RPC_A" --rpc "$RPC_B" \
  --market "$MARKET_ADDRESS" --venue amm --account "$ACCOUNT_ADDRESS"
```

SDK equivalents are `verifyFactoryNode` with `anchorEndpoints`, then
`readFactoryMarketSnapshot`, `readFactoryPositions`, `readFactoryBookInventory`
and `readFactoryQuote`. Use explicit clients and verified context. Check
market binding, trading state, deadline, collateral decimals, adjudicator,
settlement state and venue before planning an action.

## Write the question and resolution rules

Use SQF to preserve the exact question and rules. Specify the observation
source, cutoff time, YES/NO criteria and invalid-case policy before creation.
SQF formats text; it does not validate the evidence or decide an outcome.

```js
import { generateSQF, parseSQFSafe } from 'sooth/sqf';

const prediction = {
  question: 'Will the published index exceed 100 at the cutoff?',
  rule: {
    description: 'YES if the final published value exceeds 100; NO otherwise.',
    source: 'The index publisher named in the market agreement',
    cutoff: '2027-01-01T00:00:00Z',
    invalid: 'The publisher has not published a final value by the cutoff.',
  },
};
const sqf = generateSQF(prediction);
const parsed = parseSQFSafe(sqf);
```

Supported sections are `§question`, `§rule`, `§event`, `§category` and `§meta`.
Keep the exact SQF bytes when binding a resolution mandate or hashing terms.

## Create a market

Check current creation permissions, allowed collateral and allowed adjudicators.
Select a pinned adjudicator binding and its capabilities. For a custom/local
binding, supply `--adjudicator <json-file>`; do not infer its ABI or profile.

Use `buildResolutionTerms` from `sooth/factory/creationTerms` to encode the
selected resolver's terms and `adjudicatorConfig`. For creation planning, the optional
`sooth/react` entry point provides `readSoothCreationOptions` and
`planSoothCreation`. It requires the host's trusted runtime configuration.

The CLI `create` command accepts a `FactoryCreationParams` JSON object directly.
Use `actions` → `createMarket.params` for the complete field list:

- `question`, `startTime`, `deadline`: exact SQF and Unix seconds.
- `adjudicator`, `adjudicatorConfig`, `resolutionTermsHash`, `expectedProfileHash`:
  the selected binding and encoded resolution terms.
- `tokenA`, `bBase`, `initialProbabilityWad`, `maxInputNative`, `quoteDeadline`:
  collateral, liquidity, initial price and a fresh bounded funding quote.
- `expectedAmmVersion`, `expectedBookVersion`, `expectedAmmHash`,
  `expectedBookHash`, `expectedInvalidationBuffer`: current verified node state.

Do not fill expected hashes with zeroes or copy them from a different node.
Encode bigint values as decimal strings in JSON. If collateral approval is
needed, prepare and submit a separate `approveCreation` action, then prepare
creation again using fresh state.

Save the reviewed parameters as `creation.json`, then prepare without signing:

```sh
node bin/soothcli.js create \
  --chain "$CHAIN_ID" --factory "$FACTORY_ADDRESS" --node "$NODE_ID" \
  --release "$RELEASE_FILE" --rpc "$RPC_A" --rpc "$RPC_B" \
  --venue amm --account "$ACCOUNT_ADDRESS" --input creation.json
```

Creation has no `--market` yet. After authorized submission, use the market
address decoded from the verified Factory creation receipt. Store that address
with the chain, Factory and node identity if the host tracks external predictions.

## Trade and manage positions

Outcomes are `0 = NO`, `1 = YES`, `2 = INVALID`. Trading accepts NO or YES.
Keep AMM and book balances, spenders, approvals and claims separate.

- AMM: use `planAmmTrade` for a fresh bounded quote, then `trade` with
  `outcome`, signed `deltaShares` and `boundWad`. Positive shares buy;
  negative shares sell. The bound is maximum cost for buys or minimum proceeds
  for sells, in WAD. It is not the native collateral approval amount.
- Book: use `planBookOrder`, then `book` with `OrderParams` JSON. `actions`
  lists the exact fields. `maxTokenIn` and `minTokenOut` use native token units;
  do not assume the book token has the same decimals or share unit as AMM.
  Cancel with `cancel` and `{"orderId":"..."}` using the real order ID.
- Approvals: use a separate `approve` action with the intended venue and finite
  `amountNative`. Rebuild the spending action after the approval receipt.
  `--zero-first` is available only for explicit approvals that need it.
- Book inventory includes gross YES/NO balances and reserved shares. Zero net
  exposure does not mean the position is empty.

Use `prepare --input action.json` for a generic action object, including its
`kind`. Dedicated `trade` and `book` commands take their fields directly,
without a `kind` wrapper. Select `--market` and `--venue` explicitly.

## Resolve, settle and claim

Resolution depends on the verified adjudicator adapter's capabilities and the
caller's role. A research conclusion alone does not grant settlement authority.
Use `getFactoryAdjudicatorAdapter` and the market snapshot to select valid steps.

- Manual/profile-dependent resolution uses supported `resolve`, `attest`,
  `veto`, `settle` or `invalidate` actions. Supply real evidence and respect
  the deadline, guardian window and required caller. `settle` is an adjudicator
  action; the CLI command named `settle` instead prepares `settlePosition`.
- For `swarm-expert-sqf`, verify the accepted network report first. Use
  `prepareSwarmAcceptance` to register `acceptMandate` before creation, and
  `prepareSwarmCreationConfig` for the exact SQF. After the deadline,
  `prepareSwarmJudgment` provides `recordCall` then `resolveCall`, in that order.
  These helpers encode calls; they do not fetch reports or prove consensus.
  The profile needs an explicit trusted binding and has no default deployment.
- After market settlement, use `settlePosition` for each venue, then select
  eligible `claim*` or LP redemption actions from current state. Do not promise
  a payout until its actual receipt and resulting balance are checked.
- A missing report or unresolved market is not an INVALID outcome by itself.
  Timeout refunds and invalidation require their on-chain eligibility conditions.

There is no old `settle(outcome, tStar)` → `finalize()` workflow here.

## Submit and recover transactions

Preparation does not broadcast. For an authorized send, use `action` or the
appropriate dedicated command with the same reviewed identity/input flags,
plus `--send --wallet-env SOOTH_WALLET_KEY`. The named environment variable
must already hold the signing key. Never print a key, put it in arguments or
commit it. Confirm the account, chain, venue, spender, token units and bounds.

Persist the CLI's submission record and transaction hash. A receipt timeout
means pending; recover the existing transaction before considering another send.
Use `action --receipt "$TX_HASH" --input saved-submission.json` with the same
identity, RPC, market and venue flags. This inspects the saved submission rather
than preparing it again.

For SDK integrations, `buildFactoryTransaction` freshly verifies and simulates
the request but does not submit it. Submit through the host wallet, correlate
the canonical receipt with `assertFactoryTransactionReceipt`, and require
`receipt.status === 'success'` before reporting success. The assertion also
accepts correlated reverted receipts for recovery; it does not check success.
For creation, use `decodeFactoryCreatedMarket` only on that validated successful
receipt. A hash or a successful simulation alone is not a successful operation.
