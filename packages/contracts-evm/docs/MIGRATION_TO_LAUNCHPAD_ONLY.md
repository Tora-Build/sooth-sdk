# Migration to Launchpad-Only Architecture

**Date**: 2025-12-16  
**Status**: ✅ Complete  
**Goal**: Remove standard market concept - all markets must be created through LaunchpadFactory

---

## Overview

Previously, Sooth supported two types of markets:
1. **Standard Markets**: Created directly using `SoothMarketBase` with global `SoothLiquidityVault`
2. **Launchpad Markets**: Created through `LaunchpadFactory` with per-market liquidity vaults

**Decision**: Remove standard markets entirely. All markets must be Launchpad markets.

**Important Clarification**: `SoothMarketBase` is NOT a market type - it's the base contract that `LaunchpadMarket` inherits from. It provides the core AMM and orderbook functionality. There are no "standard markets" anymore - only Launchpad markets exist.

---

## Changes Required

### 1. Core Contracts

#### `SoothTraderVaultV4.sol`
- ✅ Updated comments to remove "Standard market" references
- ✅ Clarified that Launchpad markets are their own vault

#### `SoothLiquidityVault.sol`
- **Still needed** for TraderVault's global locked proceeds tracking
- Used for `claimUnlocked()` default behavior (when no specific vault specified)
- **NOT used for market liquidity** - each Launchpad market is its own vault and manages its own assets
- This is a global vault for cross-market locked proceeds accounting

### 2. Test Files

All test files that directly instantiate `SoothMarketBase` must be converted to use `LaunchpadFactory`.

**Pattern for conversion:**

**Before:**
```solidity
SoothMarketBase market = new SoothMarketBase();
market.initialize(...);
```

**After:**
```solidity
// Setup (in setUp())
LaunchpadFactory factory;
LaunchpadMarket marketImpl;
SoothLiquidityVault globalVault; // For TraderVault only
ProtocolConfig protocolConfig;

factory = new LaunchpadFactory(
    address(marketImpl),
    address(usdc),
    address(traderVault),
    address(feeController),
    address(outcomeTokenImpl),
    treasury,
    adjudicator,
    address(adjudicatorRegistry),
    address(protocolConfig)
);

// Create market
(address market, ) = factory.createMarket(
    "Market Name",
    "SYMBOL",
    "Description",
    0, // tier
    false, // isOpenEnd
    7 days, // duration
    address(0) // marketAdjudicator (0 = default)
);
```

**Files to update:**
- `test/V4Integration.t.sol`
- `test/OrderbookShort.t.sol`
- `test/ReproducePanic.t.sol`
- `test/GranularityTest.t.sol`
- `test/scenarios/MultiRoleScenarios.t.sol`
- `test/scenarios/AdversarialScenarios.t.sol`
- `test/invariants/VaultInvariants.t.sol`
- `test/CustodialVault.t.sol`
- `test/scenarios/SettlementScenarios.t.sol`
- `test/HybridSell.t.sol`
- And others...

### 3. Deployment Scripts

All scripts that create markets directly must use `LaunchpadFactory`.

**Files to update:**
- `script/DeployMultiChainV4.s.sol`
- `script/DeployV4Markets.s.sol`
- `script/DeployFreshV4.s.sol`
- `script/RedeployMarketsOnly.s.sol`
- `script/RedeployMarket2.s.sol`
- `script/Step1_DeployContracts.s.sol`
- `script/CheckMarket2State.s.sol`
- `script/DebugMarketState.s.sol`
- And others...

### 4. Documentation

Update all references to "standard markets" to clarify that only Launchpad markets exist.

**Files to update:**
- `docs/V6_NAMING_PROPOSAL.md` - Remove "standard markets" references
- `docs/public/sooth_whitepaper.md` - Update market creation description
- `docs/core/ARCHITECTURE.md` - Remove standard market architecture
- Any other docs mentioning standard markets

---

## Key Points

1. **SoothLiquidityVault is still needed** - Used by TraderVault for global locked proceeds tracking, not for market liquidity
2. **Each Launchpad market is its own vault** - Markets implement `ISoothLiquidityVault` directly
3. **All markets go through LaunchpadFactory** - No direct `SoothMarketBase` instantiation
4. **Tests need ProtocolConfig** - Factory constructor requires `protocolConfig` parameter

---

## Status

- [x] Core contract comments updated
- [x] Launchpad.t.sol test fixed (added ProtocolConfig)
- [x] Convert remaining test files
- [x] Convert deployment scripts
- [x] Update documentation
- [x] Verify all tests pass
