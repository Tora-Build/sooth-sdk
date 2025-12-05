# Settlement & Claims Guide

**Date:** 2025-12-04
**Status:** ✅ Time-Lock Claims Live | ✅ Settlement Redemption Live

> [!IMPORTANT] > **Two Types of Claims:**
>
> 1. **Time-Lock Claim:** Unlocking proceeds from selling shares (Live).
> 2. **Settlement Claim:** Redeeming winning shares after market resolution (Live).

## 1. Time-Lock Claims (Live)

When a user **sells** shares (e.g., Sell YES), the proceeds are NOT immediately available for withdrawal. They are moved to a `pendingBalance`.

- **Lock Duration:** 48 hours (default).
- **Goal:** Prevent manipulation and ensure solvency.
- **Claiming:** **Automatic** on deposit/withdraw/trade. Manual `claimUnlocked()` is optional.

### User Flow

1. **User Sells:** `tradeAMM` (sell side) → Proceeds go to `pendingBalance`.
2. **Wait:** User waits for lock duration (each sell tracked individually).
3. **Unlock:**
   - **Option A (Auto):** User does any action (deposit/withdraw/trade) → Unlocked funds move to `availableBalance`.
   - **Option B (Manual):** User calls `claimUnlocked()` → Unlocked funds move to `availableBalance`.
4. **Result:** Funds are available for use.

### Frontend Integration

#### Read User Balances

```javascript
// Contract: TraderVault
const traderVault = new ethers.Contract(
  TRADER_VAULT_ADDRESS,
  TRADER_VAULT_ABI,
  provider
);

// Read balances
const available = await traderVault.availableBalance(userAddress); // Liquid
const pending = await traderVault.pendingBalance(userAddress); // Locked
const total = await traderVault.totalBalance(userAddress); // Total

// Display
console.log(`Available: ${ethers.formatUnits(available, 18)} USDC`);
console.log(`Locked:    ${ethers.formatUnits(pending, 18)} USDC`);
console.log(`Total:     ${ethers.formatUnits(total, 18)} USDC`);
```

#### Read Detailed Unlock Schedule

```javascript
// Get TimeLock contract address from TraderVault
const timeLockAddress = await traderVault.timeLock();
const timeLock = new ethers.Contract(timeLockAddress, TIME_LOCK_ABI, provider);

// Get array of pending unlocks with timestamps
const pendingItems = await timeLock.getPendingUnlocks(userAddress);

// pendingItems = [
//   { amount: 100e18, unlockTime: 1733500000 },
//   { amount: 50e18,  unlockTime: 1733510000 },
// ]

// Calculate what's claimable NOW
const now = Math.floor(Date.now() / 1000);
let claimableNow = 0n;
let stillLocked = 0n;
let nextUnlockTime = null;

for (const item of pendingItems) {
  if (item.unlockTime <= now) {
    claimableNow += item.amount;
  } else {
    stillLocked += item.amount;
    if (!nextUnlockTime || item.unlockTime < nextUnlockTime) {
      nextUnlockTime = item.unlockTime;
    }
  }
}

// Display countdown
if (nextUnlockTime) {
  const timeRemaining = nextUnlockTime - now;
  console.log(
    `Next unlock in: ${Math.floor(timeRemaining / 3600)}h ${Math.floor(
      (timeRemaining % 3600) / 60
    )}m`
  );
}
```

#### Claim Button

```javascript
// Check if anything is claimable
if (claimableNow > 0n) {
  // Show "Claim X USDC" button
  const tx = await traderVault.claimUnlocked();
  await tx.wait();
  console.log("Claimed successfully!");
} else if (stillLocked > 0n) {
  // Show locked state with countdown
  console.log(`${ethers.formatUnits(stillLocked, 18)} USDC locked`);
}
```

### Summary Table

| Function                  | Contract    | Returns                       |
| ------------------------- | ----------- | ----------------------------- |
| `availableBalance(user)`  | TraderVault | Liquid funds (uint256)        |
| `pendingBalance(user)`    | TraderVault | Locked funds (uint256)        |
| `totalBalance(user)`      | TraderVault | Total funds (uint256)         |
| `getPendingUnlocks(user)` | TimeLock    | Array of {amount, unlockTime} |
| `claimUnlocked()`         | TraderVault | Claims all unlocked (batched) |

## 2. Settlement Redemption (✅ Live)

After a market is settled, users holding winning shares can redeem them for 1 USDC per share.

**Flow:**

1. Market is settled via `markSettled(winningOutcome)`.
2. Users holding winning shares call `traderVault.redeem(marketAddress)`.
3. Contract burns shares and credits 1 USDC per share to `availableBalance`.

### Frontend Integration

```javascript
// Check if market is settled
const isSettled = await market.isSettled();
const winningOutcome = await market.winningOutcome(); // 0 = YES, 1 = NO

// Check user's winning shares
const yesShares = await market.yesBalance(userAddress);
const noShares = await market.noBalance(userAddress);
const winningShares = winningOutcome === 0 ? yesShares : noShares;

// Redeem if user has winning shares
if (winningShares > 0) {
  await traderVault.redeem(marketAddress);
}
```

## 3. Admin Settlement

Guardians can settle markets using the `SoothMarketV3` contract.

```solidity
function markSettled(uint8 winningOutcome) external onlyOwner;
```

- **0:** YES Wins
- **1:** NO Wins
