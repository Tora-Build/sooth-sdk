# Frontend Dev Note (Nov 29)

1. **New Addresses**: Contracts redeployed. Pull latest `docs/frontend-integration/deployments.json`.
2. **Markets Live**: Liquidity added. `b` parameter is now non-zero (~2.6e22 wei). Fetch it dynamically.
3. **Slippage Logic Fixed**: Contract now uses `cost <= maxCost` (algebraic) for BOTH buys and sells.
   - **Sell Example**: Expect receive 100 (`cost = -100`), 2% tolerance -> `maxCost = -98`.
4. **Docs**: See `docs/frontend-integration/FRONTEND_SYNC_2025_11_29.md` for details.
