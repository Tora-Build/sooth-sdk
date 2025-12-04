// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../core/SoothInterfaces.sol";
import "../interfaces/ITimeLock.sol";

/// @title SoothTimeLock
/// @notice Manages time-locked proceeds for retroactive settlement protection
/// @dev Implements a queue of pending unlocks per user
contract SoothTimeLock is ITimeLock, Ownable {
    // ============ State ============

    // Mapping from user to list of pending unlocks
    mapping(address => PendingUnlock[]) private _unlocks;
    
    // Mapping from user to total pending balance
    mapping(address => uint256) private _pendingBalance;

    // Configuration
    uint256 public override lockDuration;
    
    // Constants
    uint256 public constant MIN_LOCK_DURATION = 1 hours;
    uint256 public constant MAX_LOCK_DURATION = 7 days;

    // ============ Events ============

    event LockDurationSet(uint256 newDuration);
    event ProceedsLocked(address indexed user, uint256 amount, uint256 unlockTime);
    event ProceedsUnlocked(address indexed user, uint256 amount);
    event Clawback(address indexed user, uint256 amount, address indexed recipient);

    // ============ Constructor ============

    constructor(uint256 _lockDuration) {
        require(_lockDuration >= MIN_LOCK_DURATION && _lockDuration <= MAX_LOCK_DURATION, "TimeLock: invalid duration");
        lockDuration = _lockDuration;
    }

    // ============ Core Logic ============

    function lockProceeds(address user, uint256 amount) external override onlyOwner {
        require(amount > 0, "TimeLock: zero amount");

        uint256 unlockTime = block.timestamp + lockDuration;
        
        _unlocks[user].push(PendingUnlock({
            amount: amount,
            unlockTime: unlockTime
        }));
        
        _pendingBalance[user] += amount;
        
        emit ProceedsLocked(user, amount, unlockTime);
    }

    function claimUnlocked() external override returns (uint256 amount) {
        address user = msg.sender; // Only user can claim their own unlocks via Vault delegation
        // Note: In v3 architecture, TraderVault calls this. 
        // But wait, TraderVault calls this on behalf of user. 
        // If TraderVault calls this, msg.sender is TraderVault.
        // We need to know who the user is.
        // The interface `claimUnlocked()` in ITimeLock doesn't take a user param.
        // Let's check ITimeLock definition.
        
        // Re-reading interface: function claimUnlocked() external returns (uint256 amount);
        // This implies the caller is the user. But the Vault holds the funds.
        // If the Vault holds the funds, the TimeLock contract is just accounting?
        // Or does TimeLock hold the funds?
        
        // Design Decision: TimeLock should be ACCOUNTING ONLY. Funds stay in Vault.
        // But `claimUnlocked` needs to tell Vault how much to move from pending to available.
        // So `claimUnlocked` should probably be called by Vault, passing the user address.
        
        // Let's adjust the interface implementation to support `claimUnlockedFor(user)` pattern
        // or keep it simple: Vault calls `getClaimable(user)` then updates its own state.
        
        // Actually, let's stick to the interface but we need to fix the calling pattern.
        // If TraderVault calls `timeLock.claimUnlocked()`, it expects a return value.
        // But TimeLock doesn't know *which* user unless passed.
        
        revert("Use claimUnlockedFor(address)");
    }

    /// @notice Claim unlocked proceeds for a specific user (called by TraderVault)
    /// @param user The user to claim for
    /// @return amount Total amount claimed
    function claimUnlockedFor(address user) external onlyOwner returns (uint256 amount) {
        PendingUnlock[] storage queue = _unlocks[user];
        uint256 totalClaimable = 0;
        
        // Iterate backwards to allow efficient removal? No, queue is FIFO usually.
        // But we want to process all eligible items.
        // Since we can't easily resize array from front, we might need a pointer or swap-pop.
        // Swap-pop changes order, but order matters for unlock time.
        // Actually, since they are ordered by time (always increasing), 
        // we can just iterate from start. But Solidity arrays don't support shift.
        
        // Optimization: Just count claimable amount and rebuild array? 
        // Or use a mapping index?
        // For MVP, let's just rebuild the array. Gas cost might be high if many small trades.
        // Better: `startIndex` mapping?
        
        uint256 i = 0;
        uint256 len = queue.length;
        uint256 newLen = 0;
        
        // We'll do an in-place filter
        for (i = 0; i < len; i++) {
            if (queue[i].unlockTime <= block.timestamp) {
                totalClaimable += queue[i].amount;
            } else {
                // Keep this one
                if (newLen != i) {
                    queue[newLen] = queue[i];
                }
                newLen++;
            }
        }
        
        // Resize array
        if (len != newLen) {
            for (i = newLen; i < len; i++) {
                queue.pop();
            }
        }
        
        if (totalClaimable > 0) {
            _pendingBalance[user] -= totalClaimable;
            emit ProceedsUnlocked(user, totalClaimable);
        }
        
        return totalClaimable;
    }

    // ============ View Functions ============

    function pendingBalance(address user) external view override returns (uint256) {
        return _pendingBalance[user];
    }

    function getPendingUnlocks(address user) external view override returns (PendingUnlock[] memory) {
        return _unlocks[user];
    }

    // ============ Admin Functions ============

    function setLockDuration(uint256 duration) external override onlyOwner {
        require(duration >= MIN_LOCK_DURATION && duration <= MAX_LOCK_DURATION, "TimeLock: invalid duration");
        lockDuration = duration;
        emit LockDurationSet(duration);
    }

    function clawback(address user, uint256 amount, address recipient) external override onlyOwner {
        require(amount <= _pendingBalance[user], "TimeLock: insufficient pending");
        
        // Reduce pending balance
        _pendingBalance[user] -= amount;
        
        // We need to remove `amount` from the queue.
        // Strategy: Remove from latest locks first (LIFO) or earliest?
        // Probably LIFO makes sense (clawback recent suspicious trades), 
        // but typically clawback is for specific bad actions.
        // For simplicity, we just reduce amounts from the end of the queue (latest locks).
        
        uint256 remainingToClaw = amount;
        uint256 len = _unlocks[user].length;
        
        while (remainingToClaw > 0 && len > 0) {
            len--;
            PendingUnlock storage item = _unlocks[user][len];
            
            if (item.amount > remainingToClaw) {
                item.amount -= remainingToClaw;
                remainingToClaw = 0;
            } else {
                remainingToClaw -= item.amount;
                _unlocks[user].pop();
            }
        }
        
        emit Clawback(user, amount, recipient);
    }
}
