# Liquidity Dynamics & Fees

**Date:** 2025-12-05
**Status:** Implemented (v3)
**Impact:** Market Depth, LP profitability

---

## Executive Summary

Sooth v3 implements a **Dynamic Liquidity Model** where market depth (`b`) scales with trading activity. This incentivizes LPs by increasing capital efficiency as markets prove their demand, and provides traders with better slippage on popular markets.

---

## 1. The Dynamic Liquidity Formula

Market liquidity (`b`) is calculated dynamically on-chain based on a vault-configured base and the market's accumulated reserves.

### **The Formula**

```
b_market = b_base + (positive_reserve × reserveFactor)
```

Where:

- **`b_base`**: The initial liquidity allocated to the market by the Governor Vault (e.g., 10,000 USDC).
- **`reserve`**: The net accumulated PnL/fees of the market (starts at 0).
- **`reserveFactor`**: A multiplier enabling liquidity growth (e.g., 10% or 0.1x).

### **Example**

1.  **Initialization**:

    - `b_base` = 10,000 USDC
    - `reserve` = 0
    - **Effective `b` = 10,000**

2.  **Trading Activity**:

    - AMM earns 500 USDC in fees.
    - `reserve` increases to 500.

3.  **Liquidity Boost**:
    - `reserveFactor` = 0.1 (10%)
    - Boost = 500 \* 0.1 = 50
    - **Effective `b` = 10,050**

---

## 2. Vault Configuration

The `SoothGovernorVault` holds default configuration parameters used when creating new markets. This allows the DAO/Governor to tune protocol-wide risk and liquidity settings.

| Parameter          | Default Value       | Description                              |
| :----------------- | :------------------ | :--------------------------------------- |
| `defaultBBase`     | **10,000 USDC**     | Initial `b` liquidity for new markets.   |
| `defaultFeeBps`    | **50 bps (0.5%)**   | Trading fee charged by the AMM.          |
| `reserveFactorBps` | **1000 bps (0.1x)** | Multiplier for dynamic liquidity growth. |

**Changing Defaults:**
Calling `setVaultConfig(...)` updates these defaults. Existing markets are **not** affected; only new markets will inherit the new values. However, existing markets reference `reserveFactorBps` dynamically from the vault, so changing the factor affects **all** markets immediately.

---

## 3. Fee Mechanism

### **AMM Fees**

- **Charged:** On every trade against the AMM.
- **Calculation:** `Fee = Trade Value * feeLMSR`
- **Destination:** Added directly to the market's `reserve`.
- **Effect:** Directly increases the market's `b` parameter (via the formula above), deepening liquidity for future traders.

### **Orderbook Fees**

- **Current Status:** Disabled (0%).
- **Mechanism:** `SoothFeeController` supports fee splitting, but v3 currently focuses on AMM fees driving liquidity growth.

---

## 4. Code References

| Contract                 | Function/Var        | Description                                     |
| :----------------------- | :------------------ | :---------------------------------------------- |
| `SoothGovernorVault.sol` | `defaultBBase`      | Storage for default market config.              |
| `SoothGovernorVault.sol` | `reserveFactorBps`  | Global multiplier read by all markets.          |
| `SoothMarket.sol`        | `b()`               | View function implementing the dynamic formula. |
| `SoothMarket.sol`        | `executeAMMTrade()` | Updates `reserve` with collected fees.          |
