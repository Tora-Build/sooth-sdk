# Render Deployment Guide (V10 Monorepo)

**Last Updated:** 2026-01-05
**Reference:** [render.yaml](../render.yaml) configuration

## Overview
Sooth Alpha V10 uses a **Blueprint (Infrastructure as Code)** approach for Render deployments. This ensures the Frontend, Indexer, and Database are deployed with consistent settings suitable for a pnpm monorepo.

## 1. Blueprint Configuration (`render.yaml`)
The deployment is defined in `render.yaml` at the project root. It orchestrates three services:

1.  **PostgreSQL Database (`sooth-db`)**
    *   Managed Postgres instance for the Indexer.
    *   Automatically provides `DATABASE_URL` to the Indexer service.

2.  **Indexer Service (`sooth-indexer`)**
    *   **Type:** Web Service (Node.js)
    *   **Root Directory:** *BLANK* (Essential for pnpm workspace resolution)
    *   **Build:** `pnpm install && pnpm --filter @sooth/indexer codegen`
    *   **Start:** `pnpm --filter @sooth/indexer start`
    *   **Critical Env Vars:** `BASE_SEPOLIA_RPC_URL`, `MONAD_TESTNET_RPC_URL` (Manual Entry)

3.  **Frontend Service (`sooth-alpha-web`)**
    *   **Type:** Web Service (Node.js) with Express server
    *   **Root Directory:** *BLANK*
    *   **Build:** `pnpm install && pnpm --filter ./apps/web build`
    *   **Start:** `node apps/web/server.js`
    *   **Critical Env Vars:** `VITE_` variables (Manual Entry)
    *   **API Proxies:** `/api/polymarket` → Gamma API, `/api/kalshi` → Kalshi API

## 2. Setup Instructions

### A. Push Configuration
Ensure the `render.yaml` file is committed and pushed to the `V10` branch:
```bash
git add render.yaml
git commit -m "chore: add render blueprint"
git push origin V10
```

### B. Create Blueprint on Render
1.  Log in to [Render Dashboard](https://dashboard.render.com/).
2.  Click **New +** -> **Blueprint**.
3.  Connect the `sooth-alpha` repository.
4.  Give the blueprint a name (e.g., `sooth-v10-stack`).
5.  Click **Apply**.

### C. Configure Manual Secrets
Render Blueprints do not commit access keys. You must add these manually in the Dashboard **after** the services are created (or during the setup prompt if available):

#### For Indexer (`sooth-indexer`):
*   `DATABASE_SCHEMA`: `public` (required for Ponder with PostgreSQL)
*   `BASE_SEPOLIA_RPC_URL`: *[Your Alchemy/Infura URL or `https://sepolia.base.org`]*
*   `MONAD_TESTNET_RPC_URL`: *[Your Monad RPC URL or `https://testnet-rpc.monad.xyz`]*
*   `ARC_TESTNET_RPC_URL`: *[Your Arc RPC URL or `https://rpc.arc.dev/testnet`]*

#### For Frontend (`sooth-alpha-web`):
*   `VITE_WALLETCONNECT_PROJECT_ID`: *[From cloud.walletconnect.com]*
*   `VITE_INDEXER_URL`: `https://sooth-indexer.onrender.com` *(your indexer URL)*

Optional (defaults work for most cases):
*   `VITE_USE_INDEXER`: Defaults to `true`. Set to `false` to disable indexer.

## 3. API Proxy Server

The frontend uses an Express server (`apps/web/server.js`) instead of a static file server. This enables API proxying in production:

| Route | Target | Purpose |
|-------|--------|---------|
| `/api/polymarket/*` | `gamma-api.polymarket.com` | Polymarket market data |
| `/api/kalshi/*` | `api.elections.kalshi.com` | Kalshi market data |

The same routes are configured in `vite.config.ts` for development.

## 4. Troubleshooting

### "Command not found: pnpm"
*   **Fix:** Ensure the `package.json` "engines" field specifies a compatible Node version or use the `NODE_VERSION` env var (set to 20 in blueprint). Render installs pnpm automatically for Node environments.

### "Module not found" / Workspace Errors
*   **Cause:** Setting "Root Directory" to a subdirectory (e.g., `apps/web`) breaks pnpm monorepo resolution.
*   **Fix:** Ensure **Root Directory** is empty/blank in the service settings.

### Database Connection Failures
*   **Cause:** Indexer starting before Database is ready.
*   **Fix:** The blueprint handles dependency ordering, but on first run, the DB might take a moment. Restart the Indexer service if it fails initially.

## 5. Manual Deployments (Without Blueprint)
If you choose *not* to use the Blueprint, configure services individually:

*   **Indexer**:
    *   Root Dir: *(Empty)*
    *   Build: `pnpm install && pnpm --filter @sooth/indexer codegen`
    *   Start: `pnpm --filter @sooth/indexer start`
*   **Frontend**:
    *   Root Dir: *(Empty)*
    *   Build: `pnpm install && pnpm --filter ./apps/web build`
    *   Start: `npx serve -s apps/web/dist`
