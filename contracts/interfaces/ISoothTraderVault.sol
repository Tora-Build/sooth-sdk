// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IYieldStrategy.sol";
import "./ITimeLock.sol";

/// @title ISoothTraderVault
/// @notice Single entry point for all Sooth trading - deposit, withdraw, trade AMM, trade orderbook
/// @dev Integrates with yield strategy for idle funds and time-lock for retroactive settlement
interface ISoothTraderVault {
    // ============ Events ============

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event TradeExecuted(
        address indexed user,
        address indexed market,
        uint8 outcome,
        int256 deltaShares,
        int256 cost
    );
    event OrderPlaced(
        address indexed user,
        address indexed market,
        uint256 indexed orderId,
        uint8 outcome,
        uint256 price,
        uint256 amount
    );
    event OrderCancelled(
        address indexed user,
        address indexed market,
        uint256 indexed orderId,
        uint256 refund
    );
    event ProceedsLocked(address indexed user, uint256 amount, uint256 unlockTime);
    event ProceedsClaimed(address indexed user, uint256 amount);
    event SharesRedeemed(address indexed user, address indexed market, uint8 winningOutcome, uint256 shares);

    // ============ User Actions ============

    /// @notice Deposit USDC into the vault
    /// @param amount Amount of USDC to deposit
    function deposit(uint256 amount) external;

    /// @notice Withdraw available USDC from the vault
    /// @param amount Amount to withdraw (must be <= availableBalance)
    function withdraw(uint256 amount) external;

    /// @notice Claim unlocked proceeds (moves from pending to available)
    /// @return amount Total amount claimed
    function claimUnlocked() external returns (uint256 amount);

    // ============ Trading (Single Entry Point) ============

    /// @notice Execute a trade on the AMM
    /// @param market Address of the market
    /// @param outcome 0 = YES, 1 = NO
    /// @param deltaShares Positive to buy, negative to sell
    /// @param maxCost Maximum cost (buy) or minimum proceeds (sell)
    function tradeAMM(
        address market,
        uint8 outcome,
        int256 deltaShares,
        int256 maxCost
    ) external;

    /// @notice Place a limit order on the orderbook
    /// @param market Address of the market
    /// @param outcome 0 = YES, 1 = NO (which outcome you want to BUY)
    /// @param price Price per share (1e18 fixed point)
    /// @param amount Number of shares
    /// @return orderId The ID of the created order
    function placeOrder(
        address market,
        uint8 outcome,
        uint256 price,
        uint256 amount
    ) external returns (uint256 orderId);

    /// @notice Cancel an existing order
    /// @param market Address of the market
    /// @param orderId ID of the order to cancel
    function cancelOrder(address market, uint256 orderId) external;

    /// @notice Redeem winning shares after market settlement
    /// @param market Address of the settled market
    function redeem(address market) external;

    // ============ View Functions ============

    /// @notice Get user's available balance (can withdraw or trade)
    function availableBalance(address user) external view returns (uint256);

    /// @notice Get user's pending balance (locked, awaiting unlock)
    function pendingBalance(address user) external view returns (uint256);

    /// @notice Get user's total balance (available + pending)
    function totalBalance(address user) external view returns (uint256);

    /// @notice Get the underlying asset (USDC)
    function asset() external view returns (address);

    /// @notice Check if a market is whitelisted
    function isMarket(address market) external view returns (bool);

    // ============ Admin Functions ============

    /// @notice Whitelist or remove a market
    function setMarket(address market, bool enabled) external;

    /// @notice Set the yield strategy
    function setYieldStrategy(IYieldStrategy strategy) external;

    /// @notice Set the time-lock module
    function setTimeLock(ITimeLock timeLock) external;
}
