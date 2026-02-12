# Sooth Protocol V10 - Smart Contracts Overview

> **Status**: V10.0.0 Alpha  
> **Date**: 2026-01-06  
> **Package**: `packages/contracts-core`  
> **Audit Scope**: 6 core contracts + libraries

## Executive Summary

Sooth is a permissionless prediction market protocol with **creator economics** and **dual trading venues** (AMM + Orderbook). V10 introduces the **Unified Crossing Architecture** - a major advancement that combines spot sell liquidity with range order liquidity into a single, efficient crossing algorithm.

### Key Stats
- **6 Core Contracts** (~3,000 lines of Solidity)
- **Deployed**: Base Sepolia, Monad Testnet
- **Gas Optimized**: Unified tick storage + dual bitmap search

---

## Architecture Layers

```
+---------------------------------------------------------+
|           LaunchpadEngine (Creator Economics)            |
|  - Market creation with LP rewards                       |
|  - Fee distribution (5% pre-grad, 1% post-grad)         |
|  - Graduation mechanics (bBase x ln(2) x mult.)         |
|  - LP token issuance                                     |
+-------------------+-------------------------------------+
                    |
          +---------+---------+
          |                   |
+---------v--------+  +-------v-------------------+
|    AMMEngine     |  |   TickBookPoolManager     |
|  - LMSR pricing  |  |   - Unified orderbook     |
|  - Positions     |  |   - 10k ticks (1 bp)      |
|  - 24h lock      |  |   - V10: Unified crossing |
+--------+---------+  |   - V10: Spot + Range     |
         |            +-------------+-------------+
         |                          |
         +------------+-------------+
                      |
            +---------v---------+
            |    TruthMarket    |
            |  - Lifecycle      |
            |  - Settlement     |
            |  - Guardian veto  |
            +---------+---------+
                      |
            +---------v---------+
            |  Collateralizer   |
            |  - Split/Merge    |
            |  - Redeem         |
            |  - OutcomeToken   |
            +-------------------+
```

---

## V10 Major Innovation: Unified Crossing

### The Problem (V9)
In V9, liquidity was **fractured** between two sources:
- **Range Orders**: USDC-backed, mint synthetic tokens on fill
- **Spot Sells**: Token-backed, recycle existing tokens on fill

These were crossed separately, leading to suboptimal price discovery.

### The Solution (V10)
V10 introduces **Unified Crossing** (`_crossUnified()`):

```
When a buyer places an order:

1. PHASE 1: Fill Spot Sells FIRST (recycle tokens)
   - No minting required
   - Higher capital efficiency
   - Sellers get direct proceeds

2. PHASE 2: Fill Range Orders (mint synthetic)
   - Standard pro-rata distribution
   - Mints new outcome tokens
   - USDC locked as collateral
```

### Benefits
| Metric | V9 | V10 |
|--------|----|----|
| Liquidity Utilization | 60-70% | 95%+ |
| Token Velocity | Low | High |
| Price Discovery | Good | Optimal |
| Settlement Complexity | Medium | Unified |

---

## Core Contracts at a Glance

| Contract | Purpose | Size | V10 Changes |
|----------|---------|------|-------------|
| **TruthMarket** | Market lifecycle + settlement | 206 lines | - |
| **TickBookPoolManager** | Unified orderbook | 1,490 lines | **Unified crossing, spot integration** |
| **AMMEngine** | LMSR position trading | 643 lines | - |
| **LaunchpadEngine** | Creator economics + fees | 671 lines | - |
| **Collateralizer** | Split/merge/redeem tokens | 331 lines | - |
| **TickBookVault** | Singleton USDC custody | ~400 lines | - |
| **OutcomeToken** | YES/NO ERC20 tokens | ~100 lines | - |

---

## V10 New Data Structures

### Unified Tick Liquidity

```solidity
/// @dev V10: Unified tick liquidity - combines range and spot in one struct
struct TickLiquidity {
    int128 rangeLiquidityNet;     // Range order net liquidity (for crossing)
    uint128 rangeLiquidityGross;  // Range order gross liquidity (for bitmap cleanup)
    uint128 spotLiquidity;        // Spot sell liquidity at this tick (NEW)
}
```

### Crossing Result

