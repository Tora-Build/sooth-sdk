# Liquidity Model & AMM Update - Nov 30, 2025

**Target Audience:** Frontend Developers  
**Topic:** Hybrid Liquidity Model, AMM Logic, and Vault Relationships  
**Status:** ✅ DEPLOYED TO BASE SEPOLIA

> **🎉 NOW LIVE:**  
> This document describes the **DEPLOYED implementation** on Base Sepolia.  
> See [DEPLOYMENT_2025_11_30.md](./DEPLOYMENT_2025_11_30.md) for contract addresses and integration steps.

---

## 🚨 Executive Summary for Frontend

1.  **Hybrid Liquidity is Live**: Markets now grow their own liquidity depth (`b`) based on their accumulated fees/PnL.
2.  **AMM is LMSR**: `SoothLMSRReal` (PRBMath-backed) replaces the temporary linear fallback.
3.  **Action Required**:
    - Update `SoothRiskManager` and `SoothVault` ABIs.
    - Understand that `b` is dynamic per market (not just global).
    - Ensure price impact calculations use the Linear AMM formula.
    - **Users must approve `SoothVault` (not the market contract) for trading**.

---

## 1. The Hybrid Liquidity Model (New!)

Previously, a market's liquidity (`b`) was purely a slice of the global vault. Now, markets have **two** sources of liquidity:

1.  **Base Liquidity (Global)**: Provided by LPs in the shared vault.
2.  **Self-Earned Liquidity (Local)**: Accumulated from trading fees and settlement profits specific to that market.

### The New Formula

```solidity
// SoothRiskManager.sol - getBForMarket()

bMarket = BaseComponent + BoostComponent

Where:
BaseComponent  = (bGlobal * RiskMultiplier) / 10000
BoostComponent = (MarketReserve * ReserveMultiplier) / 10000  [if MarketReserve > 0]
```

- **MarketReserve**: The net PnL (fees + settlement wins - settlement losses) accumulated by this specific market.
- **ReserveMultiplier**: Currently set to `10000 bps` (1x). 1 USDC of profit adds 1 USDC to `b`.
- **RiskMultiplier**: Depends on market risk class (LOW: 60%, MEDIUM: 100%, HIGH: 140%, CRITICAL: 180%).

### Why This Matters for UI

- **Dynamic `b`**: A popular market will have a **higher `b`** (lower slippage) than a new market, even if they have the same risk class.
- **Flywheel Effect**: Users trading on a market makes it deeper, attracting more users.
- **Visualizing**: You can optionally show "Market Reserves" to indicate how healthy a specific market is.

### Example

```
Market 1 (MEDIUM, new):
  bGlobal = 25,000 USDC
  MarketReserve = 0 USDC
  bMarket = 25,000 * 1.0 + 0 = 25,000 USDC

Market 2 (MEDIUM, popular):
  bGlobal = 25,000 USDC
  MarketReserve = 5,000 USDC (accumulated from trading)
  bMarket = 25,000 * 1.0 + 5,000 * 1.0 = 30,000 USDC

Result: Market 2 has 20% deeper liquidity!
```

---

## 2. AMM & Pricing Logic (SoothLMSRReal)

We reverted to **true LMSR** with a fixed implementation (`SoothLMSRReal`) using PRBMath for `exp/ln`. Use on-chain helpers:

```javascript
const price = await amm.price({ qYes, qNo }, outcomeIndex, b); // 18-decimal price
const [cost, newState] = await amm.costDelta(
  { qYes, qNo },
  outcomeIndex,
  deltaShares,
  b
);
```

- LMSR bound: worst-case loss ≈ `b * ln(2)`.
- Pricing remains path-independent; rely on contract outputs instead of hand-rolled formulas.

---

## 3. Core Liquidity Concepts (Refresher)

### 3.1 Vault TVL vs. Buffer

- **Treasury (T)**: Total assets in the vault (`totalAssets`).
- **Locked Exposure (L)**: Capital reserved for active markets (`totalLockedExposure`).
- **Buffer (B)**: Available capital for new markets (`T - L`).

### 3.2 The Global `b` Flow

1.  **LPs Deposit**: Increases `T` and `B`.
2.  **Market Created**:
    - Calculates `Lmax` (Max loss per market) based on **Soft Cap Model**: `min(T/K, B)`.
    - Derives `bGlobal` from `Lmax * 1.4427`.
    - Allocates exposure, which increases `L` and decreases `B`.
