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
