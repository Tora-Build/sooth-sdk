# Sooth Protocol: Access & Configuration Reference

**Date:** 2025-12-02  
**Scope:** Historical reference (pre-Launchpad). Current protocol uses `LaunchpadFactory`, `LaunchpadMarket`, `SoothTraderVaultV4`, and Adjudicator-based settlement.

---

## 1. SoothVault.sol

The central liquidity pool holding all assets and managing LP shares.

### **Actors & Access**

| Role           | Access Modifier  | Capabilities                                                                                                                                                                                            |
| :------------- | :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Owner**      | `onlyOwner`      | • `setAuthorized(address who, bool allowed)`: Whitelist markets/contracts.                                                                                                                              |
| **Authorized** | `onlyAuthorized` | • `allocateExposure`: Lock capital for a market.<br>• `releaseExposure`: Unlock capital.<br>• `applySettlementDelta`: Move funds for settlement.<br>• `recordMarketFlow`: Update reserves from trading. |
| **Public**     | N/A              | • `deposit`, `mint`, `withdraw`, `redeem` (ERC4626 standard).<br>• View functions (`totalAssets`, `getMarketReserve`, etc.).                                                                            |

### **Configurations**

| Parameter           | Type      | Description                                   | Mutability       |
| :------------------ | :-------- | :-------------------------------------------- | :--------------- |
| `asset`             | `IERC20`  | Underlying token (e.g., USDC).                | **Immutable**    |
| `decimalsScale`     | `uint256` | Normalization factor (10^(18-decimals)).      | **Immutable**    |
| `authorizedSpender` | `mapping` | Whitelist of contracts allowed to move funds. | Mutable by Owner |

---

## 2. SoothMarket.sol

Represents a single prediction market.

### **Actors & Access**

| Role       | Access Modifier | Capabilities                                                                                                        |
| :--------- | :-------------- | :------------------------------------------------------------------------------------------------------------------ |
| **Owner**  | `onlyOwner`     | • `initialize`: Set up market params (one-time).<br>• `markSettled`: Finalize market result (called by Settlement). |
| **Public** | `onlyLive`      | • `trade`: Buy/Sell shares.                                                                                         |

### **Configurations**

| Parameter       | Type           | Description                                 | Mutability        |
| :-------------- | :------------- | :------------------------------------------ | :---------------- |
| `marketId`      | `uint256`      | Unique identifier.                          | Set on Init       |
| `adjudicator` | `address`      | Adjudicator contract address (oracle-type / ZK / optimistic / multisig). | Set on Init       |
| `amm`           | `ISoothAMM`    | Address of the pricing engine (e.g., LMSR). | Set on Init       |
| `riskManager`   | `IRiskManager` | Address of Risk Manager.                    | Set on Init       |
| `vault`         | `ISoothVault`  | Address of Vault.                           | Set on Init       |
| `isLive`        | `bool`         | True if trading is active.                  | Toggled on Settle |
| `isSettled`     | `bool`         | True if market has resolved.                | Toggled on Settle |

---

## 3. SoothRiskManager.sol

Manages liquidity parameters and risk classes.

### **Actors & Access**

| Role           | Access Modifier  | Capabilities                                                                                                                                                                                                                       |
| :------------- | :--------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Owner**      | `onlyOwner`      | • `setVault`: Update vault address.<br>• `setAuthorized`: Whitelist market factories.<br>• `setGlobalMaxConcurrentWorstCase` (K).<br>• `setRiskClassConfig`: Update multipliers.<br>• `setReserveMultiplier`: Update profit boost. |
| **Authorized** | `onlyAuthorized` | • `setMarketRiskClass`: Assign risk class to a market (called by Factory).                                                                                                                                                         |
| **Public**     | N/A              | • `updateGlobalB`: Trigger recalculation of liquidity depth.                                                                                                                                                                       |

### **Configurations**

| Parameter                           | Type      | Description                                                      | Mutability                    |
| :---------------------------------- | :-------- | :--------------------------------------------------------------- | :---------------------------- |
| `globalRisk.maxConcurrentWorstCase` | `uint256` | **K**: Safety divisor (default 10). Determines `Lmax = TVL / K`. | Mutable by Owner              |
| `globalRisk.bGlobal`                | `uint256` | **b**: Global liquidity parameter.                               | Dynamic (via `updateGlobalB`) |
| `riskClassConfigs`                  | `mapping` | Multipliers for each `RiskClass` (e.g., High = 1.4x).            | Mutable by Owner              |
| `reserveMultiplierBps`              | `uint256` | Liquidity boost from accumulated profits (default 1x).           | Mutable by Owner              |

---

## 4. LP PnL Impact Analysis

**Critical Parameters Affecting Vault LP Returns**

### **Direct PnL Impacts**

| Parameter | Location | Impact on LP PnL | Risk Level |
| :--- | :--- | :--- | :--- |
| **`totalAssets`** | `SoothVault` | **Direct 1:1 impact**. LP share value = `totalAssets / totalSupply`. Any decrease in `totalAssets` directly reduces LP wealth. | 🔴 **CRITICAL** |
| **`marketReserves[marketId]`** | `SoothVault` | **Unrealized PnL**. Negative reserves = vault is losing to traders. On settlement, losses are realized and `totalAssets` decreases. | 🟡 **HIGH** |
| **`lockedExposure`** | `SoothVault` | **Liquidity Lock**. High locked exposure prevents LP withdrawals. Does NOT affect PnL directly, but creates **exit risk**. | 🟡 **HIGH** |

### **Indirect PnL Impacts (via Risk Exposure)**

| Parameter | Location | Impact Mechanism | Risk Level |
| :--- | :--- | :--- | :--- |
| **`maxConcurrentWorstCase` (K)** | `SoothRiskManager` | **Lower K = Higher Risk**. `Lmax = TVL / K`. If K=5, each market can lose up to 20% of TVL. If K=20, only 5% per market. | 🟡 **HIGH** |
| **`riskClassConfigs.multiplierBps`** | `SoothRiskManager` | **Higher Multiplier = More Exposure**. HIGH risk markets (1.4x) get 40% more liquidity, meaning 40% larger potential losses. | 🟡 **HIGH** |
| **`reserveMultiplierBps`** | `SoothRiskManager` | **Profit Reinvestment**. Positive reserves boost liquidity, increasing exposure. Can amplify losses if market reverses. | 🟢 **MEDIUM** |

### **Settlement & Accounting**

| Event | Code Path | LP Impact |
| :--- | :--- | :--- |
| **Market Settlement (Traders Win)** | `applySettlementDelta` → `totalAssets -= payout` | **Direct Loss**. LP share value drops. |
| **Market Settlement (Traders Lose)** | `applySettlementDelta` → `totalAssets += payment` | **Direct Gain**. LP share value rises. |
| **Trading Flow (Unrealized)** | `recordMarketFlow` → `marketReserves += cost` | **No immediate impact**. PnL is unrealized until settlement. |

### **Key Insights for LPs**

1. **`totalAssets` is the only number that matters** for share value. Everything else is either unrealized or affects future risk.
2. **`K` is the primary safety lever**. Lower K = higher returns but higher risk of catastrophic loss.
3. **Risk Class Multipliers** directly control exposure. A vault with many HIGH/CRITICAL markets is riskier.
4. **Locked Exposure** doesn't affect PnL but can trap capital if markets never settle (see "Zombie Market" risk in ROADMAP_REVIEW.md).
