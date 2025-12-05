# Fee Design

**Status:** Implemented  
**Last Updated:** 2025-12-04  
**Architecture:** Singleton Trader Vault (v2.0)

---

## Overview

The Sooth Protocol fee system is designed for simplicity, flexibility, and sustainability.

**Key Principles:**

- No on-chain "risk tiers" - Governor uses discretion
- `b` (liquidity parameter) can only **increase**, never decrease
- LMSR fees are per-market (Governor-controlled)
- Orderbook fees are unified (Guardian-controlled)

---

## Roles & Permissions

### Protocol Guardian (Global)

| Parameter      | Description                          | Default       |
| -------------- | ------------------------------------ | ------------- |
| `orderbookFee` | Unified fee for ALL orderbook trades | 10 bps (0.1%) |
| `lpSplitBps`   | % of fees to LP pool                 | 50%           |
| `treasury`     | Address receiving protocol portion   | Deployer      |

**Contract:** `SoothFeeController` (owner = Guardian)

### Governor (Per Market)

| Parameter | Description         | Rules                                             |
| --------- | ------------------- | ------------------------------------------------- |
| `b`       | Liquidity parameter | **Increase only** - can add USDC, cannot withdraw |
| `feeLMSR` | Fee for AMM trades  | Max 10% (1000 bps)                                |

**Contract:** `SoothMarket` (governor = set at creation)

---

## Fee Types

### 1. LMSR (AMM) Fees

**Applied to:** All trades routed through the AMM

```solidity
uint256 absCost = |ammCost|;
uint256 fee = (absCost * feeLMSR) / 10000;

// Buy: User pays Cost + Fee
// Sell: User receives Proceeds - Fee
```

**Destination:** `SoothGovernorVault` (LP benefit)

### 2. Orderbook Fees

**Applied to:** All limit order matches

```solidity
uint256 orderbookFee = (orderbookVolume * feeController.orderbookFee()) / 10000;
```

**Destination:** `SoothGovernorVault` (LP benefit)

---

## Liquidity Parameter (`b`)

### Design

```solidity
// In SoothMarket
uint256 public b;  // Liquidity parameter

// Governor can ONLY increase b, never decrease
function increaseB(uint256 amount) external onlyGovernor {
    b += amount;
    emit BIncreased(amount, b);
}
```

### Rationale

- **Lower `b`** = Less liquidity = Wider spreads = Less capital at risk → Use for HIGH RISK markets
- **Higher `b`** = More liquidity = Tighter spreads = More capital at risk → Use for LOW RISK markets

### UI Templates (Suggestions Only)

These are NOT enforced on-chain. Just frontend/tooling suggestions for Governors.

| Risk Profile | Suggested `b` | Suggested Fee  | Use Case           |
| ------------ | ------------- | -------------- | ------------------ |
| Low Risk     | 25,000 USDC   | 0.3% (30 bps)  | BTC price, ETH gas |
| Medium Risk  | 10,000 USDC   | 0.5% (50 bps)  | Election outcomes  |
| High Risk    | 5,000 USDC    | 1.0% (100 bps) | Obscure events     |

Governor can ignore templates and set any value.

---

## Fee Flow Diagram

```
                    ┌──────────────────────────────────────┐
                    │            User Trade                │
                    └───────────────┬──────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
       ┌─────────────┐       ┌─────────────┐       ┌─────────────┐
       │ Orderbook   │       │   Hybrid    │       │    AMM      │
       │   Only      │       │   Route     │       │   Only      │
       └──────┬──────┘       └──────┬──────┘       └──────┬──────┘
              │                     │                     │
              │               ┌─────┴─────┐               │
              │               │           │               │
              ▼               ▼           ▼               ▼
       ┌─────────────────────────────────────────────────────┐
       │                    Fee Calculation                  │
       │  orderbookFee = volume × orderbookFeeBps / 10000   │
       │  ammFee = |ammCost| × feeLMSR / 10000              │
       └─────────────────────────┬───────────────────────────┘
                                 │
                                 ▼
                    ┌───────────────────────────┐
                    │     SoothGovernorVault    │
                    │     (LP Pool Benefit)     │
                    └───────────────────────────┘
```

---

## Trade Event

```solidity
event Trade(
    address indexed trader,
    uint8 outcomeIndex,
    int256 deltaShares,
    int256 cost,           // Pure AMM + Orderbook cost (pre-fee)
    uint256 orderbookFee,  // Fee from orderbook portion
    uint256 ammFee         // Fee from AMM portion
);
```

---

## Example Trade

**Market Setup:**

- `b` = 10,000 USDC
- `feeLMSR` = 50 bps (0.5%)
- `orderbookFee` = 10 bps (0.1%)

**Trade: Buy 100 YES shares**

| Component      | Volume  | Fee Rate | Fee Amount    |
| -------------- | ------- | -------- | ------------- |
| Orderbook fill | 20 USDC | 0.1%     | 0.02 USDC     |
| AMM fill       | 30 USDC | 0.5%     | 0.15 USDC     |
| **Total**      | 50 USDC | -        | **0.17 USDC** |

**User pays:** 50.17 USDC  
**LP pool receives:** 0.17 USDC

---

## Contract Implementation

### SoothFeeController.sol

```solidity
contract SoothFeeController is Ownable {
    uint256 public orderbookFee;   // Basis points (e.g., 10 = 0.1%)
    uint256 public lpSplitBps;     // e.g., 5000 = 50%
    address public treasury;

    uint256 public constant MAX_BPS = 10000;
    uint256 public constant MAX_ORDERBOOK_FEE = 200; // Max 2%

    function setOrderbookFee(uint256 _feeBps) external onlyOwner;
    function setLpSplit(uint256 _splitBps) external onlyOwner;
    function setTreasury(address _treasury) external onlyOwner;
}
```

### SoothMarket.sol (Fee-related)

```solidity
contract SoothMarket {
    address public governor;
    uint256 public feeLMSR;        // Basis points
    uint256 public b;              // Liquidity parameter
    ISoothFeeController public feeController;

    function increaseB(uint256 amount) external onlyGovernor;
    function setFeeLMSR(uint256 _feeBps) external onlyGovernor;
}
```

---

## Migration Notes

### Removed (v1 → v2)

| Old                   | New                        |
| --------------------- | -------------------------- |
| `SoothRiskManager`    | Governor sets `b` directly |
| `bGlobal` calculation | Fixed `b` per market       |
| Risk tier enums       | Governor discretion        |
| Dynamic `b` updates   | `b` only increases         |

### Added (v2)

| New                  | Purpose                      |
| -------------------- | ---------------------------- |
| `SoothFeeController` | Guardian manages global fees |
| `SoothTraderVault`   | User fund management         |
| `SoothGovernorVault` | Refactored LP vault          |
| `feeLMSR` per market | Governor fee control         |
| `increaseB()`        | Governor liquidity injection |

---

## Future Considerations

1. **Fee Distribution Split:** Currently all fees go to LP pool. Could add treasury split.
2. **Auto-compounding `b`:** Portion of fees could auto-increase `b`.
3. **Volume-based fee tiers:** Discounts for high-volume traders.
4. **Multi-token support:** Different fee structures per collateral type.