3.  **Result**: Creating new markets slightly reduces `bGlobal` for everyone (dilution), but profitable markets earn it back via the Hybrid Boost.

### 3.3 Soft Cap Model (Updated)

The previous formula `(T + B) / K` has been replaced with a **Soft Cap Model**:

```solidity
// SoothRiskManager.sol - updateGlobalB()

uint256 fairShare = T / K;
uint256 available = B;
uint256 Lmax = fairShare < available ? fairShare : available;
```

**Behavior:**

- Markets 1 to K get full `T/K` size (consistent).
- Market K+1 gets whatever is left in B (instead of reverting).
- Prevents the "early failure" of the previous model.

---

## 4. ABI Changes & New Functions

### 4.1 SoothVault (New Functions)

```solidity
// Record trading flow for a specific market
function recordMarketFlow(
    uint256 marketId,
    int256 amount,      // Positive: user pays vault, Negative: vault pays user
    address user
) external;

// Get accumulated reserves for a market
function getMarketReserve(uint256 marketId) external view returns (int256);

// Settlement now requires marketId
function applySettlementDelta(
    uint256 marketId,   // NEW: market identifier
    address account,
    int256 pnlDelta
) external;
```

**Event:**

```solidity
event MarketFlow(
    uint256 indexed marketId,
    int256 amount,
    int256 newReserve
);
```

### 4.2 SoothRiskManager (Updated Function)

```solidity
// Now includes hybrid boost
function getBForMarket(uint256 marketId) external view returns (uint256);

// New configuration
uint256 public reserveMultiplierBps;  // Default: 10000 (1x)
```

### 4.3 SoothLMSRReal (Reference)

```solidity
struct State {
    int256 qYes;
    int256 qNo;
}

    function price(State memory s, uint8 outcomeIndex, uint256 b) external pure returns (uint256 priceWad);

    function costDelta(State memory s, uint8 outcomeIndex, int256 deltaShares, uint256 b)
        external
        pure
        returns (int256 cost, State memory newState);
```

---

## 5. Integration Checklist

### ✅ Critical Changes

1.  **Approve Vault, Not Market**:

    ```javascript
    // OLD (WRONG):
    await collateral.approve(marketAddress, amount);

    // NEW (CORRECT):
    await collateral.approve(vaultAddress, amount);
    ```

2.  **Fetch `b` Per Market**:

    ```javascript
    // Do NOT cache or assume b is constant
    const b = await riskManager.getBForMarket(marketId);
    ```

3.  **Use Linear AMM Formula**:
    ```javascript
    // Update your price impact calculations
    const price = 0.5 + (qYes - qNo) / (2 * b);
    ```

### ✅ Optional Enhancements

1.  **Show Market Health**:

    ```javascript
    const reserve = await vault.getMarketReserve(marketId);
    const reserveUSD = ethers.formatUnits(reserve, 18);

    // Display: "Market Reserves: +$5,234" (green if positive)
    ```

2.  **Monitor Market Flow Events**:

    ```javascript
    vault.on("MarketFlow", (marketId, amount, newReserve) => {
      console.log(
        `Market ${marketId} flow: ${amount}, new reserve: ${newReserve}`
      );
      // Refresh market liquidity display
    });
    ```

3.  **Show Liquidity Breakdown**:

    ```javascript
    const bGlobal = await riskManager.globalRisk().bGlobal;
    const bMarket = await riskManager.getBForMarket(marketId);
    const boost = bMarket - bGlobal;

    // Display: "Base: 25k | Boost: +5k | Total: 30k"
    ```

---

## 6. Example Data Flow

### Scenario: User Trades on Market #1

1.  **User Views Market #1**:

    ```javascript
    const marketId = 1;
    const b = await riskManager.getBForMarket(marketId);
    // Returns: 30,000 (25k base + 5k boost)

    const { qYes, qNo } = await market.ammState();
    const price = calculatePrice(qYes, qNo, b);
    // Display: "Current Price: 0.52 YES"
    ```

