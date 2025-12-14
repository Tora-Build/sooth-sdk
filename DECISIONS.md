# Architectural Decision Records (ADRs)

## ADR-001: Client-Side Optimistic Pricing
- **Date**: 2025-12-09
- **Context**: Users experienced "jumping" UI and laybout shifts because pricing depended solely on async on-chain calls which were slow and sometimes returned stale or raw data (like shares instead of price).
- **Decision**: Implement a dual-layer pricing strategy in `useV4Quote.ts`:
    1.  **Client-Side**: Immediate, synchronous calculation using `lmsr.ts` (shared logic) for instant feedback.
    2.  **On-Chain**: Debounced async verification to ensure security and final accuracy.
- **Consequences**:
    - UI is instant and stable (no flickering).
    - Requires maintaining duplicate math logic in TypeScript (`lmsr.ts`) alongside Solidity (`SoothMarketV4.sol`).
    - **Risk**: If JS math diverges from Solidity math, user sees one price but transaction fails or executes differently. (Mitigation: 100% test coverage on `lmsr.ts` against contract method).

## ADR-002: Signed Integer Trading Interface
- **Date**: 2025-12-09
- **Context**: V4 contracts use `int256` for `deltaShares` (+ for buy, - for sell) and `maxCost`. The frontend previously treated everything as unsigned `uint256`.
- **Decision**: Refactor `useTrade.ts` to strictly handle signed BigInts for all V4 trading operations.
- **Consequences**:
    - Frontend logic must explicitly handle sign conversion (`shares > 0 ? limit : -limit`).
    - Eliminates ambiguity in "Buy vs Sell" distinct functions; unified into single `tradeAMM` call.

## ADR-003: Short Selling via Virtual Orders
- **Date**: 2025-12-09
- **Context**: Users want to "Short" outcome tokens (e.g., Sell YES) without owning them. The protocol needs a way to collateralize this risk and match it against Buy orders.
- **Decision**: Implement Short Selling in the `TraderVault` as a "Virtual Order":
    - **Logic**: A user asking to "Sell X at Price P" is converted into a request to "Buy Opposite(X) at Price (1-P)".
    - **Collateral**: The vault explicitly calculates collateral as `(1 - Price) * Amount` for these orders.
    - **Market Storage**: The market receives a standard "Buy" order for the opposite outcome.
- **Consequences**:
    - **Breaking Change**: `placeOrder` signature updated to include `isBuy` flag.
    - **Unified Liquidity**: Short Sellers of YES compete directly with Buyers of NO, deepening liquidity.
    - **UX**: Frontend must handle the "Sell" UI by calling `placeOrder(..., isBuy=false)`.

## ADR-004: UI-Managed Hybrid Sell
- **Date**: 2025-12-09
- **Context**: Users holding Spot Shares (e.g. YES) want to place "Sell Limit Orders" using those shares as collateral. However, the Protocol's `SoothTraderVault` is designed for "Virtual Shorting" (Buy Opposite) and lacks a native mechanism to "Lock" spot shares for limit orders without heavy refactoring.
- **Decision**: Do **not** implement "Spot Locking" in the protocol. Instead, handle "Hybrid Selling" (Selling owned shares via Limit Order) as a UI abstraction over "Virtual Shorting".
    - **UI Layer**: If a user sells 10 YES (owned) via Limit Order, the UI warns them this is a "Virtual Short" and requires USDC collateral.
    - **Protocol**: The trade is executed as `placeOrder(isBuy=false)`, effectively buying NO tokens.
    - **Settlement**: If filled, the user ends up with a "Complete Set" (Original YES + New NO). They must manually merge/redeem this set to realize their exit to USDC.
    - **Education**: UI must clearly label this "Virtual Short" to avoid confusion about why USDC is needed to "Sell".

