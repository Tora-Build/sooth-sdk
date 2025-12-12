# Lock Mechanism Comparison: Buy vs Sell (AMM Only)

> **Status**: Research Analysis  
> **Date**: 2025-12-12  
> **Context**: Compare two lock strategies for LP protection in the AMM

---

## 1. Overview

Two approaches to prevent information-based exploitation of the AMM:

| Strategy | What's Locked | Duration | When |
|----------|--------------|----------|------|
| **Lock-on-Buy** | Shares (can't sell) | 24h | After buying from AMM |
| **Lock-on-Sell** | USDC proceeds | 24h | After selling to AMM |

---

## 2. Attack Vector: Informed Trader

The core attack we're defending against:

```
T-2h:  Insider learns outcome (e.g., YES wins)
       ↓
       Wants to profit before settlement
       ↓
       OPTIONS:
       A) Buy YES → wait for settlement → redeem
       B) Already owns YES → Sell NO (if allowed)
```

---

## 3. Lock-on-Buy Analysis

**Rule**: After BUY, shares locked for 24h (can't sell back to AMM).

### 3.1 Attack Prevention

| Attack | Blocked? | How |
|--------|----------|-----|
| Buy YES with inside info, sell before settlement | ✅ Yes | Can't sell locked shares |
| Flash loan: borrow → buy YES → sell immediately | ✅ Yes | Can't sell same block |
| Already own unlocked YES, sell to lock profit | ❌ No | Old shares not locked |

### 3.2 Economic Properties

| Property | Rating | Notes |
|----------|--------|-------|
| **Capital Efficiency** | ⭐⭐⭐ | USDC never locked, can withdraw sale proceeds instantly |
| **LP Protection** | ⭐⭐ | Prevents new buys, but old positions can still exit |
| **UX Friction** | ⭐⭐⭐ | Only affects buyers, sellers have full liquidity |
| **Arbitrage** | ⭐⭐ | Arbers can still sell to correct mispricing |

### 3.3 Weakness

> **The T-48h Attack**:  
> Insider knows at T-48h that event will resolve YES.  
> Buys YES → waits 24h (unlocks at T-24h) → can sell or wait for redemption.  
> Lock didn't help because attacker had enough lead time.

**Mitigation**: This attack requires **longer lead time** than typical inside info (usually hours, not days).

---

## 4. Lock-on-Sell Analysis

**Rule**: After SELL, USDC proceeds locked for 24h (can't withdraw).

### 4.1 Attack Prevention

| Attack | Blocked? | How |
|--------|----------|-----|
| Buy YES → sell immediately | ✅ Yes | USDC stuck in vault |
| Sell to extract value, then withdraw | ✅ Yes | Must wait 24h |
| Buy and hold through settlement | ❌ No | No sell needed |

### 4.2 Economic Properties

| Property | Rating | Notes |
|----------|--------|-------|
| **Capital Efficiency** | ⭐ | USDC locked after every sell, even legitimate |
| **LP Protection** | ⭐⭐ | Prevents quick extraction, but can still buy |
| **UX Friction** | ⭐ | Punishes normal sell activity heavily |
| **Arbitrage** | ⭐ | Arbers can't quickly recycle capital |

### 4.3 Weakness

> **The Buy-Hold Attack**:  
> Insider buys YES with inside info → doesn't sell → redeems at settlement.  
> Lock-on-sell doesn't prevent this because attacker never sells to AMM.

---

## 5. Head-to-Head Comparison

| Dimension | Lock-on-Buy | Lock-on-Sell | Winner |
|-----------|-------------|--------------|--------|
| **Blocks flash loan exploit** | ✅ | ✅ | Tie |
| **Blocks informed BUY** | ✅ | ❌ | Lock-on-Buy |
| **Blocks informed SELL** | ❌ (old shares) | ✅ | Lock-on-Sell |
| **Capital efficiency** | High (USDC free) | Low (USDC locked) | Lock-on-Buy |
| **Arbitrage friendly** | ✅ Sell is fast | ❌ Sell locks capital | Lock-on-Buy |
| **Continuous trading** | ❌ **Blocked** | ✅ With buffer | **Lock-on-Sell** |
| **Implementation complexity** | Simple | Medium (buffer logic) | Lock-on-Buy |

---

## 6. Critical UX Issue: Continuous Trading Flow

### 6.1 Lock-on-Buy Breaks Normal Trading

With Lock-on-Buy, a trader **cannot** execute typical trading patterns:

```
Normal Trading Flow (BLOCKED by Lock-on-Buy):

  Buy 100 YES  →  Sell 50 YES  →  Buy 20 YES  →  Sell 70 YES
       │              ❌              ❌              ❌
       │         "Shares locked       │               │
       │          for 24h"            │               │
       └──────────────────────────────┴───────────────┘
                     ALL BLOCKED
```

**Problem**: Users must wait 24h between buy and any subsequent sell. This destroys:
- Day trading
- Position adjustment
- Risk management (can't exit if market moves against you)
- Arbitrage (can't recycle capital)

### 6.2 Lock-on-Sell with Dynamic Buffer

Lock-on-Sell can be designed with a **dynamic USDC buffer** that doesn't interrupt trading:

```
User's TraderVault Account:
┌────────────────────────────────────────────────┐
│  Total Balance: $10,000                        │
│  ┌──────────────────┐  ┌───────────────────┐   │
│  │  Available       │  │  Locked Buffer    │   │
│  │  $8,000          │  │  $2,000           │   │
│  │  (can trade)     │  │  (unlocks over    │   │
│  │                  │  │   rolling 24h)    │   │
│  └──────────────────┘  └───────────────────┘   │
└────────────────────────────────────────────────┘
```

**Key Insight**: The user can continue trading freely. Only the *proceeds* are locked, not the ability to trade. As long as `Available > trade cost`, trading continues uninterrupted.

### 6.3 Comparison

| Scenario | Lock-on-Buy | Lock-on-Sell (with buffer) |
|----------|-------------|----------------------------|
| Buy → Sell same day | ❌ Blocked | ✅ Works (proceeds locked) |
| Active day trading | ❌ Impossible | ✅ Works |
| Reduce position on bad news | ❌ Can't sell | ✅ Can sell |
| Flash loan attack | ✅ Blocked | ✅ Blocked (proceeds locked) |
| Arbitrage | ❌ Capital stuck in shares | ✅ Can recycle if has buffer |

---

## 7. Detailed Lock-on-Sell Design

### 7.1 Core Requirements

1. **Independent Lock Timers**: Each sell creates a separate lock entry with its own 24h countdown
2. **No Interference**: New locks don't extend or affect previous lock timers
3. **Auto-Claim on New Lock**: When creating a new lock, automatically claim any unlocked funds
4. **Manual Claim**: Users can claim unlocked funds at any time without selling

### 7.2 Data Structures

```solidity
// Individual lock entry
struct LockEntry {
    uint256 amount;      // USDC amount locked
    uint64 unlockTime;   // block.timestamp when it unlocks
}

// Per-user lock queue (circular buffer for gas efficiency)
struct UserLockState {
    LockEntry[] locks;   // Array of active locks
    uint256 headIndex;   // First active lock (for cleanup)
    uint256 available;   // Immediately available balance
    uint256 totalLocked; // Sum of all locked amounts (cached)
}

mapping(address => UserLockState) public userLocks;
```

### 7.3 Contract Interface

```solidity
interface ILockOnSell {
    // ═══════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════
    
    event Locked(address indexed user, uint256 amount, uint64 unlockTime);
    event Unlocked(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 amount);
    
    // ═══════════════════════════════════════════════════════════════════════
    // WRITE FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════
    
    /// @notice Called internally when user sells to AMM
    /// @dev Creates new lock entry, auto-claims any unlocked funds first
    function _lockProceeds(address user, uint256 amount) internal;
    
    /// @notice User manually claims all unlocked funds
    /// @return claimed Amount moved from locked to available
    function claimUnlocked() external returns (uint256 claimed);
    
    // ═══════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS (UI-Ready)
    // ═══════════════════════════════════════════════════════════════════════
    
    /// @notice Get user's available balance (can trade/withdraw immediately)
    function availableBalance(address user) external view returns (uint256);
    
    /// @notice Get user's total locked balance (sum of all active locks)
    function lockedBalance(address user) external view returns (uint256);
    
    /// @notice Get amount that can be claimed right now (unlocked but not yet claimed)
    function claimableBalance(address user) external view returns (uint256);
    
    /// @notice Get all active lock entries for UI display
    /// @return amounts Array of locked amounts
    /// @return unlockTimes Array of unlock timestamps
    function getLockEntries(address user) external view returns (
        uint256[] memory amounts,
        uint64[] memory unlockTimes
    );
    
    /// @notice Get the next unlock event
    /// @return amount Amount that will unlock next
    /// @return unlockTime When it will unlock (0 if no locks)
    function nextUnlock(address user) external view returns (
        uint256 amount,
        uint64 unlockTime
    );
}
```

### 7.4 Core Logic

```solidity
uint64 constant LOCK_DURATION = 24 hours;

function _lockProceeds(address user, uint256 amount) internal {
    UserLockState storage state = userLocks[user];
    
    // Step 1: Auto-claim any unlocked funds first
    uint256 claimed = _claimUnlockedInternal(user);
    if (claimed > 0) {
        emit Claimed(user, claimed);
    }
    
    // Step 2: Create new lock entry
    uint64 unlockTime = uint64(block.timestamp) + LOCK_DURATION;
    state.locks.push(LockEntry({
        amount: amount,
        unlockTime: unlockTime
    }));
    state.totalLocked += amount;
    
    emit Locked(user, amount, unlockTime);
}

function _claimUnlockedInternal(address user) internal returns (uint256 claimed) {
    UserLockState storage state = userLocks[user];
    uint256 len = state.locks.length;
    
    // Iterate from head, claim all expired locks
    for (uint256 i = state.headIndex; i < len; i++) {
        LockEntry storage lock = state.locks[i];
        
        if (lock.unlockTime <= block.timestamp) {
            // This lock has expired
            claimed += lock.amount;
            state.totalLocked -= lock.amount;
            state.headIndex = i + 1; // Move head forward
        } else {
            // Locks are ordered by time, so stop here
            break;
        }
    }
    
    // Add claimed to available
    state.available += claimed;
    
    if (claimed > 0) {
        emit Unlocked(user, claimed);
    }
}

function claimUnlocked() external returns (uint256 claimed) {
    claimed = _claimUnlockedInternal(msg.sender);
    if (claimed > 0) {
        emit Claimed(msg.sender, claimed);
    }
}
```

### 7.5 UI Data Fetching

The contract provides everything the UI needs in a single call:

```typescript
// Frontend hook
function useLockState(address: string) {
  const { data } = useContractReads({
    contracts: [
      { ...vault, functionName: 'availableBalance', args: [address] },
      { ...vault, functionName: 'lockedBalance', args: [address] },
      { ...vault, functionName: 'claimableBalance', args: [address] },
      { ...vault, functionName: 'getLockEntries', args: [address] },
      { ...vault, functionName: 'nextUnlock', args: [address] },
    ],
  });

  return {
    available: data[0],      // Can trade/withdraw now
    locked: data[1],         // Total locked
    claimable: data[2],      // Ready to claim
    lockEntries: data[3],    // Individual locks for timeline display
    nextUnlock: data[4],     // Countdown timer
  };
}
```

### 7.6 UI Display Recommendations

```
┌─────────────────────────────────────────────────────────────┐
│  💰 Your Balance                                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Available      │  $8,000.00   │  [Withdraw]           ││
│  │  Locked         │  $2,000.00   │  ⏱️ Unlocking...       ││
│  │  Ready to Claim │  $500.00     │  [Claim Now]          ││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  📋 Lock Timeline                                           │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  $500   │  🟢 Unlocked (claimable)                      ││
│  │  $800   │  ⏱️ Unlocks in 4h 23m                          ││
│  │  $700   │  ⏱️ Unlocks in 18h 45m                         ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 7.7 Example Flow

| Time | Action | Available | Locked | Claimable | Lock Entries |
|------|--------|-----------|--------|-----------|--------------|
| T+0h | Deposit $10,000 | $10,000 | $0 | $0 | [] |
| T+1h | Sell for $500 | $10,000 | $500 | $0 | [$500 @ T+25h] |
| T+2h | Buy for $300 | $9,700 | $500 | $0 | [$500 @ T+25h] |
| T+3h | Sell for $800 | $9,700 | $1,300 | $0 | [$500 @ T+25h, $800 @ T+27h] |
| T+25h | (First lock expires) | $9,700 | $800 | $500 | [$500 🟢, $800 @ T+27h] |
| T+26h | Sell for $200 | $10,200 | $1,000 | $0 | [$800 @ T+27h, $200 @ T+50h] |
| | ↳ Auto-claimed $500 | | | | |

**Key Points**:
- T+25h: First $500 expires but user doesn't need to claim manually
- T+26h: When user sells again, the $500 is auto-claimed before new lock is created
- Locks maintain independent timers (T+27h, T+50h)

### 7.8 Gas Optimization Notes

1. **Circular Buffer**: Use `headIndex` to avoid deleting array elements (expensive)
2. **Batch Claiming**: `_claimUnlockedInternal` claims all expired locks in one loop
3. **Cached Total**: `totalLocked` is cached to avoid summing array on every read
4. **Lazy Cleanup**: Only clean up when user interacts (sell or claim)

---

## 8. Revised Assessment

**Lock-on-Sell with dynamic buffer is superior for UX** while maintaining security:

| Property | Rating |
|----------|--------|
| **Security** | Same as Lock-on-Buy (prevents value extraction) |
| **Trading Flow** | ⭐⭐⭐ (uninterrupted) |
| **Capital Efficiency** | ⭐⭐ (need buffer headroom) |
| **Implementation** | Medium complexity (lock queue)


## 6. Game Theory Analysis

### 6.1 Rational Attacker Behavior

**Under Lock-on-Buy**:
- Attacker needs inside info **24+ hours before settlement**
- If info arrives <24h before settlement → can't profit via AMM
- May try orderbook instead (but faces counterparty, not LP)

**Under Lock-on-Sell**:
- Attacker can still BUY with inside info freely
- Attacker holds through settlement → redeems for $1
- Lock doesn't prevent the profitable strategy at all

### 6.2 Verdict

> Lock-on-Buy blocks the **primary attack vector** (buying with inside info).  
> Lock-on-Sell only blocks value extraction, but attacker can still *hold* to profit.

---

## 7. Why Lock-on-Buy is Superior

```
                           ┌─────────────────────────────────────┐
                           │     ATTACKER WITH INSIDE INFO       │
                           └───────────────┬─────────────────────┘
                                           │
                    ┌──────────────────────┴──────────────────────┐
                    ▼                                             ▼
           BUY winning side                                SELL losing side
                    │                                             │
        ┌───────────┴───────────┐                     ┌───────────┴───────────┐
        │   LOCK-ON-BUY (V4)     │                     │   LOCK-ON-SELL        │
        └───────────┬───────────┘                     └───────────┬───────────┘
                    ▼                                             ▼
            Shares LOCKED                                 USDC LOCKED
            Can't exit < 24h                              But can still HOLD
                    │                                     shares to settlement
                    ▼                                             │
            ❌ ATTACK BLOCKED                                     ▼
            (unless 24h+ lead time)                       ✅ ATTACK SUCCEEDS
```

**Key Insight**: The most damaging attack is **buying the winning side**.  
Lock-on-Buy directly targets this. Lock-on-Sell does not.

---

## 8. Retroactive Finality & The Retroactive Settlement Period

> **Definition (Whitepaper §3.3)**: Retroactive Finality records the **Effective Termination Time ($T^*$)** — the exact moment the event became true. All trades executed *after* $T^*$ are **economically reversed** via delta-PnL adjustments.

### 8.1 The Retroactive Settlement Period

The **Retroactive Settlement Period** is the time between:
- **$T^*$** (truth timestamp — when the event actually occurred)
- **$T_{cease}$** (when trading is halted on-chain)

```
          T*                    T_cease              Settlement
          │                        │                      │
──────────┼────────────────────────┼──────────────────────┼─────────▶ time
          │                        │                      │
          │◄─ RETROACTIVE PERIOD ─►│                      │
          │   (trades reversed)    │                      │
          │                        │                      │
    Event occurs           Trading stops           PnL distributed
    (real world)           (on-chain)              (final)
```

**All trades within the Retroactive Settlement Period are economically reversed.**

### 8.2 How It Protects LPs

| Scenario | What Happens |
|----------|--------------|
| Insider buys **after** $T^*$ (latency arbitrage) | ✅ Trade reversed — no profit |
| Regular trader buys **after** $T^*$ (unaware) | ✅ Trade reversed — no loss |
| Insider buys **before** $T^*$ | ❌ Trade honored — potential profit |

### 8.3 Why Lock-on-Buy is Still Needed

Retroactive Finality handles **post-$T^*$ trades**. But what about trades **before** $T^*$?

```
Attack: Insider learns outcome at T* - 1h (BEFORE the event)
        ↓
        Buys at T* - 1h (valid, before event)
        ↓
        Holds through settlement
        ↓
        Redeems for $1 ✅ (no reversal, trade was before T*)
```

This is where **Lock-on-Buy** protects — positions acquired shortly before $T^*$ are locked and can't be redeemed immediately.

### 8.4 Synergy: Lock-on-Buy + Retroactive Finality

| Protection Layer | Attack It Blocks |
|------------------|------------------|
| **Retroactive Finality** | Trades executed AFTER $T^*$ (latency arbitrage) |
| **Lock-on-Buy (24h)** | Trades executed BEFORE $T^*$ but within 24h window |

Together, they create a **full protection envelope**:

```
            │◄──── Lock-on-Buy ────►│◄── Retroactive Settlement Period ──►│
            │         24h           │          (T* to T_cease)            │
────────────┼───────────────────────┼─────────────────────────────────────▶
       T* - 24h                    T*                              T_cease
            │                       │                                   │
     Shares locked,          Event occurs,                    Trading stops,
     can't exit quickly      all post-T* trades               settlement begins
                             are reversed
```

---

## 9. Final Recommendation

### Revised Conclusion: Lock-on-Sell with Dynamic Buffer

Given the trading flow analysis in Section 6, **Lock-on-Sell with dynamic buffer** is the superior choice:

| Criterion | Lock-on-Buy | Lock-on-Sell (with buffer) |
|-----------|-------------|----------------------------|
| **Security** | ✅ Blocks informed buys | ✅ Blocks value extraction |
| **Continuous Trading** | ❌ Blocked | ✅ Preserved |
| **UX** | ❌ Poor (24h freeze) | ✅ Good (trade freely) |
| **Works with Retroactive Finality** | ✅ | ✅ |

### Full Protection Stack

| Layer | Mechanism | What It Blocks |
|-------|-----------|----------------|
| **1. Retroactive Finality** | Trades after $T^*$ reversed | Latency arbitrage |
| **2. Lock-on-Sell (buffer)** | Proceeds locked 24h | Value extraction before settlement |
| **3. (Optional) Lock-on-Buy** | Shares locked 24h | Pre-$T^*$ informed trading |

### Recommended V5 Design

```
User Account:
┌─────────────────────────────────────────┐
│  Available: $8,000   │  Locked: $2,000  │
│  (can trade)         │  (rolling 24h)   │
└─────────────────────────────────────────┘

On SELL:
  proceeds → Locked buffer (24h timer starts)

On BUY:
  cost → deducted from Available only

On WITHDRAW:
  only Available can be withdrawn
```

**Benefits**:
- Users can trade continuously (buy/sell/buy/sell)
- Attackers can't extract value (proceeds locked)
- Retroactive Finality handles post-$T^*$ trades
- Capital efficiency maintained (locked funds still count toward balance)

---

## 10. References

- [V4_LOCK_ON_BUY_ARCHITECTURE.md](./V4_LOCK_ON_BUY_ARCHITECTURE.md) — Current implementation spec
- [LIQUIDITY_DYNAMICS.md](./LIQUIDITY_DYNAMICS.md) — LP risk exposure analysis
- [Sooth Whitepaper §3.3](../public/sooth_whitepaper.md) — Retroactive Finality definition
