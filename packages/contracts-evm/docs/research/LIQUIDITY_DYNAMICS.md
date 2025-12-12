# Liquidity Dynamics & Fees (V4)

**Date:** 2025-12-09
**Status:** Implemented (V4)
**Impact:** Market Depth, LP profitability

---

## Executive Summary

Sooth V4 implements a **Dynamic Liquidity Model** with Continuous LMSR. Market depth (`b`) scales with trading activity. This incentivizes LPs by increasing capital efficiency as markets prove their demand, and provides traders with better slippage on popular markets.

---

## 1. The Dynamic Liquidity Formula

Market liquidity (`b`) is calculated dynamically on-chain based on a vault-configured base and the market's accumulated reserves.

### **The Formula**

```
b_market = b_base + (net_fee_reserves × reserveFactor)
```

Where:

- **`b_base`**: The initial liquidity allocated to the market by the Governor Vault (e.g., 10,000 USDC).
- **`net_fee_reserves`**: The net accumulated fees of the market (starts at 0).
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

The `SoothGovernorVault` holds default configuration parameters.

| Parameter          | Default Value       | Description                              |
| :----------------- | :------------------ | :--------------------------------------- |
| `defaultBBase`     | **10,000 USDC**     | Initial `b` liquidity for new markets.   |
| `defaultFeeBps`    | **50 bps (0.5%)**   | Trading fee charged by the AMM.          |
| `reserveFactorBps` | **1000 bps (0.1x)** | Multiplier for dynamic liquidity growth. |

---

## 3. Fee Mechanism

### **AMM Fees**
- **Charged:** On every trade against the Continuous LMSR AMM.
- **Effect:** Increases `reserve`, which instantly increases `b` (liquidity depth).
- **Result:** We effectively "reinvest" fees into making the market deeper.

### **Orderbook Fees**
- **Current Status:** Disabled (0%).
- **Future:** Index-linked dynamic fees.

---

## 4. Code References

| Contract                 | Function/Var        | Description                                     |
| :----------------------- | :------------------ | :---------------------------------------------- |
| `SoothGovernorVault.sol` | `defaultBBase`      | Storage for default market config.              |
| `SoothGovernorVault.sol` | `reserveFactorBps`  | Global multiplier read by all markets.          |
| `SoothMarketV4.sol`      | `b()`               | View function implementing the dynamic formula. |
| `SoothMarketV4.sol`      | `executeAMMTrade()` | Updates `reserve` with collected fees.          |
