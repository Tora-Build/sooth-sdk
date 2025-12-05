# Deployment Files Organization

## Current Structure

```
sooth-alpha/
├── deployments-v3.json          # Current v3 deployment (synced from docs/)
├── deployments/
│   ├── README.md                 # This file
│   └── v2-archive/              # Historical v2 deployments
│       ├── deployments-base.json
│       ├── deployments-monad.json
│       ├── deployments.json
│       ├── markets-base.json
│       ├── markets-monad.json
│       └── markets.json
└── docs/technical/frontend-integration/
    └── deployments-v3.json      # Canonical source
```

## Sync Locations

`deployments-v3.json` is synced to 3 locations:

1. **Canonical:** `docs/technical/frontend-integration/deployments-v3.json`
2. **Root:** `deployments-v3.json` (for easy access)
3. **DApp:** `../sooth-dapp/docs/contract-integration/deployments-v3.json`

## How to Update

1. Edit the canonical file: `docs/technical/frontend-integration/deployments-v3.json`
2. Run sync script: `./sync-deployments.sh`

## v3 Deployment Info

**Networks:**

- ✅ Base Sepolia (Live)
- ⏸️ Monad Testnet (Paused - needs funding)

**Contracts:**

- TraderVaultV3: Single entry point for all trading
- MarketV3: Unified orderbook (Sell YES = Buy NO)
- GovernorVault: LP liquidity pool
- FeeController: Fee management
- AMM: LMSR pricing
