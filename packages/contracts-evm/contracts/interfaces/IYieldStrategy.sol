// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title IYieldStrategy
/// @notice Interface for yield-generating strategies (Aave, Spark, etc.)
/// @dev Implementation deferred - TraderVault will use this to deposit idle funds
interface IYieldStrategy {
    /// @notice Deposit assets into the yield strategy
    /// @param amount Amount of underlying asset to deposit
    /// @return shares Amount of strategy shares received
    function deposit(uint256 amount) external returns (uint256 shares);

    /// @notice Withdraw assets from the yield strategy
    /// @param shares Amount of strategy shares to redeem
    /// @return amount Amount of underlying asset received
    function withdraw(uint256 shares) external returns (uint256 amount);

    /// @notice Get total assets held by the strategy
    /// @return Total value in underlying asset terms
    function totalAssets() external view returns (uint256);

    /// @notice Get the underlying asset address
    function asset() external view returns (address);
}
