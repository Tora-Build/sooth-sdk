# Frontend Integration Summary - Hybrid Liquidity Update

**Date:** 2025-11-30  
**Status:** ✅ DEPLOYED TO BASE SEPOLIA  
**Priority:** HIGH - Breaking Changes

> **🎉 NOW LIVE:**  
> The Hybrid Liquidity Model is **DEPLOYED** to Base Sepolia.  
> **Update your contract addresses and approval flow immediately!**  
> See [DEPLOYMENT_2025_11_30.md](./DEPLOYMENT_2025_11_30.md) for details.

---

## 🚨 Critical Changes You Must Make

### 1. Approve the Vault, Not the Market

```javascript
// ❌ OLD (WILL FAIL):
await collateral.approve(marketAddress, ethers.MaxUint256);

// ✅ NEW (CORRECT):
await collateral.approve(vaultAddress, ethers.MaxUint256);
```

**Why?** The vault now handles all token transfers directly via `recordMarketFlow()`.

---

### 2. Fetch `b` Dynamically Per Market

```javascript
// ❌ OLD (WRONG):
const b = 28854; // Hardcoded

// ✅ NEW (CORRECT):
const b = await riskManager.getBForMarket(marketId);
```

**Why?** Markets now have individual liquidity that grows with trading volume (Hybrid Model).

---

### 3. Use Linear AMM Formula

```javascript
// ✅ Price calculation:
const price = 0.5 + (qYes - qNo) / (2 * b);

// ✅ Cost estimation:
const priceBefore = 0.5 + (qYes - qNo) / (2 * b);
const priceAfter = 0.5 + (qYes + delta - qNo) / (2 * b);
const avgPrice = (priceBefore + priceAfter) / 2;
const cost = avgPrice * delta;
```

**Why?** We switched from LMSR to Linear AMM (`SoothBalancedAMM`).

---

## 📋 Updated ABIs

### SoothVault - New Functions

```typescript
// Track market-specific flows
function recordMarketFlow(
  marketId: bigint,
  amount: bigint, // + = user pays, - = user receives
  user: string
): Promise<void>;

// Get market reserves
function getMarketReserve(marketId: bigint): Promise<bigint>;

// Settlement (now requires marketId)
function applySettlementDelta(
  marketId: bigint, // NEW parameter
  account: string,
  pnlDelta: bigint
): Promise<void>;
```

### SoothRiskManager - Updated Function

```typescript
// Now includes hybrid boost
function getBForMarket(marketId: bigint): Promise<bigint>;

// New config
reserveMultiplierBps: bigint; // Default: 10000 (1x)
```

---

## 🎯 Quick Integration Steps

### Step 1: Update Contract Instances

```javascript
import { vaultABI, riskManagerABI, ammABI } from "./abis";

const vault = new ethers.Contract(VAULT_ADDRESS, vaultABI, signer);
const riskManager = new ethers.Contract(
  RISK_MANAGER_ADDRESS,
  riskManagerABI,
  provider
);
const amm = new ethers.Contract(AMM_ADDRESS, ammABI, provider);
```

### Step 2: Trading Flow

```javascript
async function executeTrade(marketId, outcomeIndex, deltaShares) {
  // 1. Get current b
  const b = await riskManager.getBForMarket(marketId);

  // 2. Get market state
  const { qYes, qNo } = await market.ammState();

  // 3. Estimate cost
  const [cost, newState] = await amm.costDelta(
    { qYes, qNo },
    outcomeIndex,
    deltaShares,
    b
  );

  // 4. Add slippage (2%)
  const maxCost = (cost * 102n) / 100n;

  // 5. Ensure vault approval
  const allowance = await collateral.allowance(userAddress, vaultAddress);
  if (allowance < cost) {
    await collateral.approve(vaultAddress, ethers.MaxUint256);
  }

  // 6. Execute trade
  const tx = await market.trade(outcomeIndex, deltaShares, maxCost);
  await tx.wait();

  return tx;
}
```

### Step 3: Display Market Health (Optional)

```javascript
async function getMarketHealth(marketId) {
  const reserve = await vault.getMarketReserve(marketId);
  const reserveUSD = ethers.formatUnits(reserve, 18);

  return {
    reserve: reserveUSD,
    isHealthy: reserve > 0,
    displayText:
      reserve > 0
        ? `+$${reserveUSD}`
        : reserve < 0
        ? `-$${Math.abs(reserveUSD)}`
        : "$0",
  };
}
```

---

## 🔍 What is the Hybrid Liquidity Model?

Markets now have **two sources** of liquidity:

1. **Base (Global)**: Shared vault liquidity
2. **Boost (Local)**: Market-specific accumulated profits

```
bMarket = (bGlobal × RiskMultiplier) + (MarketReserve × ReserveMultiplier)
```

**Example:**

- Market A (new): `bMarket = 25,000` (only global)
- Market B (popular): `bMarket = 25,000 + 5,000 = 30,000` (global + boost)

**Result:** Market B has 20% deeper liquidity → lower slippage → attracts more traders!

---

## 📊 Monitoring & Events

### Listen to Market Flow

```javascript
vault.on("MarketFlow", (marketId, amount, newReserve, event) => {
  console.log(`Market ${marketId}:`);
  console.log(`  Flow: ${ethers.formatUnits(amount, 18)} USDC`);
  console.log(`  New Reserve: ${ethers.formatUnits(newReserve, 18)} USDC`);

  // Refresh market display
  refreshMarketLiquidity(marketId);
});
```

### Monitor Global B Updates

```javascript
riskManager.on("GlobalBUpdated", (bGlobal, Lmax, T, B, event) => {
  console.log(`Global b updated: ${ethers.formatUnits(bGlobal, 18)}`);

  // Refresh all market displays
  refreshAllMarkets();
});
```

---

## ✅ Testing Checklist

- [ ] Approve vault (not market) before trading
- [ ] Fetch fresh `b` for each market
- [ ] Use linear AMM formula for price calculations
- [ ] Test slippage protection (buy and sell)
- [ ] Verify market reserves display correctly
- [ ] Test with multiple markets
- [ ] Monitor `MarketFlow` events
- [ ] Handle edge cases (b=0, large trades)

---

## 📚 Full Documentation

For complete details, see:

- **[LIQUIDITY_AND_AMM_UPDATE_2025_11_30.md](./LIQUIDITY_AND_AMM_UPDATE_2025_11_30.md)** - Comprehensive guide
- **[HYBRID_LIQUIDITY_MODEL.md](../requirements/HYBRID_LIQUIDITY_MODEL.md)** - Requirement spec

---

## 🆘 Need Help?

**Common Issues:**

1. **"ERC20: allowance" error**

   - Solution: Approve vault, not market

2. **"Market: slippage exceeded"**

   - Solution: Increase slippage tolerance or fetch fresh `b`

3. **Unexpected price impact**

   - Solution: Use linear formula, not LMSR

4. **`b` is 0**
   - Solution: Ensure vault has liquidity and `updateGlobalB()` was called

---

**Last Updated:** 2025-11-30  
**Version:** V2 Alpha
