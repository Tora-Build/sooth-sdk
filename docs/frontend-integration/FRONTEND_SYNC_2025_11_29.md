# Frontend Sync Update - Nov 29, 2025

## ✅ Redeployment Complete

**Status**: LIVE and TRADEABLE
**Action Required**: Update `deployments.json` in your frontend.

### What Changed

1. **Vault Fixed**: Initialization issues resolved.
2. **Security Patch**: Decimals normalization implemented.
3. **New Addresses**: All contracts have been redeployed.

### Current State

- **Vault Liquidity**: 100,000 mUSDC (MockERC20)
- **Market 1 (ExampleMarket)**: `b ≈ 28,854`
- **Market 2 (SecondMarket)**: `b ≈ 28,854`
- **Trading**: Fully functional

---

## 🛠️ Integration Action Items

### 1. Update Contract Addresses

Ensure you are using the latest `deployments.json`.

```json
{
  "ExampleMarket": "0xBF72a0aCf1791bA3eA69A8F8aCDD8b6f1547508f",
  "SecondMarket": "0x2652E5c1Dc21b288CAE8C1981b65350AeaB11F2d"
}
```

### 2. Fetching `b` Parameter

You **MUST** fetch the `b` parameter dynamically for each market. Do not hardcode it.

```typescript
// Correct way to fetch b
const b = await riskManager.getBForMarket(marketId);
console.log("Current b:", b.toString()); // Should be ~28854 * 10^18 (in wei)
```

### 3. Slippage Protection (`maxCost`)

**CRITICAL UPDATE**: The contract logic for slippage protection has been simplified.

- **Formula**: Always use `cost <= maxCost` (algebraically).
- **For Buys (Long)**: `maxCost` is the **maximum** amount you are willing to pay (e.g., 102).
- **For Sells (Short)**: `maxCost` is the **minimum** amount you expect to receive (expressed as a negative number, e.g., -98).
  - Example: If you expect to receive 100 (`cost = -100`), and tolerate 2% slippage, `maxCost` should be `-98`.
  - The contract checks: `-100 <= -98` (True).
  - If price moves against you and you would only receive 90 (`cost = -90`), the check `-90 <= -98` is False (Revert).

This is a change from previous versions where sell logic might have been inverted. Please ensure your frontend logic aligns with this algebraic check.

### 4. Testing

You can now test full trade flows:

1. **Mint mUSDC**: Use the faucet or ask for tokens.
2. **Approve Vault**: Approve `SoothVault` to spend your mUSDC.
3. **Trade**: Call `market.trade()` with valid parameters.

---

## ❓ Troubleshooting

**Q: Why is my trade reverting with "Market: slippage exceeded"?**
A: Your `maxCost` is too tight. The market moves fast with `b=28,854`. Increase your slippage tolerance (e.g., to 2-5%) or check your price impact calculation.

**Q: Why is `b` changing?**
A: `b` scales with the vault's liquidity. If LPs deposit more, `b` increases (lower slippage). If the vault loses money, `b` decreases (higher slippage). Always fetch fresh `b`.
