# TickBook Maker/Taker Fee System (V9.7)

## Overview

The fee system separates taker and maker economics to align incentives:

- **Takers** (market orders, crossing orders): Pay fees that protect makers from volatility
- **Makers** (limit orders): Receive rebates that reward liquidity provision

## Fee Formulas

```
TAKER FEE = baseFee + volatilityFee
  - baseFee: Fixed base fee (default 10 bps = 0.1%)
  - volatilityFee: Per-tick movement fee (protects makers from price swings)
  - Capped at maxFee (default 100 bps = 1%)

MAKER REBATE = volumeDiscount - makerBaseFee
  - volumeDiscount: Scales with trade volume (rewards active makers)
  - makerBaseFee: Base fee for makers (typically 0)
  - Capped at MAX_REBATE (50 bps = 0.5%)
```

## FeeConfig Struct

```solidity
struct FeeConfig {
    uint24 baseFee;           // Base taker fee (bps)
    uint24 makerBaseFee;      // Base maker fee (bps, typically 0)
    uint24 maxFee;            // Max taker fee (bps)
    uint24 volumeDiscount;    // Maker discount per 1000 USDC (bps)
    uint24 volatilityFee;     // Per-tick movement fee (bps)
    uint256 windowStart;      // Volume tracking window start
    uint256 windowVolume;     // Volume in current window
    uint16 lastTick;          // Last traded tick
    uint16 tickMovement;      // Accumulated tick movement
}
```

## Hook Functions

### getDynamicFee (Taker Fee)
```solidity
function getDynamicFee(
    bytes32 marketKey,
    uint8 outcome,
    uint256 shares,
    uint24 baseFee
) external view returns (uint24 fee);
```

Permission bit: `1 << 8`

### getMakerFee (Maker Rebate)
```solidity
function getMakerFee(
    bytes32 marketKey,
    uint8 outcome,
    uint256 shares,
    uint24 baseFee
) external view returns (uint24 fee, bool isRebate);
```

Permission bit: `1 << 13`

## Fee Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        TAKER FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│  Taker places market order                                      │
│       │                                                         │
│       ▼                                                         │
│  Hook.getDynamicFee() → baseFee + volatilityFee                │
│       │                                                         │
│       ▼                                                         │
│  totalCost += feeAmount                                         │
│       │                                                         │
│       ▼                                                         │
│  vault.transferFee(market, feeRecipient, feeAmount)            │
│       │                                                         │
│       ▼                                                         │
│  FeeCollected(market, recipient, amount) event                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        MAKER FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│  Maker's limit order gets filled                                │
│       │                                                         │
│       ▼                                                         │
│  Hook.getMakerFee() → (rebate, isRebate=true)                  │
│       │                                                         │
│       ▼                                                         │
│  makerCollateralUsed -= rebateAmount                           │
│       │                                                         │
│       ▼                                                         │
│  Maker gets more USDC back when claiming                        │
└─────────────────────────────────────────────────────────────────┘
```

## Configuration

### Setting Fee Config
```solidity
DynamicFeeHook.setFeeConfig(
    bytes32 marketKey,
    uint24 baseFee,        // e.g., 10 (0.1%)
    uint24 makerBaseFee,   // e.g., 0
    uint24 maxFee,         // e.g., 100 (1%)
    uint24 volumeDiscount, // e.g., 5 (per 1000 USDC)
    uint24 volatilityFee   // e.g., 2 (per tick)
);
```

### Setting Fee Recipient
```solidity
TickBookPoolManager.setFeeRecipient(address recipient);
```

### Setting Default Hook for Graduated Markets
```solidity
LaunchpadEngine.setDefaultHook(address hook);
```

## Constants

```solidity
MIN_FEE = 1;        // 0.01% minimum fee
MAX_FEE = 1000;     // 10% maximum fee
MAX_REBATE = 50;    // 0.5% maximum rebate
```

## Events

```solidity
// TickBookVault
event FeeCollected(address indexed market, address indexed recipient, uint256 amountWad);

// TickBookPoolManager
event FeeRecipientChanged(address indexed newFeeRecipient);

// LaunchpadEngine
event DefaultHookUpdated(address indexed hook);
```

## Integration Points

| Contract | Function | Purpose |
|----------|----------|---------|
| `TickBookPoolManager` | `executeMarketOrder` | Collects taker fees, applies maker rebates |
| `TickBookPoolManager` | `_tryCross` | Applies fees to crossing limit orders |
| `TickBookVault` | `transferFee` | Sends fees to recipient |
| `LaunchpadEngine` | `registerGraduatedMarketInTickBook` | Passes defaultHook to TickBook |
| `DynamicFeeHook` | `getDynamicFee` | Calculates taker fee |
| `DynamicFeeHook` | `getMakerFee` | Calculates maker rebate |

## Example Scenarios

### Scenario 1: Market Buy
```
Config: baseFee=10, volatilityFee=2, tickMovement=5
Fee = 10 + (2 * 5) = 20 bps (0.2%)

Trade: 1000 USDC
Fee: 2 USDC → sent to feeRecipient
```

### Scenario 2: Limit Order Fill
```
Config: makerBaseFee=0, volumeDiscount=5, volume=5000 USDC
Rebate = (5000/1000) * 5 - 0 = 25 bps → capped at 50 bps

Trade: 1000 USDC collateral
Rebate: 2.5 USDC → maker gets back more
```

## Deployment Checklist

1. Deploy `DynamicFeeHook`
2. Configure fee settings per market via `setFeeConfig`
3. Set `feeRecipient` on `TickBookPoolManager`
4. Set `defaultHook` on `LaunchpadEngine`
5. New graduated markets automatically use the hook

---

*Version: V9.7 | Updated: 2025-12-30*
