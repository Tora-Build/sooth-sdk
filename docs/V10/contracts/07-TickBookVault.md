# TickBookVault - Singleton Vault for Orderbook

**File**: `packages/contracts-core/src/TickBookVault.sol`  
**Status**: Stable  
**Version**: V10.0.0

---

## Overview

`TickBookVault` is the **singleton custody layer** for the TickBook orderbook. It manages:

- **USDC Deposits/Withdrawals**: Users deposit USDC to trade
- **Internal Balances**: Track available and locked USDC per user
- **Outcome Token Accounting**: Track YES/NO token balances internally
- **Order Collateral**: Reserve USDC for orders, release on fill/cancel
- **Market Settlement**: Handle redemption after market resolution

### Key Design
- **Singleton Pattern**: One vault serves all markets
- **Internal Accounting**: Minimizes external transfers for gas efficiency
- **Pull-Based**: Users explicitly deposit/withdraw
- **Market-Scoped Balances**: Collateral tracked per market

---

## Architecture

```
+-------------------+
|      User         |
+--------+----------+
         |
         | deposit/withdraw
         v
+-------------------+
|   TickBookVault   |
|   - USDC custody  |
|   - Internal      |
|     balances      |
+--------+----------+
         |
         | spendAvailableToMarket
         | refundMarketToAvailable
         v
+-------------------+
| TickBookPoolMgr   |
|   - Order mgmt    |
|   - Crossing      |
+-------------------+
```

---

## State Variables

```solidity
/// @notice USDC token
IERC20 public immutable usdc;

/// @notice Authorized TickBookPoolManager
address public poolManager;

/// @notice User's available USDC balance (spendable)
mapping(address => uint256) private _availableBalance;

/// @notice User's outcome token balances per market
/// market => user => outcome => balance
mapping(address => mapping(address => mapping(uint8 => uint256))) private _outcomeBalances;

/// @notice User's locked outcome tokens (in spot sell orders)
/// market => user => outcome => locked
mapping(address => mapping(address => mapping(uint8 => uint256))) private _lockedOutcome;
```

---

## Core Functions

### 1. Deposit USDC

```solidity
function depositUsdc(uint256 amount) external nonReentrant
```

**Effect**:
1. Transfer USDC from user to vault
2. Credit user's available balance
3. User can now place orders

**Example**:
```solidity
usdc.approve(vault, 1000e6);
vault.depositUsdc(1000e6);
// _availableBalance[user] += 1000e6
```

---

### 2. Withdraw USDC

```solidity
function withdrawUsdc(uint256 amount) external nonReentrant
```

**Precondition**: User has sufficient available balance  
**Effect**:
1. Debit user's available balance
2. Transfer USDC to user

**Example**:
```solidity
vault.withdrawUsdc(500e6);
// _availableBalance[user] -= 500e6
// User receives 500 USDC
```

---

### 3. Spend Available to Market (PoolManager Only)

```solidity
function spendAvailableToMarket(
    address user,
    address market,
    uint256 amount
) external onlyPoolManager
```

**Caller**: TickBookPoolManager only  
**Effect**: Move USDC from user's available balance to market collateral

**Used when**: User places an order

---

### 4. Refund Market to Available (PoolManager Only)

```solidity
function refundMarketToAvailable(
    address market,
    address user,
    uint256 amount
) external onlyPoolManager
```

**Caller**: TickBookPoolManager only  
**Effect**: Return unused collateral to user's available balance

**Used when**: Order cancelled or partially filled

---

### 5. Credit Outcome (PoolManager Only)

```solidity
function creditOutcome(
    address market,
    address user,
    uint8 outcome,
    uint256 amount
) external onlyPoolManager
```

**Effect**: Credit outcome tokens to user's internal balance

**Used when**: Order fills (user receives YES or NO tokens)

---

### 6. Lock/Unlock Outcome (Spot Sells)

```solidity
function lockOutcome(
    address market,
    address user,
    uint8 outcome,
    uint256 amount
) external onlyPoolManager

function unlockOutcome(
    address market,
    address user,
    uint8 outcome,
    uint256 amount
) external onlyPoolManager
```

**Lock**: Move tokens from available to locked (for spot sell)  
**Unlock**: Return tokens on spot sell cancel

---

### 7. Transfer Locked Outcome (Spot Fill)

```solidity
function transferLockedOutcome(
    address market,
    address from,
    address to,
    uint8 outcome,
    uint256 amount
) external onlyPoolManager
```

**Effect**: Transfer locked tokens from seller to buyer

**Used when**: Spot sell fills during unified crossing

---

### 8. Redeem Resolved (Settlement)

```solidity
function redeemResolved(
    address market,
    uint8 winningOutcome
) external nonReentrant returns (uint256 payout)
```

