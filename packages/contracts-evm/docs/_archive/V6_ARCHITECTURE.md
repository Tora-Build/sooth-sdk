# Launchpad Architecture (Current Version)

> **Launchpad Version**: Current (built on SoothMarketV4 base architecture)  
> **Status**: Implementation Complete  
> **ADR**: [ADR-015](../../../DECISIONS.md#adr-015-v6-pre-graduation-locking)  
> **Date**: 2025-12-15

---

## Overview

The current Launchpad architecture introduces **Pre-Graduation Locking** to protect market liquidity and simplifies to a **2-contract model** (Market + TraderVault). This version enhances security, reduces gas costs, and provides better capital efficiency for traders.

**Note**: Launchpad markets are built on **SoothMarketV4** architecture (continuous LMSR AMM + orderbook). The "V4" refers to the base market architecture, not the Launchpad version.

### Key Changes from Previous Launchpad Version

| Aspect | Previous | Current |
|--------|----|----|
| **Pre-Graduation Sells** | Proceeds unlocked immediately | Proceeds locked (can reinvest, cannot withdraw) |
| **Architecture** | 3 contracts (Factory, Market, LPVault) | 2 contracts (Factory, Market) |
| **Market Structure** | Separate `MarketLPVault` contract | Market implements `ISoothGovernorVault` |
| **Factory** | `Ownable` with mutable state | Immutable (no admin functions) |
| **Protocol Config** | In Factory | Separate `ProtocolConfig` contract |
| **Guardian Role** | Not defined | Per-market guardian with liquidation powers |
| **LP Tokens** | In `MarketLPVault` | In `LaunchpadMarket` (ERC20) |

---

## Architecture

### 2-Contract Model

```
┌─────────────────────────────────────────────────────────────┐
│              Launchpad Architecture (Current)               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  TraderVault     │─────────▶│ LaunchpadMarket  │         │
│  │  (User Accounts) │         │  (ISoothGovVault) │         │
│  │                  │         │  (ERC20 LP)       │         │
│  │  • Deposits      │         │  • USDC Storage   │         │
│  │  • Trading       │         │  • Lock Queue     │         │
│  │  • Withdrawals   │         │  • LP Tokens      │         │
│  └──────────────────┘         └──────────────────┘         │
│                                                              │
│  ┌──────────────────┐                                       │
│  │ LaunchpadFactory │  (Immutable, no Ownable)            │
│  │                  │                                       │
│  │  • createMarket()│                                       │
│  └──────────────────┘                                       │
│                                                              │
│  ┌──────────────────┐                                       │
│  │ ProtocolConfig   │  (Ownable by Protocol Owner)          │
│  │                  │                                       │
│  │  • liquidationFeeBps│                                     │
│  │  • guardian      │                                       │
│  └──────────────────┘                                       │
└─────────────────────────────────────────────────────────────┘
```

### LaunchpadMarket Structure

```solidity
contract LaunchpadMarket is 
    SoothMarketV4,           // Base market logic (V4 architecture)
    ERC20,                   // LP tokens ("Sooth LP", "SLP")
    ISoothGovernorVault,     // Liquidity vault interface
    ILaunchpadMarket         // Launchpad-specific interface
{
    IERC20 private _asset;    // USDC
    
    // Market IS its own GovernorVault
    function governorVault() external view returns (ISoothGovernorVault) {
        return ISoothGovernorVault(address(this));
    }
    
    // Lock queue for pre-graduation proceeds
    mapping(address => UserLockState) private _lockStates;
    mapping(address => uint256) public lockedProceeds;
    uint256 public totalLockedProceeds;
    
    // ISoothGovernorVault implementation
    function totalAssets() external view returns (uint256) {
        return _asset.balanceOf(address(this));
    }
    
    function lockProceeds(...) external returns (uint64 unlockTime) { /* ... */ }
    function useLockedProceeds(address user, uint256 amount) external { /* ... */ }
    function sendFunds(...) external { /* ... */ }
}
```

---

## Pre-Graduation Locking

### Rules

1. **All Sells Lock Proceeds**: During pre-graduation, every sell locks proceeds (24h unlock time)
2. **Withdrawals Blocked**: `TraderVault.withdraw()` blocks if user has any locked proceeds globally
3. **Reinvestment Allowed**: Locked proceeds can be used for buys via `useLockedProceeds()`
4. **Post-Graduation**: Normal lock-on-sell rules apply (24h unlock)

### Flow Diagram

```
Pre-Graduation Phase:
┌─────────────────────────────────────────────────────────┐
│ User sells 100 YES shares                              │
│         │                                               │
│         ▼                                               │
│ TraderVault.tradeAMM(market, 0, -100e18)              │
│         │                                               │
│         ▼                                               │
│ Market.executeAMMTrade() → Returns proceeds            │
│         │                                               │
│         ▼                                               │
│ TraderVault: Always lock proceeds                      │
│         │                                               │
│         ▼                                               │
│ Market.lockProceeds(user, amount)                      │
│         │                                               │
│         ▼                                               │
│ Proceeds locked in Market (24h unlock)                 │
│         │                                               │
│         ├─→ Can use for buys: useLockedProceeds()      │
│         └─→ Cannot withdraw: withdraw() blocked       │
└─────────────────────────────────────────────────────────┘

Post-Graduation Phase:
┌─────────────────────────────────────────────────────────┐
│ Same lock-on-sell flow (24h unlock)                    │
│ But withdrawals allowed after unlock                   │
└─────────────────────────────────────────────────────────┘
```

### Implementation

**TraderVault.tradeAMM()** (SELL path):
```solidity
// Always lock proceeds (both pre and post-graduation)
_lockProceedsOnGovernor(marketGovernor, msg.sender, mkt.marketId(), netProceeds);
```

**TraderVault.tradeAMM()** (BUY path):
```solidity
// Check for locked proceeds and use them first
if (isLaunchpadPreGrad && locked > 0 && totalCost <= locked) {
    ILaunchpadMarket(market).useLockedProceeds(msg.sender, totalCost);
    // Funds now available in Market, no need to transfer
} else {
    // Use available balance and transfer to marketGovernor
}
```

**TraderVault.withdraw()**:
```solidity
// Withdrawals may be blocked while the user has active locked proceeds (implementation-specific).
// In the current Launchpad design, locking lives on the market (market is its own vault).
```

---

## Immutable Factory

### Design

`LaunchpadFactory` is **immutable** (no `Ownable`, no mutable state):

```solidity
contract LaunchpadFactory is ILaunchpadFactory {
    // All immutable constructor parameters
    address public immutable marketImplementation;
    address public immutable usdc;
    address public immutable traderVault;
    address public immutable feeController;
    address public immutable outcomeTokenImplementation;
    address public immutable treasury;
    address public immutable defaultAdjudicator;
    address public immutable adjudicatorRegistry; // Adjudicator allowlist
    address public immutable protocolConfig;      // ProtocolConfig reference
    
    constructor(
        address _marketImplementation,
        address _usdc,
        address _traderVault,
        address _feeController,
        address _outcomeTokenImplementation,
        address _treasury,
        address _defaultAdjudicator,
        address _adjudicatorRegistry,
        address _protocolConfig  // ProtocolConfig for mutable parameters
    ) {
        // Set all immutables
    }
    
    // No admin functions, no setters, no Ownable
    function createMarket(...) external returns (address market) {
        // Deploy market, initialize, return address
    }
}
```

### ProtocolConfig Contract

Mutable protocol-wide parameters moved to separate contract:

```solidity
contract ProtocolConfig is Ownable, IProtocolConfig {
    uint256 public override liquidationFeeBps;
    address public override guardian;
    
    constructor(address _guardian, uint256 _liquidationFeeBps) {
        guardian = _guardian;
        liquidationFeeBps = _liquidationFeeBps;
    }
    
    function setLiquidationFeeBps(uint256 _feeBps) external onlyOwner { /* ... */ }
    function setGuardian(address _guardian) external onlyOwner { /* ... */ }
}
```

---

## Guardian Role

### Powers

The Guardian (set by Protocol Owner via `ProtocolConfig`) has per-market powers:

1. **`liquidate()`**: Trigger liquidation for failed-to-graduate markets
   - Protocol takes `liquidationFeeBps` as fee
   - LP holders redeem pro-rata via `redeemLP(...)` (no separate `claimLiquidationRefund` path)

2. **`forceGraduate()`**: Push stuck markets to graduated state
   - Bypasses graduation threshold check
   - Useful for markets that are close but stuck

### Implementation

```solidity
// LaunchpadMarket.sol
modifier onlyGuardian() {
    require(
        IProtocolConfig(ILaunchpadFactory(factory).protocolConfig()).guardian() == msg.sender,
        "Launchpad: not guardian"
    );
    _;
}

function liquidate() external onlyGuardian {
    require(!isGraduated && !isLive, "Launchpad: cannot liquidate");
    isLiquidated = true;
    // ... liquidation logic
}

function forceGraduate() external onlyGuardian {
    require(!isGraduated, "Launchpad: already graduated");
    isGraduated = true;
    emit MarketGraduated(feesAccrued, block.timestamp);
}
```

---

## Role Definitions

### Creator Has Governor Permissions

The **Creator** has **Governor** permissions for Launchpad markets:

```solidity
// LaunchpadMarket.sol
modifier onlyGovernor() override {
    require(msg.sender == creator, "Launchpad: not creator");
    _;
}

function initializeLaunchpad(...) external {
    creator = _creator;
    governor = _creator;  // Creator has governor permissions
    // ...
}
```

**Functions using `onlyGovernor`**:
- `increaseBBase(uint256 amount)` - Creator can manually increase liquidity

> Note: market settlement is **Adjudicator-only** via `finalizeResolution(outcome, tStar)`.

---

## Migration from Previous Version

### Backward Compatibility

- **Existing markets**: Continue to work (no breaking changes)
- **New markets**: Use current architecture automatically
- **Factory**: Current Factory is new deployment (previous Factory remains functional)

### Deployment Checklist

1. Deploy `ProtocolConfig` contract
2. Deploy new `LaunchpadFactory` (immutable, references ProtocolConfig)
3. Deploy `LaunchpadMarket` implementation (with V6 merged architecture)
4. Update frontend to use new Factory address
5. Test V6 markets with pre-graduation locking

---

## Testing

### Test Files

- **`LaunchpadV6.t.sol`**: 25 feature tests
- **`LaunchpadInvariants.t.sol`**: 8 invariant property tests
- **`QA_REPORT_V6.md`**: Comprehensive QA analysis

### Test Coverage

- ✅ Pre-graduation locking (5 tests)
- ✅ Liquidation (4 tests)
- ✅ Force graduate (2 tests)
- ✅ 2-contract architecture (3 tests)
- ✅ LP token operations (3 tests)
- ✅ Invariants (8 tests)

### Running Tests

```bash
forge test --match-contract LaunchpadV6Test -vvv
forge test --match-contract LaunchpadInvariantsTest -vvv
```

---

## References

- **ADR-015**: [Pre-Graduation Locking](../../../DECISIONS.md#adr-015-v6-pre-graduation-locking)
- **ADR-014**: [Sooth Launchpad Model](../../../DECISIONS.md#adr-014-sooth-launchpad-model-v5-architecture)
- **Base Architecture**: `SoothMarketV4` (continuous LMSR + orderbook)
- **Test Suite**: `test/LaunchpadV6.t.sol`
- **QA Report**: `test/QA_REPORT_V6.md`
