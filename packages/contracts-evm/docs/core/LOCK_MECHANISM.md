# Lock-on-Sell Mechanism

> **Version**: V4.6  
> **Status**: Implemented (branch `codex/review-and-implement-lock-mechanism`)  
> **ADR**: [ADR-010](../../../DECISIONS.md#adr-010-lock-on-sell-vs-lock-on-buy)

---

## Overview

Lock-on-Sell is a **Retroactive Finality** protection mechanism that locks USDC proceeds for 24 hours after a user sells shares to the AMM. This allows continuous trading while preventing value extraction after an event's outcome becomes known.

```
Lock-on-Buy (V4.5)           vs           Lock-on-Sell (V4.6)
┌─────────────────────┐                   ┌─────────────────────┐
│ BUY → shares locked │                   │ BUY → shares free   │
│ wait 24h            │                   │ SELL → proceeds     │
│ SELL → USDC free    │                   │        locked 24h   │
└─────────────────────┘                   └─────────────────────┘
     ❌ Blocks trading                         ✅ Continuous trading
```

---

## Architecture

### Storage Location

Lock state lives in **GovernorVault** (not TraderVault):

```solidity
// GovernorVault.sol
struct LockEntry {
    uint256 amount;      // USDC amount locked
    uint64 unlockTime;   // When it unlocks
}

struct UserLockState {
    LockEntry[] locks;   // Per-user lock queue
    uint256 headIndex;   // First active lock (gas optimization)
    uint256 totalLocked; // Sum of locked amounts
}

mapping(address => UserLockState) private _lockStates;
uint256 public totalLockedProceeds;  // Global sum for LP protection
```

### Flow Diagram

```
User sells 50 YES shares
        │
        ▼
┌───────────────────────────────────────┐
│  TraderVault.tradeAMM(market, 0, -50) │
└───────────────────┬───────────────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ Market.executeAMMTrade │ ─── updates qYes/qNo
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ governorVault         │
        │   .lockProceeds(      │ ─── funds stay in Governor
        │      marketId,        │     earmarked for user
        │      user,            │
        │      netProceeds      │
        │   )                   │
        └───────────┬───────────┘
                    │
                    ▼
        ┌───────────────────────┐
        │ LockEntry created     │
        │ unlockTime = now + 24h│
        └───────────────────────┘
```

---

## Contract Interface

### GovernorVault (Lock Functions)

```solidity
interface ISoothGovernorVault {
    // Lock proceeds after AMM sell (called by TraderVault)
    function lockProceeds(
        uint256 marketId, 
        address user, 
        uint256 amount
    ) external returns (uint64 unlockTime);
    
    // Claim unlocked funds (called by TraderVault)
    function claimUnlocked(
        address user, 
        address recipient
    ) external returns (uint256 claimed);
    
    // View: User's total locked balance
    function lockedBalance(address user) external view returns (uint256);
    
    // View: Amount ready to claim right now
    function claimableBalance(address user) external view returns (uint256);
    
    // View: All lock entries (for UI timeline)
    function getLockEntries(address user) external view returns (
        uint256[] memory amounts,
        uint64[] memory unlockTimes
    );
    
    // View: Next unlock event
    function nextUnlock(address user) external view returns (
        uint256 amount,
        uint64 unlockTime
    );
}
```

### TraderVault (User-Facing)

```solidity
interface ISoothTraderVaultV4 {
    // Claim all unlocked proceeds to available balance
    function claimUnlocked() external returns (uint256 amount);
    
    // View delegated to GovernorVault
    function lockedBalance(address user) external view returns (uint256);
    function claimableBalance(address user) external view returns (uint256);
    function getLockEntries(address user) external view returns (
        uint256[] memory amounts,
        uint64[] memory unlockTimes
    );
    function nextUnlock(address user) external view returns (
        uint256 amount,
        uint64 unlockTime
    );
}
```

---

## User Balance Model

```
User's TraderVault Account
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ┌─────────────────┐  ┌────────────────┐  ┌──────────┐ │
│  │   AVAILABLE     │  │    PENDING     │  │  LOCKED  │ │
│  │                 │  │                │  │          │ │
│  │   $8,000        │  │    $500        │  │  $2,000  │ │
│  │                 │  │                │  │          │ │
│  │  Can trade or   │  │  Reserved for  │  │ Unlocks  │ │
│  │  withdraw       │  │  limit orders  │  │ over 24h │ │
│  └─────────────────┘  └────────────────┘  └──────────┘ │
│                                                         │
│  totalBalance = available + pending + locked            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

| Balance Type | Source | Can Withdraw | Can Trade |
|--------------|--------|--------------|-----------|
| `available` | `TraderVault.accounts[user].available` | ✅ | ✅ |
| `pending` | `TraderVault.accounts[user].pending` | ❌ | ❌ (reserved) |
| `locked` | `GovernorVault.lockedBalance(user)` | ❌ (until unlocked) | ❌ |

---

## Trading Flows

### AMM Buy (Unchanged)

```
1. User deposits USDC → available += amount
2. User buys 100 YES:
   - Cost deducted from available
   - Shares credited to ammPositions[user][market].yesShares
   - No unlockTime set (shares always free to sell)
```

### AMM Sell (Lock-on-Sell)

```
1. User sells 50 YES:
   - Shares deducted from ammPositions
   - Market.executeAMMTrade() calculates proceeds
   - Proceeds NOT sent to TraderVault
   
2. GovernorVault.lockProceeds():
   - Creates LockEntry{amount, unlockTime = now + 24h}
   - Adds to user's lock queue
   - Increments totalLockedProceeds
   - Emits Locked(user, amount, unlockTime)

3. User's state:
   - available: unchanged
   - locked: += proceeds
   - shares: -= 50
```

### Claim Unlocked

```
1. User calls TraderVault.claimUnlocked():
   - Delegates to GovernorVault.claimUnlocked(user, traderVault)
   
2. GovernorVault iterates lock queue:
   - For each expired lock (unlockTime <= now):
     - claimed += amount
     - headIndex++
     - totalLocked −= amount
   
3. Transfer & credit:
   - totalAssets −= claimed (funds leave Governor)
   - totalLockedProceeds −= claimed
   - Transfer USDC → TraderVault
   - TraderVault: available += claimed
   
4. Emits: Unlocked, Claimed
```

---

## LP Protection

### Withdraw Protection

```solidity
// GovernorVault.withdrawFor()
require(
    totalAssets >= totalLockedExposure + totalLockedProceeds + assets,
    "Locked funds"
);
```

LPs cannot withdraw funds that are:
1. **Locked for exposure** — Reserved for potential market losses
2. **Locked for traders** — Earmarked for trader proceeds

---

## Constants

```solidity
uint256 public constant LOCK_DURATION = 24 hours;
```

---

## Events

```solidity
event Locked(address indexed user, uint256 amount, uint64 unlockTime);
event Unlocked(address indexed user, uint256 amount);
event Claimed(address indexed user, uint256 amount);
```

---

## Auto-Claim Behavior

When a user sells again, expired locks are automatically claimed:

```solidity
function _lockProceeds(address user, uint256 marketId, uint256 amount) internal {
    _claimUnlockedInternal(user);  // ← Auto-claim expired locks first
    
    uint64 unlockTime = governorVault.lockProceeds(marketId, user, amount);
    emit Locked(user, amount, unlockTime);
}
```

This ensures the lock queue doesn't grow indefinitely.

---

## Example Timeline

| Time | Action | Available | Locked | Claimable |
|------|--------|-----------|--------|-----------|
| T+0h | Deposit $10,000 | $10,000 | $0 | $0 |
| T+1h | Buy 1000 YES (cost $500) | $9,500 | $0 | $0 |
| T+2h | Sell 500 YES (proceeds $300) | $9,500 | $300 | $0 |
| T+3h | Sell 200 YES (proceeds $100) | $9,500 | $400 | $0 |
| T+26h | (First lock expired) | $9,500 | $100 | $300 |
| T+27h | Sell 100 YES (auto-claims $300) | $9,800 | $150 | $0 |

---

## Related Documents

- [ADR-010: Lock-on-Sell vs Lock-on-Buy](../../../DECISIONS.md#adr-010-lock-on-sell-vs-lock-on-buy)
- [LOCK_MECHANISM_COMPARISON.md](../research/LOCK_MECHANISM_COMPARISON.md)
- [Frontend Integration: Lock UI Spec](./LOCK_UI_SPEC.md)