```solidity
/// @dev V10: Internal struct for unified crossing results
struct CrossingResult {
    uint256 totalFilled;
    uint256 spotFilled;      // From spot sells (recycled)
    uint256 rangeFilled;     // From range orders (minted)
    uint256 newOrderCost;
    uint256 spotCost;
    uint256 rangeCost;
    uint16 crossTick;
}
```

---

## V10 New Features

### 1. Spot Sell Orders

Users can now sell existing tokens directly on the orderbook:

```solidity
function placeSpotSell(
    bytes32 marketKey,
    uint8 outcome,          // Which token to sell
    uint256 shares,         // Amount to sell
    uint16 tickLower,       // Ask price range start
    uint16 tickUpper        // Ask price range end
) external returns (uint256 sellId)
```

### 2. Dual Bitmap System

```solidity
// Range order bitmaps (existing from V9)
mapping(bytes32 => mapping(uint8 => TickBitmap.Bitmap)) private _bitmaps;

// V10: Separate bitmap for spot liquidity
mapping(bytes32 => mapping(uint8 => TickBitmap.Bitmap)) private _spotBitmaps;
```

### 3. Enhanced Events

```solidity
/// @dev V10: Enhanced crossing event with source breakdown
event UnifiedCrossing(
    bytes32 indexed marketKey,
    uint256 indexed newOrderId,
    uint8 newOutcome,
    uint256 spotFilled,     // How much from spot sells
    uint256 rangeFilled,    // How much from range orders
    uint256 spotCost,
    uint256 rangeCost,
    uint16 crossTick
);
```

---

## Design Principles

### 1. **Spot First, Range Second**
When crossing, always fill spot liquidity first:
- Recycling existing tokens is more capital efficient
- Reduces total synthetic token supply
- Benefits spot sellers with immediate proceeds

### 2. **Unified Storage**
Single `TickLiquidity` struct replaces separate mappings:
- Reduces storage slots accessed
- Enables single-pass tick traversal
- Simpler invariant checking

### 3. **Pull-Based Lifecycle**
All venues query `TruthMarket.isLive()` and `isSettled()`:
- No callbacks or hooks
- No centralized coordinator
- Each venue enforces its own rules

### 4. **Modular Economics**
Fee distribution, graduation, and LP rewards are configurable by owner.

---

## Quick Reference

### Precision
- **WAD**: 1e18 (prices, shares, liquidity)
- **USDC**: 6 decimals (converted to/from WAD)
- **Ticks**: 1-999 (1 tick = 0.1% probability)
- **Q128**: 2^128 (accumulator overflow tracking)

### Fee Structure
| Phase | Taker Fee | Maker Fee | Distribution |
|-------|-----------|-----------|--------------|
| Pre-Graduation | 0.1% | 0% | 100% to creator |
| Post-Graduation | 0.1% | 0% | 50/30/20 split |

### Market Lifecycle
```
CREATED (unclaimed)
   | creator calls activate()
LIVE (trading enabled)
   | deadline passes
SETTLING (awaiting adjudicator)
   | adjudicator.settle()
SETTLED (outcome determined, guardian can veto)
   | (no veto or veto rejected)
FINALIZED (locked, can redeem)
```

---

## Next Steps

1. **Read contract docs in order**:
   - [02-TruthMarket.md](./02-TruthMarket.md) - Lifecycle & settlement
   - [03-TickBookPoolManager.md](./03-TickBookPoolManager.md) - V10 unified orderbook
   - [04-AMMEngine.md](./04-AMMEngine.md) - LMSR positions
   - [05-Collateralizer.md](./05-Collateralizer.md) - Token ops
   - [06-LaunchpadEngine.md](./06-LaunchpadEngine.md) - Creator economics
   - [07-TickBookVault.md](./07-TickBookVault.md) - Vault architecture

2. **Run tests**:
   ```bash
   cd packages/contracts-core
   forge test
   ```

3. **Deploy**:
   ```bash
   cd packages/contracts-core
   forge script script/DeployArc.s.sol --broadcast
   ```

---

## External Resources

- [Architecture Decision Records (ADRs)](../../../DECISIONS.md)
- [Status & Known Issues](../../../STATUS.md)
- [Test Suite](../../../packages/contracts-core/test/)
