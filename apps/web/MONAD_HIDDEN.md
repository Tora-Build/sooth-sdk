# Monad Network - Temporarily Hidden

**Date:** 2025-12-04  
**Reason:** V3 contracts not yet deployed to Monad Testnet

## Changes Made

### 1. Chain Configuration

- **File:** `src/lib/chains.ts`
  - Commented out `monadTestnet` chain definition
  - Removed Monad from `allowedChains` array
  - Removed Monad from `wagmiChains` export

### 2. Wagmi Configuration

- **File:** `src/lib/wagmi.ts`
  - Removed `monadTestnet` import
  - Commented out Monad transport configuration

### 3. Deployment Addresses

- **File:** `src/config/deployments.json`
  - Removed entire `10143` (Monad) deployment configuration

### 4. Landing Page

- **File:** `src/pages/Landing.tsx`
  - Removed "Monad Testnet Live" badge

### 5. Markets Configuration

- **File:** `src/config/markets.json`
  - Removed all 5 Monad markets (chainId: 10143):
    - monad_btc
    - monad_eth_gas
    - monad_launch
    - monad_tvl
    - monad_top10
  - **Backup:** Markets saved to `src/config/markets-backup-monad.json`

## To Re-enable Monad

When v3 is deployed to Monad:

1. Uncomment chain definitions in `src/lib/chains.ts`
2. Uncomment transport in `src/lib/wagmi.ts`
3. Add deployment addresses to `src/config/deployments.json`
4. Restore landing page badge in `src/pages/Landing.tsx`
5. Restore markets from `src/config/markets-backup-monad.json`

## Current Status

- ✅ **Base Sepolia (84532)**: Live with v3 contracts
- ⏸️ **Monad Testnet (10143)**: Hidden - awaiting v3 deployment