## ADR-005: Hybrid Granularity (Dual-Venue)
- **Date**: 2025-12-10
- **Context**: The Protocol combines an integer-based Orderbook (for UX/EVM compatibility with ERC1155) with a Continuous LMSR AMM (which requires high precision WAD math).
- **Decision**: Adopt a **Hybrid Granularity Model**:
    - **Orderbook**: Uses **Integers** (Decimals=0). 1 Unit = 1 Share.
    - **AMM**: Uses **WAD** (Decimals=18). 1 Unit = 1e-18 Share.
    - **TraderVault**: Handles conversion (e.g., merging 1 Integer YES + 1 Integer NO = 1e18 USDC Value after scaling).
- **Consequences**:
    - **Frontend**: Must handle two distinct numeric types (`BigInt` for orders, `WAD` for AMM).
    - **Safety**: Effectively eliminates "Dust" issues in the orderbook.
    - **UX**: Orderbook feels like traditional stock trading (round lots).

## ADR-006: Legacy V3 Removal
- **Date**: 2025-12-10
- **Context**: V3 contracts (`SoothMarket`, `SoothTraderVault` V3) were kept for regression testing but relied on deprecated Tick logic and bloateded the codebase.
- **Decision**: **Permanently delete** all V3 legacy contracts and interfaces.
- **Consequences**:
    - **Codebase Cleanliness**: drastic reduction in file count and cognitive load.
    - **Maintenance**: No need to maintain backwards compatibility for ticks.
    - **Risk**: Hard cut-off. Any external tooling relying on V3 ABIs will break ( mitigated by updated docs/migration guides).

## ADR-007: WAD Precision for Order Matching Returns
- **Date**: 2025-12-10
- **Context**: `SoothTraderVaultV4` calculates expected refund values using WAD math (`TargetPrice * Amount`). However, `SoothMarketV4` was returning `matchedValue` as truncated Integers (dividing by 1e18). This mismatch caused `Arithmetic Underflow` when the Market's returned value (Integer) was subtracted from the Vault's expectation (WAD).
- **Decision**: Update `SoothMarketV4.createOrder` (and internal matching logic) to return `matchedValue` in **WAD precision** (sum of `Amount * MatchPrice` without division).
- **Consequences**:
    - **Fixes Bug**: Prevents panic 0x11.
    - **Precision**: Refunds are now accurate to the wei, even for small integer order amounts.
    - **Consistency**: The interface now consistently returns value in WAD, aligning with `SoothTraderVault`'s internal logic.

## ADR-008: WAD × WAD Multiplication Rule
- **Date**: 2025-12-11
- **Status**: Accepted
- **Context**: Internal audit discovered **6 critical bugs** where two WAD values were multiplied without dividing by 1e18, creating 1e36 overflows. This pattern corrupted user balances (e.g., showing `$1,200,000,000,000,000`).
- **Decision**: Establish a **mandatory code review rule** for all WAD math:
    - **Rule**: If both operands are WAD (1e18 scale), the result is WAD×WAD (1e36). MUST divide by 1e18.
    - **Checklist**: Before any multiplication, ask: "Is operand A in WAD? Is operand B in WAD? If both yes, add `/1e18`."
    - **Examples**:
      - ❌ `price * amount` → 1e36 overflow
      - ✅ `(price * amount) / 1e18` → correct WAD result
- **Consequences**:
    - **Prevention**: All future PRs must verify WAD math.
    - **Documentation**: Added to `.agent/LESSONS_LEARNED.md` for AI agents.
    - **Testing**: Consider adding invariant tests for balance tracking.

## ADR-009: OutcomeToken Authorization for Merge Callbacks
- **Date**: 2025-12-12
- **Status**: Accepted
- **Context**: Hybrid sell transactions were failing with "TraderVault: not market" error. Investigation revealed that `creditMergeProceeds` was using the `onlyMarket` modifier, but it's called by OutcomeToken (not Market) during the merge flow:
    ```
    TraderVault.onOrderMatched() 
      → OutcomeToken.merge() 
        → TraderVault.creditMergeProceeds() ❌ FAILS
    ```
