# Handoff: Fresh Base Sepolia Deployment
**Date**: 2026-01-04  
**Thread**: T-019b883a-1e05-748f-bd51-273cd4c592fa

---

## What Was Done

### 1. Fresh Contract Deployment (Base Sepolia)
Deployed all V9.9.5 core contracts to Base Sepolia at block ~35,875,790:

| Contract | Address |
|----------|---------|
| MockUSDC | `0x0C31bbB6dA82ba97fBAfBe3425ee8757a4d724e3` |
| Collateralizer | `0x1EA2e8B5DFb71aa512bFaf348cFfD370919e78C5` |
| AMMEngine | `0x479764e7E337cFF574D910162d2B8C251A663e3e` |
| TickBookVault | `0x43A2Ab7e1B1787C410Ccbb05b2594974DD7c3057` |
| TickBookPoolManager | `0x5e7fa32b6f5072dA4357505590334E309009Bf72` |
| LaunchpadEngine | `0x4577fa4f54adb97E373785f09866831b6765E07B` |

### 2. Indexer Fixes
- Fixed RPC env var names in `ponder.config.ts`
- Added `RecentTradesPanel` to Pro page (wired to `useTradesIndexed`)
- Added `OrdersCrossed` and `TickCrossed` event handlers
- Limited indexer to Base Sepolia only (Arc/Monad disabled temporarily)
- Updated indexer to use new contract address + start block

### 3. Frontend Fixes
- Disabled `ActivityListener` for all testnets (Base/Monad/Arc) to prevent 429/400 RPC errors
- Disabled `ActivityListenerV8` for Monad/Arc (eth_newFilter unsupported)
- Updated `apps/web/src/config/deployments.json` with new addresses

### 4. Build Fixes
- Moved broken `RangeOrderHelper.sol` to `.bak` (missing interface)
- Created `DeployFresh.s.sol` deploy script

---

## Files Modified

```
packages/contracts-core/
├── script/DeployFresh.s.sol           # NEW - Fresh deployment script
├── src/periphery/RangeOrderHelper.sol.bak  # Moved (broken import)

packages/indexer/
├── ponder.config.ts                   # Base Sepolia only, new address
├── ponder.schema.ts                   # Added orderCrossed, tickCrossed tables
├── src/index.ts                       # Added OrdersCrossed, TickCrossed handlers

apps/web/
├── src/config/deployments.json        # New Base Sepolia addresses
├── src/pages/Pro.tsx                  # Added RecentTradesPanel component
├── src/components/features/ActivityListener.tsx      # Disabled for testnets
├── src/components/features/ActivityListenerV8.tsx    # Disabled for Arc
├── src/hooks/indexer/useTradesIndexed.ts             # (unchanged)
├── src/lib/chains.ts                  # Added Arc RPC note
├── src/lib/wagmi.ts                   # Reduced Arc retry count
```

---

## How to Run

### 1. Start Indexer (Base Sepolia only)
```bash
cd packages/indexer
rm -rf .ponder
pnpm dev
```

### 2. Start Web App
```bash
cd apps/web
pnpm dev
```

### 3. Create Test Market
Need to run a market creation script or use the LaunchpadEngine directly:
```bash
# Export for convenience
export LAUNCHPAD_ENGINE=0x4577fa4f54adb97E373785f09866831b6765E07B
```

---

## Known Issues / Notes

1. **No markets yet**: Fresh deployment has no markets. Need to create via LaunchpadEngine
2. **Arc/Monad disabled**: Indexer only indexes Base Sepolia. Re-enable in `ponder.config.ts` when ready
3. **ActivityListener disabled**: Event watching disabled on testnets to prevent RPC spam
4. **Old contracts still deployed**: Previous contracts still exist but are no longer used

---

## Next Steps

- [ ] Create test market on Base Sepolia
- [ ] Test order placement + indexer captures events
- [ ] Re-enable Monad/Arc in indexer after fresh deployments there
- [ ] Deploy to production (Railway/Render)
- [ ] Add PostgreSQL persistence for indexer

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `pnpm dev` (in indexer) | Start indexer |
| `rm -rf .ponder` | Clear indexer cache |
| `curl localhost:42069/status` | Check indexer sync |
| `curl localhost:42069/markets/84532` | List Base Sepolia markets |