2.  **User Quotes Buy 100 YES**:

    ```javascript
    const deltaShares = ethers.parseUnits("100", 18);
    const [cost, newState] = await amm.costDelta(
      { qYes, qNo },
      0, // YES
      deltaShares,
      b
    );

    const costUSD = ethers.formatUnits(cost, 18);
    // Display: "Cost: 52.5 USDC"

    // Add slippage (2%)
    const maxCost = (cost * 102n) / 100n;
    ```

3.  **User Submits Trade**:

    ```javascript
    // Ensure vault is approved
    const allowance = await collateral.allowance(userAddress, vaultAddress);
    if (allowance < cost) {
      await collateral.approve(vaultAddress, ethers.MaxUint256);
    }

    // Execute trade
    const tx = await market.trade(
      0, // outcomeIndex (YES)
      deltaShares, // deltaShares
      maxCost // maxCost (slippage protection)
    );

    await tx.wait();
    ```

4.  **Backend Updates**:
    - Vault records `+52.5 USDC` to `marketReserves[1]`.
    - Next call to `getBForMarket(1)` returns `30,052.5` (slightly higher!).

---

## 7. Slippage Protection (Detailed)

The contract uses an **algebraic check**: `cost <= maxCost`.

### For Buys (cost > 0)

```javascript
const expectedCost = 100; // USDC
const slippageTolerance = 0.02; // 2%

const maxCost = expectedCost * (1 + slippageTolerance);
// maxCost = 102

// Contract checks: actualCost <= 102
// If actualCost = 101 → ✅ Pass
// If actualCost = 103 → ❌ Revert "Market: slippage exceeded"
```

### For Sells (cost < 0)

```javascript
const expectedProceeds = -100; // Negative cost means we receive
const slippageTolerance = 0.02;

// We want to receive AT LEAST 98 (tolerating 2% worse)
const maxCost = expectedProceeds * (1 - slippageTolerance);
// maxCost = -100 * 0.98 = -98

// Contract checks: actualCost <= -98
// If actualCost = -100 → ✅ Pass (we got 100, better than 98)
// If actualCost = -95  → ❌ Revert (we only got 95, worse than 98)
```

---

## 8. Testing Checklist

- [ ] Verify `collateral.approve(vaultAddress)` before trading
- [ ] Fetch fresh `b` for each market before price calculations
- [ ] Test slippage protection with tight `maxCost`
- [ ] Monitor `MarketFlow` events to track reserve changes
- [ ] Display market reserves in UI (optional)
- [ ] Test with both positive and negative market reserves
- [ ] Verify price calculations match Linear AMM formula
- [ ] Test edge cases: `b = 0`, very large trades, balanced markets

---

## 9. Summary of Key Changes

| Aspect            | Old Behavior                      | New Behavior                                |
| ----------------- | --------------------------------- | ------------------------------------------- |
| **Liquidity**     | Pure global vault share           | Hybrid: Global + Market-specific reserves   |
| **`b` Parameter** | Static per risk class             | Dynamic per market (grows with volume)      |
| **AMM**           | SoothLMSRReal (broken)            | SoothLMSRReal (fixed, LMSR)                 |
| **Approval**      | Market contract                   | **Vault contract**                          |
| **Settlement**    | `applySettlementDelta(user, pnl)` | `applySettlementDelta(marketId, user, pnl)` |
| **Market Flow**   | Not tracked                       | Tracked via `recordMarketFlow()`            |

---

## 10. Quick Reference

### Contract Addresses (Update from deployments.json)

```javascript
const VAULT_ADDRESS = "0x..."; // SoothVault
const RISK_MANAGER_ADDRESS = "0x..."; // SoothRiskManager
const AMM_ADDRESS = "0x..."; // SoothLMSRReal
```

### Key Functions

```javascript
// Get market liquidity
const b = await riskManager.getBForMarket(marketId);

// Get market reserves
const reserve = await vault.getMarketReserve(marketId);

// Get current price
const price = await amm.price({ qYes, qNo }, outcomeIndex, b);

// Estimate cost
const [cost, newState] = await amm.costDelta(
  { qYes, qNo },
  outcomeIndex,
  deltaShares,
  b
);

// Execute trade
await market.trade(outcomeIndex, deltaShares, maxCost);
```

---

**Last Updated:** 2025-11-30  
**Version:** V2 Alpha  
**Questions?** Check the contract source or ask the dev team.
