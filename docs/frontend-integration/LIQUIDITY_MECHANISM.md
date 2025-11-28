# Liquidity & Exposure Mechanism

## 1. Shared Liquidity Model

Sooth Protocol uses a **Shared Liquidity Vault** model.

- **Pooled Assets**: All LPs deposit into a single `SoothVault`.
- **No Token Transfers**: Tokens are **NOT** sent to individual market contracts. They remain in the vault.
- **Virtual Allocation**: Markets "reserve" capacity in the vault. This is called `lockedExposure`.

## 2. How Markets Get Liquidity

Liquidity distribution is **Virtual** and **Automatic**.

### The Process

1.  **Market Creation**: When `SoothMarketFactory.createMarket()` is called:
    - It calculates the maximum exposure (`Lmax`) needed for the market based on its risk class.
    - It calls `vault.allocateExposure(marketId, Lmax)`.
2.  **Vault Accounting**:

    - The vault increases `lockedExposure[marketId]`.
    - It increases `totalLockedExposure`.
    - This reduces the `getLiquidBufferBalance()` (available liquidity for other markets).

3.  **Result**:
    - The market now has "permission" to risk that amount of LP funds.
    - No tokens moved.

### Automatic vs. Manual

- **Automatic (Default)**: The factory attempts to allocate exposure immediately upon creation.
- **Manual (Fallback)**: If the vault is paused or lacks sufficient buffer at creation time, the market is created with **0 allocated exposure**.
  - **Fix**: The Vault Owner (Guardian) must manually call `vault.allocateExposure(marketId, amount)` later.

## 3. Frontend Implications

### Do I need to send tokens to the market?

**NO**. You only interact with the `SoothVault` for LP deposits/withdrawals.

### How do I know a market's capacity?

Check `vault.lockedExposure(marketId)`.

```typescript
const exposure = await vault.lockedExposure(marketId);
console.log(
  `Market ${marketId} has ${ethers.formatEther(
    exposure
  )} ETH allocated capacity`
);
```

### What if a market has 0 exposure?

It means the automatic allocation failed or wasn't required. The market can still operate, but it might be constrained by risk limits if `bGlobal` depends on it (though currently `bGlobal` is global). _Note: In the current alpha, 0 exposure markets function fine, but for strict risk management, exposure should be allocated._

## 4. Settlement Flow

When a market settles:

1.  **PnL Calculation**: Off-chain engine calculates net PnL.
2.  **Claiming**: Users call `settlement.claimSettlement()`.
3.  **Payout**: The **Vault** (not the market) sends tokens to the user via `vault.applySettlementDelta()`.

---

**Summary**: Liquidity is **shared** and **virtually allocated**. No manual distribution of tokens is needed for normal operations.
