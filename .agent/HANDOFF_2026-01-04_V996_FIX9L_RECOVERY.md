# Handoff: V9.9.6-fix9l Recovery
**Date**: 2026-01-04  
**Thread**: T-019b886c-38dd-7729-a379-498b07f03250

---

## What Was Done

### 1. Contract Recovery
- Identified that the previous Base Sepolia deployment used wrong contract version (missing `getAllMarketOrders`)
- Recovered `TickBookPoolManagerV996.sol` from git history (commit `2573a15`)
- Replaced `TickBookPoolManager.sol` with correct V9.9.6-fix9l version
- Key features restored:
  - `placeOrder()` unified API
  - `getAllMarketOrders(marketKey)` for order enumeration
  - `getNextOrderId()` view function
  - Auto-claim before new orders

### 2. Fresh Deployment (Base Sepolia)
Deployed at block ~35,877,100:

| Contract | Address |
|----------|---------|
| MockUSDC | `0x0C31bbB6dA82ba97fBAfBe3425ee8757a4d724e3` |
| Collateralizer | `0xE1976fDF7fDe2a2F933a7860326Ed12121358e79` |
| AMMEngine | `0xf50A729Df4078812edffe9355b73ABF916973629` |
| TickBookVault | `0x6109B9C9FdD88842da3b49E7cb3DE04F21E083dc` |
| TickBookPoolManager | `0xa613fe3F71fCa0913964E8f9c8b4e3f0320fC060` |
| LaunchpadEngine | `0x3530A1e0519E6e81b5a41074bf253E56757fefF6` |

### 3. CLI Fixes
- Fixed ABI: `placeRangeOrder` → `placeOrder`
- Fixed argument order: `(marketKey, outcome, shares, tickLower, tickUpper, maxCost)`
- Removed PoolManager from allowance check (not needed for vault-based flow)
- Updated all variable names to match new return values

### 4. Config Sync
Updated all deployment configs:
- `packages/contracts-core/deployments/v9-baseSepolia.json`
- `apps/web/src/config/deployments.json`
- `packages/indexer/ponder.config.ts`

---

## Files Modified

```
packages/contracts-core/
├── src/TickBookPoolManager.sol       # Replaced with V996 version
├── src/TickBookPoolManagerV996.sol   # Recovered from git
├── deployments/v9-baseSepolia.json   # New addresses

packages/contracts-testing/script/interactive/
├── config.ts                         # Fixed ABI (placeOrder)
├── commands/orderbook.ts             # Fixed function calls
├── commands/market.ts                # Fixed simulate command
├── commands/wallet.ts                # Removed PoolManager allowance

apps/web/src/config/
├── deployments.json                  # New Base Sepolia addresses

packages/indexer/
├── ponder.config.ts                  # New address + start block
```

---

## Next Steps

- [ ] Start CLI: `cd packages/contracts-testing && bun run interactive:base`
- [ ] Create market: `createmarket alien 500`
- [ ] Test simulate: `simulate 20`
- [ ] Start indexer: `cd packages/indexer && rm -rf .ponder && pnpm dev`
- [ ] Start frontend: `cd apps/web && pnpm dev`
- [ ] Verify frontend shows orderbook/orders/trades

---

## Key Learnings

1. **Version Control**: The stress-tested V9.9.6-fix9l was in `TickBookPoolManagerV996.sol`, not `TickBookPoolManager.sol`
2. **API Differences**:
   - V996: `placeOrder(marketKey, outcome, shares, tickLower, tickUpper, maxCost)` → 4 return values
   - Old: `placeRangeOrder(marketKey, outcome, tickLower, tickUpper, shares)` → 3 return values
3. **PoolManager Allowance**: Not needed - vault handles all USDC internally

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `bun run interactive:base` | Start CLI for Base Sepolia |
| `createmarket alien 500` | Create test market |
| `simulate 20` | Run orderbook simulation |
| `rm -rf .ponder && pnpm dev` | Reset and start indexer |
| `curl localhost:42069/status` | Check indexer sync |
