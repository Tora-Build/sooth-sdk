# Frontend Sync Update - Nov 29, 2025

> **⚠️ IMPORTANT UPDATE (Nov 30, 2025):**  
> **This document is now superseded by the comprehensive guide:**  
> **[LIQUIDITY_AND_AMM_UPDATE_2025_11_30.md](./LIQUIDITY_AND_AMM_UPDATE_2025_11_30.md)**
>
> The new guide includes:
>
> - Hybrid Liquidity Model implementation details
> - Updated ABI specifications
> - Complete code examples and integration patterns
> - Critical approval flow changes (approve Vault, not Market!)
>
> **Please read the new guide before integrating.**

---

## ✅ Final Deployment Complete - ERC4626-Compliant

**Status**: LIVE and TRADEABLE  
**Vault**: Fully ERC4626-compliant  
**Action Required**: Update `deployments.json` in your frontend

### What Changed

1. **Vault Now ERC4626-Compliant**: Full standard implementation with ERC20 share tokens
2. **AMM Switched to `SoothBalancedAMM`**:
   - Replaced `SoothLMSRReal` (which had math issues)
   - New Pricing Formula: `p = 0.5 + (qYes - qNo) / 2b`
   - **Action**: Ensure frontend uses this linear formula for price impact estimates.
3. **Security Patch**: Decimals normalization implemented
4. **All Issues Resolved**: Vault functions (`totalSupply`, `maxDeposit`, etc.) all working

### Current State

- **Vault Liquidity**: 100,000 mUSDC (MockERC20)
- **Vault Shares**: "Sooth Vault Shares" (svToken)
- **Market 1 (ExampleMarket)**: `b ≈ 28,854`
- **Market 2 (SecondMarket)**: `b ≈ 28,854`
- **Trading**: Fully functional
- **LP Operations**: Fully functional

---

## 🛠️ Integration Action Items

### 1. Update Contract Addresses

**IMPORTANT**: Use these NEW addresses (ERC4626-compliant vault):

```json
{
  "MockERC20": "0x677b261597bFc4aCC149302e3c7b57ac957D2B28",
  "SoothVault": "0x574d7225e5f4BaDEF135A065FfC40Bf2E90E34aC",
  "SoothRiskManager": "0x6B1186ba40eF1C33B3Dac2b6bAb25F9C66D51d67",
  "ExampleMarket": "0xC3E585Be9c52C06f2aFa2913e3EA663fB9243E02",
  "SecondMarket": "0x3922e30455Fa960aC548651D54581ED46260D47f"
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
