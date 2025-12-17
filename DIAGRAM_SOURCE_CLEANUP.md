# Money Flow Diagram Source Cleanup

## Summary
The previous diagram incorrectly showed "Graduated Market / Standard Market" as a separate market type. This document tracks where that outdated concept came from and what was cleaned up.

## Sources of Outdated "Standard Market" Concept

### ✅ Fixed Sources

1. **`apps/web/docs/specs/LAUNCHPAD_SPEC.md` (Line 4)**
   - **Before**: "graduate to standard markets upon reaching a liquidity threshold"
   - **After**: "graduate to post-graduation phase upon reaching a liquidity threshold. All markets are Launchpad markets—there are no separate 'standard markets'"
   - **Status**: ✅ Fixed

2. **`apps/web/docs/specs/LAUNCHPAD_SPEC.md` (Line 78)**
   - **Before**: "Orderbook: Available for graduated markets only."
   - **After**: "Orderbook: Available for post-graduation Launchpad markets only (activated after graduation)."
   - **Status**: ✅ Fixed

3. **`apps/web/src/pages/MarketDetail.tsx` (Line 219)**
   - **Before**: `{/* Orderbook Trading for Graduated Markets */}`
   - **After**: `{/* Orderbook Trading (Post-Graduation Only) */}`
   - **Status**: ✅ Fixed

4. **`MONEY_FLOW_DIAGRAM.md`**
   - **Before**: Showed `GM[Graduated Market<br/>Standard Market]` as separate market type
   - **After**: Split into `LMPre[LaunchpadMarket V6 Pre-Graduation Phase]` and `LMPost[LaunchpadMarket V6 Post-Graduation Phase]`
   - **Status**: ✅ Fixed

### 📝 Historical References (No Action Needed - These are documentation of the old architecture)

These files document the migration from the old dual-market architecture to Launchpad-only:

1. **`DECISIONS.md` (ADR-016)**
   - Documents the decision to remove standard markets
   - Explains that `SoothMarketBase` is not a market type
   - **Status**: ✅ Correct - this is historical documentation

2. **`packages/contracts-evm/docs/MIGRATION_TO_LAUNCHPAD_ONLY.md`**
   - Documents the migration process
   - Lists what needed to be changed
   - **Status**: ✅ Correct - migration documentation

3. **`STATUS.md`**
   - Documents that migration is complete
   - **Status**: ✅ Correct - status documentation

### ⚠️ Other References (May Need Review)

1. **`apps/web/public/sooth_whitepaper.md` (Line 40)**
   - Mentions "standard markets" in context of vulnerability explanation
   - **Context**: Discusses historical architecture for explanation purposes
   - **Action**: Review if this should be updated to clarify it's historical

2. **`packages/contracts-evm/docs/public/sooth_whitepaper.html` (Line 133)**
   - Same as above (HTML version)
   - **Action**: Review if this should be updated

3. **`packages/contracts-evm/_archive/LaunchpadMarket.sol` (Line 14)**
   - Old archived code
   - **Status**: ✅ Correct - this is archived/historical code

## Key Architectural Clarification

### V6 Architecture (Current)
- **All markets are Launchpad markets** (created via `LaunchpadFactory`)
- Launchpad markets have **two phases**:
  1. **Pre-Graduation Phase**: Only AMM active, proceeds locked in market
  2. **Post-Graduation Phase**: Both AMM and Orderbook active, proceeds locked via global vault
- **No "standard markets"** exist as a separate market type
- `SoothMarketBase` is the base contract that `LaunchpadMarket` inherits from (NOT a market type)

### What the Diagram Should Show
- ✅ `LMPre` = LaunchpadMarket V6 Pre-Graduation Phase
- ✅ `LMPost` = LaunchpadMarket V6 Post-Graduation Phase  
- ✅ `SoothLiquidityVault` = Global locked proceeds tracking (not market liquidity)
- ❌ ~~No "Graduated Market" or "Standard Market" as separate entities~~

## Cleanup Status

- [x] Fixed `LAUNCHPAD_SPEC.md` overview
- [x] Fixed `LAUNCHPAD_SPEC.md` orderbook reference
- [x] Fixed `MarketDetail.tsx` comment
- [x] Fixed `MONEY_FLOW_DIAGRAM.md` diagram
- [ ] Review whitepaper references (historical context - may be intentional)

## Notes
- The confusion came from the phrase "graduate to standard markets" which was imprecise
- Markets "graduate" to post-graduation phase but remain Launchpad markets
- The diagram now accurately reflects V6 Launchpad-Only architecture (ADR-016)
