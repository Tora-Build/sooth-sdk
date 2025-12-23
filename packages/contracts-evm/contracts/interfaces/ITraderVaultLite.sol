// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITraderVaultLite
 * @notice Minimal USDC custody interface for V8
 * @dev Logicless vault - only handles deposits and withdrawals
 *      All trading logic is in AMM Engine and TickBook
 */
interface ITraderVaultLite {
    // ============================================
    // Events
    // ============================================

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);

    // ============================================
    // Deposit/Withdraw
    // ============================================

    /**
     * @notice Deposit USDC into vault
     * @param amount USDC amount to deposit (WAD)
     */
    function deposit(uint256 amount) external;

    /**
     * @notice Withdraw USDC from vault
     * @param amount USDC amount to withdraw (WAD)
     */
    function withdraw(uint256 amount) external;

    /**
     * @notice Get user's USDC balance
     * @param user User address
     * @return USDC balance (WAD)
     */
    function balanceOf(address user) external view returns (uint256);

    /**
     * @notice Get total USDC in vault
     * @return Total USDC (WAD)
     */
    function totalAssets() external view returns (uint256);

    // ============================================
    // Asset Info
    // ============================================

    /**
     * @notice Get underlying asset (USDC)
     * @return USDC token address
     */
    function asset() external view returns (address);
}
