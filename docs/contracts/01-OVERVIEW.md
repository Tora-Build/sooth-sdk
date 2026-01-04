# Sooth Protocol V9.9.6 — Smart Contracts Overview

> **Status**: V9.9.6-fix9L DEPLOYED  
> **Date**: 2026-01-03  
> **Package**: `packages/contracts-core`  
> **Audit Scope**: 5 core contracts + libraries

## 🎯 Executive Summary

Sooth is a permissionless prediction market protocol with **creator economics** and **dual trading venues** (AMM + Orderbook). V9.9.6 introduces the **Unified Order API** and fixes critical liquidity management bugs.

### Key Stats
- **5 Core Contracts** (~2,500 lines of Solidity)
- **138/138 Tests Passing** (100% pass rate)
- **Deployed**: Base Sepolia, Monad Testnet
- **Gas Optimized**: TickBitmap for O(1) tick discovery

---

## 📦 Architecture Layers

```
┌──────────────────────────────────────────────────┐
│         LaunchpadEngine (Creator Economics)      │
│  • Market creation with LP rewards               │
│  • Fee distribution (5% pre-grad, 1% post-grad)  │
│  • Graduation mechanics (bBase × ln(2) × mult.)  │
│  • LP token issuance                             │
└────────────────┬─────────────────────────────────┘
                 │
      ┌──────────┴──────────┐
      │                     │
┌─────▼──────────┐  ┌──────▼──────────────┐
│  AMMEngine     │  │ TickBookPoolManager │
│  • LMSR pricing│  │ • Orderbook venue   │
│  • Positions   │  │ • 10k ticks (1 bp)  │
│  • 24h lock    │  │ • Bitmap discovery  │
└────────┬───────┘  └──────┬──────────────┘
         │                 │
         └────────┬────────┘
                  │
          ┌───────▼─────────┐
          │  TruthMarket    │
          │  • Lifecycle    │
          │  • Settlement   │
          │  • Guardian veto│
          └────────┬────────┘
                   │
          ┌────────▼────────┐
          │ Collateralizer  │
          │ • Split/Merge   │
          │ • Redeem        │
          │ • OutcomeToken  │
          └─────────────────┘
```

---

## 🔥 V9.9.6-fix9L Major Improvements

### Unified Order API
**Before V9.9.6**: Separate `placeRangeOrder()` and `executeMarketOrder()`  
**After V9.9.6**: Single `placeOrder()` with order type determined by tick range

```solidity
// One API to rule them all
function placeOrder(
    bytes32 marketKey,
    uint8 outcome,           // 0=NO, 1=YES
    uint256 shares,
    uint16 tickLower,        // Min price to rest at
    uint16 tickUpper,        // Max price to fill up to
    uint256 maxCost
) external returns (uint256 orderId, uint256 filled, uint256 resting);
```

**Order Types by Tick Range**:
| Type | tickLower | tickUpper | Behavior |
|------|-----------|-----------|----------|
| Market | 1 | 999 | Fill everything |
| Limit | X | X | Single tick only |
| Range | X | Y (X<Y) | Spread liquidity |
| Market w/ Floor | F | 999 | Fill down to F, rest at F |

### Auto-Claim
`placeOrder()` automatically claims all user's pending fills before placing, preventing "stuck" positions.

### Critical Bug Fixes (fix1-fix8) + Optimization (fix9L)
- ✅ **Active Liquidity Underflow** (fix1) — Safe arithmetic for tick crossing
- ✅ **Array Overflow** (fix2-3) — Backwards iteration in removal
- ✅ **RPC Limits** (fix4) — `getAllMarketOrders()` for order enumeration
- ✅ **Crossing Logic** (fix6-8) — Correct `YES_tick + NO_tick >= 1000` formula
- ✅ **Order Auto-Completion** (fix5) — Removes phantom 100% filled orders
- ✅ **Spread Autoclaim** (fix9L) — 5-point sampling strategy, O(1) bounded gas

---

## 📋 Core Contracts at a Glance

| Contract | Purpose | Size | Status |
|----------|---------|------|--------|
| **TruthMarket** | Market lifecycle + settlement | 5.4 KB | ✅ Stable |
| **TickBookPoolManagerV996** | Orderbook (10k ticks, bitmap search) | 45 KB | ✅ Latest |
| **AMMEngine** | LMSR position trading | 9.1 KB | ✅ Stable |
| **LaunchpadEngine** | Creator economics + fees | 15 KB | ✅ Stable |
| **Collateralizer** | Split/merge/redeem tokens | 8.5 KB | ✅ Stable |
| **OutcomeToken** | YES/NO ERC20 tokens | 2.5 KB | ✅ Stable |
| **TickBookVault** | Multi-token custody for orderbook | 4 KB | ✅ Stable |

---

## 🏗️ Design Principles

### 1. **No Custody**
Users manage USDC via EOA, Safe, or smart accounts. Protocol is 100% composable.

### 2. **Domain Isolation**
AMM and TickBook are independent venues with different settlement models:
- **AMM**: Non-transferable positions, retroactive T*
- **TickBook**: Transferable ERC20, instant settlement

### 3. **Pull-Based Lifecycle**
All venues query `TruthMarket.isLive()` and `isSettled()` — no hooks or callbacks.

### 4. **Modular Economics**
Fee distribution, graduation, and LP rewards are configurable by owner.

---

## 📊 Quick Reference

### Precision
- **WAD**: 1e18 (prices, shares, liquidity)
- **USDC**: 6 decimals (converted to/from WAD)
- **Ticks**: 0-999 (1 bp = 1% probability per 10 ticks)
- **Q128**: 2^128 (accumulator overflow tracking)

### Fee Structure
| Phase | Taker Fee | Maker Fee | Creator Cut |
|-------|-----------|-----------|-------------|
| Pre-Graduation | 0.1% | 0% | 5% |
| Post-Graduation | 0.1% | 0% | 1% |

### Market Lifecycle
```
CREATED (unclaimed)
   ↓ creator calls activate()
LIVE (trading enabled)
   ↓ deadline passes
SETTLING (awaiting adjudicator)
   ↓ adjudicator.settle()
SETTLED (outcome determined, guardian can veto)
   ↓ (no veto or veto rejected)
FINALIZED (locked, can redeem)
```

---

## 🎓 Next Steps

1. **Read contract docs in order**:
   - [02-TruthMarket.md](./02-TruthMarket.md) — Lifecycle & settlement
   - [03-TickBook.md](./03-TickBook.md) — Orderbook & trading
   - [04-AMMEngine.md](./04-AMMEngine.md) — LMSR positions
   - [05-Collateralizer.md](./05-Collateralizer.md) — Token ops
   - [06-LaunchpadEngine.md](./06-LaunchpadEngine.md) — Creator economics

2. **Run tests**:
   ```bash
   cd packages/contracts-testing
   forge test
   ```

3. **Deploy**:
   ```bash
   cd packages/contracts-core
   forge script script/1_DeployCore.s.sol --broadcast
   ```

---

## 📖 External Resources

- [Architecture Decision Records (ADRs)](../../DECISIONS.md)
- [Status & Known Issues](../../STATUS.md)
- [Interactive CLI](../contracts-testing/script/interactive/interactive-test.ts)
- [Test Suite](../contracts-testing/test/v9/)
