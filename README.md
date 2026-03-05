# Sooth Core Unified Engine

Single reference for protocol interaction logic across all app surfaces (Demo, Lens, Telegram, and future apps).

## Purpose

The protocol is intentionally flexible, but frontend logic must not drift.

This layer exists to guarantee:

1. No missing features.
2. No missing calculations.
3. No missing protocol know-how.

## Scope

The unified engine covers all core contracts:

- `LaunchpadEngine`
- `AMMEngine`
- `TruthMarket`
- `Collateralizer`
- `SoothBook`

Current rollout:

- Telegram is the live integration testbed ("white rat").
- Demo and Lens are reference inputs for parity audit and future migration.

## Canonical Source Files

Protocol logic in SDK:

- `packages/sdk/src/core/contracts/launchpadAmm.ts`
- `packages/sdk/src/core/contracts/soothCore.ts`
- `packages/sdk/src/core/contracts/index.ts`
- `packages/sdk/src/core/abis/index.ts`

Contract truth:

- `packages/contracts-core/src/LaunchpadEngine.sol`
- `packages/contracts-core/src/AMMEngine.sol`
- `packages/contracts-core/src/Collateralizer.sol`
- `packages/contracts-core/src/SoothBook.sol`
- `packages/contracts-core/src/libraries/DecimalMath.sol`

## Non-Negotiable Invariants

### 1) Outcome Encoding

- `0 = NO`
- `1 = YES`
- `2 = INVALID`

This encoding is protocol-wide and must never be remapped in app code.

### 2) Signed Shares and Trade Guards

For Launchpad/AMM trade:

- Buy -> `deltaShares > 0`
- Sell -> `deltaShares < 0`
- Guard arg is `maxCostOrMinProceeds`:
  - Buy: max cost ceiling.
  - Sell: min proceeds floor.

SDK builder:

- `buildLaunchpadTradeRequest(...)`

### 3) Fee Composition

Launchpad fee is layered over AMM quote:

- Base quote from `AMMEngine.getPositionQuote`.
- Fee bps selected by market stage:
  - pre-graduation: `preGradFeeBps`
  - post-graduation: `postGradFeeBps`

SDK function:

- `readLaunchpadAmmQuote(...)`

### 4) Venue Selection

SDK chooses venue via `selectTradingVenue(...)`:

- If settled/finalized -> non-trading state in UI flow, AMM settlement/redeem domain.
- If graduated and active SoothBook -> `soothbook`.
- Else -> `amm`.

### 5) Claim Routing

Claim logic must route by lifecycle, not by app guesswork:

1. Dismissed trial market -> `LaunchpadEngine.claimRefund`.
2. Settled pre-graduation AMM position -> `AMMEngine.settlePosition`.
3. Graduated collateral-token domain -> `Collateralizer.redeemOutcome`.
4. SoothBook token domain -> `SoothBook.redeem`.

Telegram hook implementation:

- `apps/telegram/webapp/src/hooks/useClaim.ts`

## Decimal and Unit Handling

Decimal handling is a critical part of parity.

### Internal Unit Standard

- Internal economic values are treated as WAD (`1e18`) in SDK math:
  - shares
  - quote amounts
  - fee amounts
  - slippage guards

### Contract Boundary Rules

Contracts convert between token decimals and WAD using `DecimalMath`:

- `toWad`: token units -> WAD.
- `fromWad`: WAD -> token units (floor, outbound to user).
- `fromWadCeil`: WAD -> token units (ceil, inbound from user).

Rationale:

- Ceiling when pulling funds avoids underpayment.
- Floor when sending funds avoids overpayment.

### MockUSDC vs Real USDC

- Current Base Sepolia `MockUSDC` is 18 decimals.
- Real USDC is 6 decimals.

Implication:

- App adapters must not hardcode decimal assumptions for long-term compatibility.
- SDK/app boundary code must read token decimals where token-unit operations occur.

### SoothBook Specific Unit Behavior

SoothBook computes `cost = amount * tick / 1000` in raw collateral token units.

Implication:

