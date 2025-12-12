# Sooth Protocol Documentation

Welcome to the Sooth Protocol documentation.

> [!IMPORTANT] > **Architecture Update (2025-12-04):** The protocol now uses the **Singleton Trader Vault** architecture. Old docs referencing `SoothVault`, `SoothRiskManager`, or dynamic `bGlobal` are archived.

---

## 📚 Current Documentation

### **1. Core Architecture (`/core`)**

| Document                                      | Description                         |
| --------------------------------------------- | ----------------------------------- |
| **[ARCHITECTURE.md](./core/ARCHITECTURE.md)** | Complete system architecture (v2.0) |

### **2. Research & Design (`/research`)**

| Document                                                | Description                                                     |
| ------------------------------------------------------- | --------------------------------------------------------------- |
| **[FEE_DESIGN.md](./research/FEE_DESIGN.md)**           | Fee mechanism: LMSR fees (Governor) + Orderbook fees (Guardian) |
| [SHORT_SELLING.md](./technical/SHORT_SELLING.md)        | **New**: Collateralized Short Selling Mechanics                 |
| [STAKING_DESIGN.md](./research/STAKING_DESIGN.md)       | Future: Guardian and LP staking                                 |
| [ACCESS_AND_CONFIG.md](./research/ACCESS_AND_CONFIG.md) | Roles and parameters reference                                  |
| [ROADMAP_REVIEW.md](./research/ROADMAP_REVIEW.md)       | Strategic plan for mainnet                                      |

### **3. Frontend Integration (`/technical/frontend-integration`)**

| Document                                                                              | Description                 |
| ------------------------------------------------------------------------------------- | --------------------------- |
| [README.md](./technical/frontend-integration/README.md)                               | Integration guide index     |
| [CONTRACT_INTERFACES.md](./technical/frontend-integration/CONTRACT_INTERFACES.md)     | ABI and function signatures |
| [SETTLEMENT_GUIDE.md](./technical/frontend-integration/SETTLEMENT_GUIDE.md)           | Settlement flow             |
| [ORDERBOOK_INTEGRATION.md](./technical/frontend-integration/ORDERBOOK_INTEGRATION.md) | Orderbook trading           |

---

## 🗂️ Archived (Outdated)

| Folder                         | Contains                                        |
| ------------------------------ | ----------------------------------------------- |
| `/archive/v1-old-architecture` | Old `bGlobal`, `RiskManager`, shared vault docs |

---

## 🚀 Quick Reference

### Contract Addresses

See `docs/technical/frontend-integration/deployments-monad.json` for latest deployment.

### Key Contracts (v2.0)

| Contract             | Purpose                                      |
| -------------------- | -------------------------------------------- |
| `SoothTraderVault`   | User fund management (deposits, withdrawals) |
| `SoothGovernorVault` | LP liquidity (ERC4626 shares)                |
| `SoothMarket`        | Per-market trading                           |
| `SoothFeeController` | Guardian fee settings                        |
| `SoothMarketFactory` | Market creation                              |
| `SoothSettlement`    | PnL distribution                             |

### Architecture Summary

```
Users → SoothTraderVault → (via Markets) → SoothGovernorVault ← LPs
```

- **Users** deposit to `SoothTraderVault`
- **LPs** deposit to `SoothGovernorVault`
- **Markets** orchestrate fund flows between vaults
- **Governor** sets per-market `b` and `feeLMSR`
- **Guardian** sets global `orderbookFee`
