# Fee Design

**Status:** Implemented  
**Last Updated:** 2025-12-05  
**Architecture:** Singleton Trader Vault + Dynamic Liquidity (v3.0)

---

## Overview

The Sooth Protocol v3 fee system is designed to create a self-reinforcing liquidity loop.

**Key Principles:**

- **Fees Compound Liquidity**: All AMM fees are added to the market's `reserve`.
- **Dynamic Liquidity**: Liquidity (`b`) automatically increases as `reserve` grows.
- **Governor Control**: Fees and liquidity multipliers are set by the Governor via the Vault.
- **Unified Settings**: Default parameters are managed at the Vault level for consistency.

---

## Roles & Permissions

### Protocol Guardian (Global)

| Parameter      | Description                          | Default          |
| -------------- | ------------------------------------ | ---------------- |
| `orderbookFee` | Unified fee for ALL orderbook trades | 0 bps (Disabled) |
| `treasury`     | Address receiving protocol portion   | Deployer         |

**Contract:** `SoothFeeController` (owner = Guardian)

### Governor (Per Vault)

| Parameter          | Description                       | Default       |
| ------------------ | --------------------------------- | ------------- |
| `defaultBBase`     | Initial liquidity for new markets | 10,000 USDC   |
| `defaultFeeBps`    | Fee for AMM trades                | 50 bps (0.5%) |
| `reserveFactorBps` | Multiplier for dynamic liquidity  | 1000 (10%)    |

**Contract:** `SoothGovernorVault` (owner = Governor)

---

## Fee Types

### 1. LMSR (AMM) Fees

**Applied to:** All trades routed through the AMM.

```solidity
uint256 absCost = |ammCost|;
uint256 fee = (absCost * feeLMSR) / 10000;

// Update Market State
reserve += fee; // Adds directly to market PnL
```

**Effect:**

1.  **Increases `reserve`**: The fee is effectively "profit" for the AMM.
2.  **Increases `b`**: `b = bBase + (reserve * reserveFactor)`.
3.  **Deepens Liquidity**: Future traders get better pricing/lower slippage.

### 2. Orderbook Fees

**Applied to:** All limit order matches.

**Current Status:** Disabled (0 bps) to encourage early orderbook adoption.

---

## Fee Flow & Liquidity Loop

```
                    ┌───────────────────────────┐
                    │        User Trade         │
                    └─────────────┬─────────────┘
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │      AMM Execution        │
                    │   Fee = Cost * 0.5%       │
                    └─────────────┬─────────────┘
                                  │
               ┌──────────────────┴──────────────────┐
               │                                     │
               ▼                                     ▼
     ┌───────────────────┐                 ┌───────────────────┐
     │   Market Reserve  │                 │    Dynamic 'b'    │
     │   (Increases with │ ──────────────> │   (Calculated)    │
     │    fees)          │                 │   b = Base +      │
     └───────────────────┘                 │   (Res * Factor)  │
                                           └───────────────────┘
```

---

## Contract Implementation

### SoothMarket.sol

The market now fetches fee and liquidity parameters dynamically from the Governor Vault.

```solidity
function b() public view returns (uint256) {
    uint256 factor = governorVault.reserveFactorBps();
    if (reserve <= 0) return bBase;
    return bBase + (uint256(reserve) * factor / MAX_BPS);
}

function feeLMSR() public view returns (uint256) {
    return governorVault.defaultFeeBps();
}
```

### SoothGovernorVault.sol

Storage for the configuration parameters.

```solidity
uint256 public defaultBBase;
uint256 public defaultFeeBps;
uint256 public reserveFactorBps;

function setVaultConfig(...) external onlyOwner { ... }
```

---

## Migration Notes

### Removed (v2 → v3)

| Old                   | New                        |
| --------------------- | -------------------------- |
| `increaseB()`         | **Removed** (Dynamic only) |
| `setFeeLMSR()`        | **Removed** (Vault config) |
| Static `b` storage    | Public `b()` view function |
| Manual Fee withdrawal | Fees auto-compound         |

### Added (v3)

| New                | Purpose                      |
| ------------------ | ---------------------------- |
| `reserveFactorBps` | Scales liquidity with fees   |
| `setVaultConfig`   | Centralized param management |
| `VaultConfigSet`   | Audit trail for changes      |

---
