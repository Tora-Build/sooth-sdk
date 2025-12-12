# Fee Design (V4)

**Status:** Implemented  
**Last Updated:** 2025-12-09  
**Architecture:** Singleton Trader Vault + Dynamic Liquidity (V4 Continuous LMSR)

---

## Overview

The Sooth Protocol V4 fee system is designed to create a self-reinforcing liquidity loop using Continuous LMSR.

**Key Principles:**

- **Fees Compound Liquidity**: All AMM fees are added to the market's `reserve`.
- **Dynamic Liquidity (`b`)**: Liquidity parameter `b` automatically increases as `reserve` grows.
- **Governor Control**: Fees and liquidity multipliers are set by the Governor via the Vault.

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
// Calculate Cost Delta in Continuous LMSR
int256 costDelta = newCost - oldCost;

// Calculate Fee
uint256 absCost = costDelta >= 0 ? uint256(costDelta) : uint256(-costDelta);
uint256 fee = (absCost * feeLMSR) / 10000;

// Update Market State
reserve += int256(fee); // Adds directly to market PnL
```

**Effect:**

1.  **Increases `reserve`**: The fee is effectively "profit" for the AMM.
2.  **Increases `b`**: `b = bBase + (reserve * reserveFactor)`.
3.  **Deepens Liquidity**: A larger `b` flattens the LMSR pricing curve, reducing slippage for future traders.

### 2. Orderbook Fees

**Applied to:** All limit order matches.

**Current Status:** Disabled (0 bps) to encourage early orderbook adoption.
*Future: See Index-Linked Dynamic Fees research.*

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
                                  ▼
                    ┌───────────────────────────┐
                    │  Market Reserve (Fees)    │
                    │  (Increases)              │
                    └─────────────┬─────────────┘
                                  │
                                  ▼
                    ┌───────────────────────────┐
                    │    Effective Liquidity    │
                    │    b = bBase + (Res*fac)  │
                    │    (Curve Flattens)       │
                    └───────────────────────────┘
```

---

## Contract Implementation

### SoothMarketV4.sol

The market fetches fee and liquidity parameters dynamically from the Governor Vault.

```solidity
function b() public view returns (uint256) {
    int256 unrealizedPnL = governorVault.getMarketReserve(marketId);
    // ... calculate dynamic boost ...
    return bBase + boost;
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
