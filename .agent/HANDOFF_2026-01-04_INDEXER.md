# Handoff: Ponder Indexer Implementation
**Date**: 2026-01-04  
**Thread**: T-019b878e-baed-75aa-8adf-6ec2b7c21ddd

---

## What Was Done

### 1. Ponder Indexer Package (`packages/indexer/`)
- Created full Ponder v0.15.17 indexer for TickBookPoolManager events
- **Schema**: `market`, `order`, `fillClaim`, `marketOrder`, `tickLiquidity`
- **Events indexed**:
  - `MarketRegistered` → creates market record
  - `RangeOrderPlaced` → creates order + updates tick liquidity
  - `RangeOrderCancelled` → marks cancelled + decrements liquidity
  - `FillsClaimed` → records claim + updates order state
  - `MarketOrderExecuted` → records trade history
- **Chains**: Base Sepolia (84532), Monad Testnet (10143), Arc Testnet (5042002)
- **Start blocks**: ~35M (Base), ~3M (Monad), ~19M (Arc) to minimize backfill

### 2. REST API Endpoints
| Endpoint | Description |
|----------|-------------|
| `/orders/:chainId/:marketKey` | Active orders for market |
| `/orders/:chainId/:marketKey/:owner` | User's orders |
| `/orderbook/:chainId/:marketKey` | Pre-aggregated tick liquidity |
| `/trades/:chainId/:marketKey?limit=N` | Recent market order trades |
| `/markets/:chainId` | All registered markets |
| `/status` | Per-chain sync status (block numbers) |
| `/ready` | Returns 200 when ALL chains synced |

### 3. Frontend Integration
- **Per-chain readiness**: `checkChainReady(chainId)` in `config.ts`
- **Hooks updated** with per-chain checks:
  - `useOrdersIndexed` — orders with RPC fallback
  - `useOrderbookIndexed` — orderbook with RPC fallback  
  - `useTradesIndexed` — trades (indexer only)
- **Config**: `VITE_USE_INDEXER=true`, `VITE_INDEXER_URL=http://localhost:42070`

---

## Current State

### Indexer Status
- ✅ All 3 chains fully synced
- ✅ `/ready` returns 200
- ✅ Running on port 42070 (check with `curl http://localhost:42070/status`)

### Files Modified
```
packages/indexer/           # New package
├── ponder.config.ts        # Chain + contract config
├── ponder.schema.ts        # Table definitions
├── src/index.ts            # Event handlers
├── src/api/index.ts        # REST endpoints
├── src/abis/               # Contract ABI
├── .env -> ../../.env      # Symlink to root
└── .env.local              # Copy of root .env

apps/web/src/hooks/indexer/
├── config.ts               # Per-chain readiness check
├── useOrdersIndexed.ts     # Updated with chain check
├── useOrderbookIndexed.ts  # Updated with chain check
└── useTradesIndexed.ts     # Updated with chain check

apps/web/.env               # Added VITE_USE_INDEXER + VITE_INDEXER_URL
```

---

## How to Run

### Start Indexer
```bash
cd packages/indexer
rm -rf .ponder  # Clean state if needed
pnpm dev
```

### Start Web (separate terminal)
```bash
cd apps/web
pnpm dev
```

### Check Status
```bash
curl http://localhost:42070/status
curl http://localhost:42070/ready
```

---

## Known Issues / Caveats

1. **Port Conflict**: If restarted, indexer may use 42069 or 42070 — check logs
2. **PGlite Corruption**: If "PGlite is closed" errors, delete `.ponder/` and restart
3. **Rate Limiting**: Public RPCs may slow backfill; QuikNode RPC in `.env` helps Monad
4. **Start Blocks**: Hardcoded in `ponder.config.ts` — update if contracts redeployed

---

## Next Steps

- [ ] Deploy indexer to production (Railway/Render/etc)
- [ ] Add database persistence (PostgreSQL for prod)
- [ ] Wire `useTradesIndexed` into Pro page trade history panel
- [ ] Add WebSocket support for real-time updates
- [ ] Add `OrdersCrossed` and `TickCrossed` event handlers

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `pnpm dev` (in indexer) | Start indexer dev server |
| `rm -rf .ponder` | Clear indexer state/cache |
| `curl localhost:42070/status` | Check sync progress |
| `curl localhost:42070/ready` | Check if fully synced |