**Caller**: Any user with outcome tokens  
**Precondition**: Market must be settled  
**Effect**:
1. Calculate payout based on winning outcome
2. Burn user's outcome tokens (internal)
3. Credit USDC to user's available balance

**Payout Logic**:
```solidity
if (winningOutcome == 1) {
    // YES won
    payout = yesBalance;  // YES worth 1 USDC each
} else if (winningOutcome == 0) {
    // NO won
    payout = noBalance;   // NO worth 1 USDC each
} else {
    // INVALID
    payout = (yesBalance + noBalance) / 2;
}
```

---

## View Functions

```solidity
// Get user's available USDC balance
function getAvailableBalance(address user) external view returns (uint256)

// Get user's outcome token balance
function getOutcomeBalance(address market, address user, uint8 outcome)
    external view returns (uint256)

// Get user's locked outcome tokens
function getLockedOutcome(address market, address user, uint8 outcome)
    external view returns (uint256)

// Get total balance (available + locked)
function getTotalOutcomeBalance(address market, address user, uint8 outcome)
    external view returns (uint256 available, uint256 locked)
```

---

## Events

```solidity
event UsdcDeposited(address indexed user, uint256 amount);
event UsdcWithdrawn(address indexed user, uint256 amount);
event OutcomeCredited(address indexed market, address indexed user, uint8 outcome, uint256 amount);
event OutcomeLocked(address indexed market, address indexed user, uint8 outcome, uint256 amount);
event OutcomeUnlocked(address indexed market, address indexed user, uint8 outcome, uint256 amount);
event PositionRedeemed(address indexed market, address indexed user, uint256 payout);
```

---

## Access Control

| Function | Caller |
|----------|--------|
| `depositUsdc` | Anyone |
| `withdrawUsdc` | Anyone (their own balance) |
| `spendAvailableToMarket` | PoolManager only |
| `refundMarketToAvailable` | PoolManager only |
| `creditOutcome` | PoolManager only |
| `lockOutcome` | PoolManager only |
| `unlockOutcome` | PoolManager only |
| `transferLockedOutcome` | PoolManager only |
| `creditUsdcAvailable` | PoolManager only |
| `transferFee` | PoolManager only |
| `redeemResolved` | Anyone (their own position) |

---

## Invariants

1. **USDC Solvency**: Vault holds >= sum of all user available balances
2. **Outcome Conservation**: Total outcome tokens == total minted by fills
3. **Locked <= Available**: For each outcome, locked <= total balance
4. **No Negative Balances**: All balances >= 0

---

## Security Considerations

### Reentrancy
- `nonReentrant` on deposit/withdraw/redeem

### Access Control
- Most functions restricted to PoolManager
- Users can only affect their own balances

### Arithmetic
- All operations check for underflow
- SafeERC20 for external transfers

---

## Integration with TickBookPoolManager

### Order Placement

```solidity
// In TickBookPoolManager.placeOrder()
vault.spendAvailableToMarket(user, market, collateral);
// User's USDC is now reserved for this order
```

### Order Fill

```solidity
// In crossing logic
vault.creditOutcome(market, buyer, outcome, shares);
// Buyer receives outcome tokens
```

### Spot Sell Fill

```solidity
// In _fillSpotLiquidity()
vault.transferLockedOutcome(market, seller, buyer, outcome, shares);
// Tokens move from seller to buyer
```

### Order Cancel

```solidity
// In _cancelInternal()
vault.refundMarketToAvailable(market, user, unusedCollateral);
// Unused USDC returned to available balance
```

---

## Example Flows

### Flow 1: Deposit -> Trade -> Withdraw

```solidity
// 1. Deposit
vault.depositUsdc(1000e6);

// 2. Place order (PoolManager calls internally)
// vault.spendAvailableToMarket(user, market, 500e6);

// 3. Order fills
// vault.creditOutcome(market, user, 1, 800e18);  // 800 YES tokens

// 4. Later, redeem after settlement
vault.redeemResolved(market, 1);  // YES won, get 800 USDC

// 5. Withdraw
vault.withdrawUsdc(vault.getAvailableBalance(user));
```

### Flow 2: Spot Sell

```solidity
// 1. User has YES tokens (from previous fill)
// 2. Place spot sell (PoolManager calls)
// vault.lockOutcome(market, user, 1, 500e18);

// 3. Spot sell fills
// vault.transferLockedOutcome(market, seller, buyer, 1, 500e18);

// 4. Seller receives USDC (via pooled mechanism)
```

---

## Cross-References

- [TickBookPoolManager](./03-TickBookPoolManager.md)
- [Collateralizer](./05-Collateralizer.md) - External token version
- [TruthMarket Settlement](./02-TruthMarket.md)
