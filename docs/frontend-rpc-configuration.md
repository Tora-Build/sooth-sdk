# Frontend RPC Configuration & Deployment Guide

## Overview
The frontend (`apps/web`) uses a robust RPC configuration system that prioritizes private/custom RPC endpoints provided via environment variables, while automatically falling back to reliable public endpoints if private ones fail or are not configured.

This ensures high availability for end-users while allowing developers and deployments to use premium infrastructure for better performance.

## Architecture
The configuration is managed in `apps/web/src/lib/wagmi.ts` using a `createTransport` helper function.

**Priority Order:**
1.  **Primary:** Custom RPC set via `VITE_*_RPC_URL` environment variables.
2.  **Fallback(s):** Hardcoded list of verified public/official RPCs.

## Supported Networks

### 1. Base Sepolia (Chain ID: 84532)
*   **Env Variable:** `VITE_BASE_SEPOLIA_RPC_URL`
*   **Default Fallback:** `https://sepolia.base.org`

### 2. Monad Testnet (Chain ID: 10143)
*   **Env Variable:** `VITE_MONAD_TESTNET_RPC_URL`
*   **Default Fallback:** `https://rpc.ankr.com/monad_testnet`

### 3. MegaETH Testnet (Chain ID: 6343)
*   **Env Variable:** `VITE_MEGAETH_TESTNET_RPC_URL`
*   **Default Fallbacks:**
    1.  `https://carrot.megaeth.com/rpc` (Official)
    2.  `https://megaeth-testnet.g.alchemy.com/v2/jbMFWO2gYvRKxW5skck8K`

### 4. Arc Testnet (Chain ID: 5042002)
*   **Env Variable:** `VITE_ARC_TESTNET_RPC_URL`
*   **Verified Fallbacks:**
    1.  `https://rpc.blockdaemon.testnet.arc.network`
    2.  `https://rpc.drpc.testnet.arc.network`
    3.  `https://rpc.testnet.arc.network`
    4.  `https://rpc.quicknode.testnet.arc.network`
    *Note: `rpc-public` was removed as it was unresponsive.*

## Deployment Instructions

### Local Development
1.  Copy `apps/web/.env.example` to `apps/web/.env`.
2.  Populate the `VITE_*_RPC_URL` variables with your private API keys (Alchemy, QuickNode, etc.).
3.  Restart the dev server (`pnpm dev:web`).

### Render Deployment
Do **NOT** commit `.env` files. Instead:
1.  Go to the Render Dashboard for the `sooth-alpha-web` service.
2.  Navigate to **Environment**.
3.  Add the variables manually:
    *   `VITE_BASE_SEPOLIA_RPC_URL`
    *   `VITE_MONAD_TESTNET_RPC_URL`
    *   `VITE_MEGAETH_TESTNET_RPC_URL`
    *   `VITE_ARC_TESTNET_RPC_URL`

### Render Configuration Reference
For reference, the `render.yaml` defines the service as follows:

```yaml
  - type: web
    name: sooth-alpha-web
    runtime: node
    plan: starter
    region: singapore
    repo: https://github.com/Tora-Build/sooth-alpha
    branch: render
    rootDir: ""
    buildCommand: pnpm install && pnpm --filter ./apps/web build
    startCommand: node apps/web/server.js
    envVars:
      - key: NODE_VERSION
        value: 20
      # All VITE_ variables must be added manually in Render Dashboard:
      # - VITE_BASE_SEPOLIA_RPC_URL
      # - VITE_MONAD_TESTNET_RPC_URL
      # - VITE_MEGAETH_TESTNET_RPC_URL
      # - VITE_ARC_TESTNET_RPC_URL
      # - VITE_WALLETCONNECT_PROJECT_ID
      # - VITE_USE_INDEXER
      # - VITE_INDEXER_URL
```

## Recent UI Updates
*   **Social Links:** Added Telegram icon/link (`https://t.me/soothprotocol`) to the main Footer and Landing Page footer, grouped with the Twitter/X link.