- `amount` and `maxCost` passed to SoothBook must already be in collateral token units.
- Adapter must normalize user input to token units before request assembly.

## Slippage Policy (SDK-Level)

Use only `applySlippageToAmount(...)` for Launchpad/AMM guard construction.

Rules:

- Buy: `maxCost = quotedAmount * (1 + slippageBps/10000)`
- Sell: `minProceeds = quotedAmount * (1 - slippageBps/10000)`

Example:

- Buy quote `100e18`, slippage `500` bps -> max cost `105e18`.
- Sell quote `100e18`, slippage `500` bps -> min proceeds `95e18`.

Do not add hidden extra buffers in app code.

## SDK API Contract

Use these functions as the only protocol logic entry points:

State:

- `readLaunchpadAmmSnapshot(...)`
- `readSoothCoreSnapshot(...)`

Quote:

- `readLaunchpadAmmQuote(...)`
- `computeLaunchpadAmmQuote(...)`

Requests:

- `buildLaunchpadTradeRequest(...)`
- `buildSoothBookBuyRequest(...)`

Math helpers:

- `applySlippageToAmount(...)`
- `computeLmsrYesProbability(...)`
- `getLaunchpadFeeBps(...)`

## Adapter Rule (Mandatory)

App hooks/components are adapters only.

Allowed:

- query invalidation
- wallet UX
- loading/error states
- i18n/formatting

Not allowed:

- custom fee math
- custom outcome mapping
- custom signed-share assembly
- custom slippage formulas
- custom venue routing

## Conformance Checklist

An app is protocol-compatible only if all are true:

1. Uses `readSoothCoreSnapshot` for market lifecycle and venue context.
2. Uses SDK quote functions for Launchpad/AMM math.
3. Uses SDK request builders for tx args.
4. Uses SDK slippage helper for guard values.
5. Routes claim/redeem by lifecycle contract path.
6. Does not duplicate fee/outcome/slippage math outside SDK.
7. Handles token decimals at boundary points only.
8. Marks SoothBook quote as indicative unless full depth simulation exists.

## Current Migration Status

Telegram:

- Integrated with unified snapshot/quote/tx/claim/position logic.
- Files:
  - `apps/telegram/webapp/src/hooks/useSoothMarket.ts`
  - `apps/telegram/webapp/src/hooks/useSoothQuote.ts`
  - `apps/telegram/webapp/src/hooks/useTrade.ts`
  - `apps/telegram/webapp/src/hooks/useSoothPosition.ts`
  - `apps/telegram/webapp/src/hooks/usePositions.ts`
  - `apps/telegram/webapp/src/hooks/useClaim.ts`
  - `apps/telegram/webapp/src/hooks/useMarkets.ts`

Demo and Lens:

- Audited for parity gaps.
- Pending migration to SDK-only adapters.

## Known Limitations

1. SoothBook quote is currently indicative (implied price), not full depth fill simulation.
2. SDK package currently has no dedicated automated conformance test suite yet.

## Recommended Next Steps

1. Add SDK conformance tests for:
   - outcome mapping
   - fee composition (pre/post grad)
   - slippage guard formulas
   - tx arg builders
   - venue selection
   - claim route selection
2. Migrate Lens to SDK adapters first (small surface).
3. Migrate Demo by replacing legacy quote/swap math with SDK calls.
4. Add CI gate: fail if app code introduces duplicated fee/slippage/outcome math.

## Build Verification (Current)

Validated locally:

- `pnpm --filter @sooth/sdk build`
- `pnpm --filter @sooth/telegram build:webapp`

Both pass; frontend bundle warnings are third-party rollup warnings, not protocol-logic failures.

## SDK Feedback & Improvement Roadmap

See [SDK-FEEDBACK.md](./SDK-FEEDBACK.md) for detailed feedback from the Telegram dApp build, including:

- 9 prioritized SDK improvements (claim builder, client factory, SoothBook quotes, etc.)
- Infrastructure considerations (RPC shielding, indexer integration)
- Library vs backend model analysis with cost projections
- Decision: stay on library model for now, revisit at ~500 DAU or ~4+ app surfaces
