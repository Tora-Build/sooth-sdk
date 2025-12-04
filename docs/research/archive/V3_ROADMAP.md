# Sooth v3 Roadmap: Trader Account System

**Status:** Active Development  
**Updated:** 2025-12-04

---

## Overview

v3 introduces TraderVault as the single entry point for all trading, with modular extensions for yield generation and retroactive settlement protection.

## Completed ✅

### Core Contracts (contracts/v3/)

- `SoothTraderVaultV3.sol` - Single entry point for deposit/withdraw/trade
- `SoothMarketV3.sol` - Unified mirrored orderbook (Sell YES = Buy NO)

### Interfaces (contracts/interfaces/)

- `ISoothTraderVaultV3.sol` - Vault interface
- `ISoothMarketV3.sol` - Market v3 interface
- `IYieldStrategy.sol` - Yield integration stub
- `ITimeLock.sol` - Time-lock stub

### Tests

- 22 comprehensive tests passing (test/SoothV3Test.t.sol)

---

## Roadmap 🚀

### Phase 1: Foundation (Current)

- [x] Unified orderbook design
- [x] TraderVault v3 implementation
- [x] Complete set creation model
- [x] No collateral complexity
- [x] Comprehensive test suite

### Phase 2: Yield Integration (Future)

- [ ] Implement `AaveStrategy.sol`
- [ ] Implement `SparkStrategy.sol`
- [ ] Yield rebalancing logic in TraderVault
- [ ] Reserve buffer management (10% liquid default)
- [ ] Yield distribution to users (pro-rata or protocol cut)

### Phase 3: Time-Lock Module (✅ Completed)

- **Goal:** Prevent "hit-and-run" arbitrage and ensure solvency.
- **Status:** ✅ Implemented & Tested
- **Features:**
  - `SoothTimeLock.sol`: Manages lock durations and unlocks.
  - `pendingBalance`: Tracks locked proceeds.
  - **Lock on Sell:** Selling shares locks proceeds for 48h.

### Phase 4: Deployment & Verification (🚧 In Progress)

- **Goal:** Launch v3 on testnets.
- **Status:**
  - ✅ **Base Sepolia:** Live (`0x8B8c...`)
  - ⏸️ **Monad Testnet:** Paused (Insufficient Funds)
  - 📝 **Docs:** Updated for v3 integration.

### Phase 5: Settlement & Yield (Next)

- **Goal:** Implement redemption for winning shares and yield generation.
- **Status:** ⏳ Pending
- **Tasks:**
  - Implement `redeem()` in `TraderVault`.
  - Integrate Aave/Compound for idle USDC yield.

### Phase 6: Frontend Migration

- [ ] Update frontend hooks for v3 interfaces
- [ ] Remove collateral display/calculation
- [ ] Update orderbook display for mirrored view
- [ ] Add pending balance UI
- [ ] Integration testing

---

## Key Decisions Needed

1. **Yield Distribution:** Pro-rata to users or protocol takes cut?
2. **Lock Duration Range:** What min/max can Guardian configure?
3. **Clawback Authority:** Who can trigger clawback and under what conditions?
4. **Migration Path:** Run v2 and v3 in parallel or hard cutover?

---

## Benefits of v3

| Feature               | v2                   | v3                 |
| --------------------- | -------------------- | ------------------ |
| Order types           | SELL only            | BUY + SELL unified |
| Collateral            | Explicit lock/unlock | None - pay upfront |
| Entry points          | Market + TraderVault | TraderVault only   |
| Yield on idle         | No                   | Yes (Aave/Spark)   |
| Settlement protection | No                   | 48h time-lock      |
