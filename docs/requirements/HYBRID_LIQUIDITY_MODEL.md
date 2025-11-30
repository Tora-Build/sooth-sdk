# Requirement: Hybrid Liquidity Model (V2)

**Status:** Core Implemented (V2 Alpha)  
**Goal:** Incentivize market creators to drive volume by allowing markets to grow their own liquidity depth independently of the global vault.

---

## The Concept

Currently, Sooth uses a **Shared Liquidity Model**:

- All markets share one global `b` parameter derived from the Vault's total assets.
- `bMarket = bGlobal * RiskMultiplier`
- A market with $1M volume has the same depth as a market with $0 volume.

The **Hybrid Model** combines:

1.  **Base Liquidity:** Provided by the Global Vault (Shared).
2.  **Self-Earned Liquidity:** Derived from the specific market's accumulated fees/profits.

### Formula

```solidity
bMarket = (bGlobal * RiskMultiplier) + (MarketAccumulatedLiquidity * FeeMultiplier)
```

---

## Mechanism Design

### 1. Accumulating Liquidity

- When trades occur, a portion of the spread/fee is attributed to the specific `marketId`.
- This "Market Reserve" is tracked separately from the general Vault Treasury.

### 2. Boosting `b`

- The `SoothRiskManager` reads `MarketReserve[marketId]`.
- It adds a boost to the calculated `bMarket`.
- **Result:** High-volume markets become deeper (lower slippage), attracting even more volume (flywheel effect).

### 3. PnL Attribution (The Hard Part)

- **Profits:** If a market generates fees, its reserve grows -> `b` grows.
- **Losses:** If traders win big in a specific market:
  - Does the loss come from the **Market Reserve** first? (Yes, to protect LPs).
  - Does the loss come from the **Global Vault**? (Yes, if Market Reserve is empty).

---

## Benefits

1.  **Incentives:** Market creators/promoters are rewarded with a better product (deeper market) if they drive volume.
2.  **Fairness:** High-performing markets don't just subsidize low-performing ones; they get to keep some of their "weight".
3.  **Safety:** LPs still provide the backstop, but risky/active markets build their own buffer.

---

## Implementation Requirements

1.  **Vault Update:**

    - Track `mapping(uint256 => uint256) public marketReserves;`
    - Logic to credit fees to `marketReserves`.
    - Logic to debit losses from `marketReserves` before `totalAssets`.

2.  **RiskManager Update:**

    - Update `getBForMarket` to include the boost component.

3.  **Market Update:**
    - Report fees/spreads to the Vault during trading.

---

## Next Steps

- This is a **V2 Feature**.
- Current V1 focus is stability with the "Soft Cap" Shared Model.