- **Decision**: Add separate authorization for OutcomeTokens:
    - New `_isOutcomeToken` mapping to track authorized OutcomeToken contracts
    - New `onlyOutcomeToken` modifier for functions called by OutcomeToken
    - Changed `creditMergeProceeds` to use `onlyOutcomeToken` instead of `onlyMarket`
    - Added `setOutcomeToken(address, bool)` admin function
    - Deployment script now automatically registers OutcomeTokens after creation
- **Consequences**:
    - **Fixes Bug**: Hybrid sell and merge operations now work correctly.
    - **Separation of Concerns**: Clear distinction between Market callbacks and OutcomeToken callbacks.
    - **Deployment Checklist**: Must call `setOutcomeToken()` for each market's OutcomeToken.

## ADR-010: Lock-on-Sell vs Lock-on-Buy
- **Date**: 2025-12-12
- **Status**: Accepted (branch `codex/review-and-implement-lock-mechanism`)
- **Context**: V4.5 used Lock-on-Buy (shares locked 24h after purchase). Research document `LOCK_MECHANISM_COMPARISON.md` analyzed two approaches:
    - **Lock-on-Buy**: Blocks trading flow (can't sell after buy for 24h)
    - **Lock-on-Sell**: Locks proceeds (can trade freely, but proceeds locked 24h)
- **Decision**: Implement **Lock-on-Sell with Option A** (funds stay in GovernorVault):
    - Remove `unlockTime` from `AMMPosition` struct
    - On SELL: call `governorVault.lockProceeds()` instead of `sendFunds()`
    - Funds remain in GovernorVault and are earmarked for user
    - After 24h: user calls `claimUnlocked()` to receive funds
    - `withdrawFor()` protects both `totalLockedExposure` AND `totalLockedProceeds`
- **Consequences**:
    - **UX Improvement**: Continuous trading flow (buy/sell/buy/sell) is uninterrupted
    - **Capital Efficiency**: Users can trade while proceeds are locked
    - **LP Protection**: Attackers can't extract value immediately after settlement
    - **Implementation**: Lock queue in GovernorVault with per-user entries
    - **Test Impact**: All tests updated to reflect new lock behavior (20/22 passing)

## ADR-011: Canonical Deployment Config Source-of-Truth
- **Date**: 2025-12-14
- **Status**: Accepted
- **Context**: Deployment artifacts drifted across the monorepo (frontend config vs contracts package vs legacy docs paths). This caused stale addresses to persist after redeploys.
- **Decision**:
  - Treat `apps/web/src/config/deployments.json` as the **canonical** deployment config.
  - Use `sync-deployments.sh` to sync the canonical file into:
    - `packages/contracts-evm/deployments.json`
    - `packages/sooth-dapp/src/config/deployments.json`
  - Keep `packages/contracts-evm/script/verify-deployment.sh` robust to running from any working directory.
- **Consequences**:
  - Reduced config drift and “invalid market / stale address” frontend errors.
  - Deploy workflow becomes: deploy → verify → bump config version → sync script → hard refresh.

## ADR-012: Frontend V4 Uses Canonical Configs (Chain-Aware)
- **Date**: 2025-12-14
- **Status**: Accepted
- **Context**: The V4 standalone UI path had a second, hardcoded address source (`v4-addresses.ts`) that only targeted Base Sepolia, causing BNB testnet to silently use the wrong contracts.
- **Decision**:
  - Remove `apps/web/src/config/v4-addresses.ts`
  - Make V4 UI derive:
    - **TraderVault address** from `deployments.json` via `useDeployments()`
    - **Market list** from `markets.json` filtered by active `chainId`
- **Consequences**:
  - No duplicate address sources; BNB and other chains work as soon as configs are synced.
  - Reduces “connected to chain X but calling chain Y contracts” class of bugs.
