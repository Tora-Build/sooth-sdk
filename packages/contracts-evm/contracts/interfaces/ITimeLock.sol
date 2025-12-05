// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ITimeLock {
    struct PendingUnlock {
        uint256 amount;
        uint256 unlockTime;
    }

    function lockProceeds(address user, uint256 amount) external;
    function claimUnlocked() external returns (uint256 amount);
    function claimUnlockedFor(address user) external returns (uint256 amount); // Added this
    function pendingBalance(address user) external view returns (uint256);
    function getPendingUnlocks(address user) external view returns (PendingUnlock[] memory);
    function lockDuration() external view returns (uint256);
    function setLockDuration(uint256 duration) external;
    function clawback(address user, uint256 amount, address recipient) external;
}
