# V8 Solidity Interfaces

**Status**: ✅ Compiled Successfully  
**Date**: 2025-12-23  
**Solidity Version**: 0.8.20+

## Overview

This directory contains the core Solidity interfaces for the Sooth V8 Modular Architecture. These interfaces define the contract API for the Tri-Engine Stack (Truth Market + AMM Engine + TickBook).

## Interface Files

### 1. `ITruthMarket.sol`
**Purpose**: Canonical source of lifecycle and settlement authority  
**Key Functions**:
- `isLive()` - Check if market is accepting trades
- `isSettled()` - Check if market has been settled
- `winningOutcome()` - Get winning outcome (0=NO, 1=YES, 2=INVALID)
- `tStar()` - Get retroactive truth-time for T* settlement
- `getRedemptionValue(outcome)` - Get redemption value per token

**Used By**: AMM Engine, TickBook (for lifecycle gating)

---

### 2. `IAMMEngine.sol`
**Purpose**: LMSR-based AMM with position domain  
**Key Functions**:
- `tradePositions(market, deltaShares, maxCost)` - Execute position trade
- `getPositionQuote(market, deltaShares)` - Get trade quote
- `claimUnlocked(market)` - Claim unlocked sell proceeds
- `getPosition(market, user)` - Get user's position and lock status
- `settlePosition(market)` - Settle position post-resolution
- `applyRetroSettlement(market, user, proof)` - Apply T* adjustment

**Features**:
- Non-transferable positions (ledger entries)
- 24h sell lock mechanism
- T* retroactive settlement support
- WAD precision (1e18)

---

### 3. `ITickBook.sol`
**Purpose**: Continuous Linear Tick orderbook venue  
**Key Functions**:
- `swap(marketKey, isBuy, amountIn, limitTick)` - Execute swap
- `getQuote(marketKey, isBuy, amountIn, limitTick)` - Get swap quote
- `addLiquidity(marketKey, tickIndex, amount)` - Add concentrated liquidity
- `removeLiquidity(marketKey, tickIndex, amount)` - Remove liquidity
- `getTick(marketKey, tickIndex)` - Get tick data
- `findNextActiveTick(marketKey, startTick, isBuy)` - Bitmap-based tick discovery

**Features**:
- 10,000 probability ticks (1bp precision)
- Fungible tick positions (ERC20-like)
- O(1) tick discovery via bitmap
- Pro-rata fee distribution

---

### 4. `ICollateralizer.sol`
**Purpose**: Outcome token custody and split/merge operations  
**Key Functions**:
- `split(market, amount)` - Split USDC into YES+NO tokens
- `merge(market, amount)` - Merge YES+NO tokens back to USDC
- `redeem(market, amount)` - Redeem winning tokens post-settlement
- `registerMarket(market, name, symbol)` - Deploy outcome tokens
- `getOutcomeTokens(market)` - Get YES/NO token addresses

**Features**:
- 1 USDC = 1 YES + 1 NO (WAD precision)
- ERC20 outcome tokens
- Post-settlement redemption
- No T* adjustments (PvP venue)

---

### 5. `ITraderVaultLite.sol`
**Purpose**: Minimal USDC custody (logicless)  
**Key Functions**:
- `deposit(amount)` - Deposit USDC
- `withdraw(amount)` - Withdraw USDC
- `balanceOf(user)` - Get user balance
- `asset()` - Get USDC address

**Features**:
- Pure custody (no trading logic)
- All execution logic in AMM/TickBook

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Truth Layer                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │  ITruthMarket                                    │   │
│  │  - isLive(), isSettled()                         │   │
│  │  - winningOutcome(), tStar()                     │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
           ▼                               ▼
┌──────────────────────┐       ┌──────────────────────┐
│   AMM Engine         │       │   TickBook           │
│   (Position Domain)  │       │   (Token Domain)     │
│                      │       │                      │
│  IAMMEngine          │       │  ITickBook           │
│  - tradePositions()  │       │  - swap()            │
│  - claimUnlocked()   │       │  - addLiquidity()    │
│  - settlePosition()  │       │  - getTick()         │
└──────────────────────┘       └──────────────────────┘
           │                               │
           │                               │
           ▼                               ▼
┌──────────────────────┐       ┌──────────────────────┐
│  TraderVaultLite     │       │  Collateralizer      │
│  (USDC Custody)      │       │  (Token Custody)     │
│                      │       │                      │
│  ITraderVaultLite    │       │  ICollateralizer     │
│  - deposit()         │       │  - split()           │
│  - withdraw()        │       │  - merge()           │
│  - balanceOf()       │       │  - redeem()          │
└──────────────────────┘       └──────────────────────┘
```

---

## Implementation Checklist

### Phase 1: Foundation ✅ INTERFACES COMPLETE
- [x] ITruthMarket interface
- [x] ICollateralizer interface  
- [x] ITraderVaultLite interface
- [ ] Implement Collateralizer contract
- [ ] Implement TraderVaultLite contract
- [ ] Write unit tests for custody layer

### Phase 2: AMM Engine
- [x] IAMMEngine interface
- [ ] Implement LMSR math library
- [ ] Implement 24h sell lock mechanism
- [ ] Add T* settlement logic
- [ ] Fuzz test position accounting

### Phase 3: TickBook
- [x] ITickBook interface
- [ ] Implement tick bitmap
- [ ] Write swap execution algorithm
- [ ] Add liquidity management
- [ ] Gas benchmark vs Uniswap v3

### Phase 4: Integration
- [ ] Connect venues to TruthMarket
- [ ] Implement fee distribution
- [ ] Add emergency pause
- [ ] External audit

---

## Design Principles

1. **Domain Isolation**: AMM positions and TickBook tokens are intentionally non-fungible
2. **Pull-Based Gating**: Venues query ITruthMarket for lifecycle state (no push hooks)
3. **WAD Precision**: All amounts use 1e18 precision (1 WAD = 1 unit)
4. **Minimal Interfaces**: Only essential functions exposed
5. **No Bridging**: Protocol does not provide cross-domain conversion

---

## Next Steps

1. **Implement Collateralizer** - Start with split/merge logic
2. **Deploy Outcome Tokens** - ERC20 YES/NO tokens
3. **Write Tests** - Unit tests for all interfaces
4. **Implement AMM Math** - LMSR library with WAD precision
5. **Build TickBook** - Tick bitmap and swap algorithm

---

## References

- Architecture Spec: `../../docs/research/V8/V8_MODULAR_ARCHITECTURE.md`
- ADR-008: WAD Math Precision Rules
- Uniswap v3: Concentrated Liquidity reference
- Hanson LMSR: Market scoring rule math
