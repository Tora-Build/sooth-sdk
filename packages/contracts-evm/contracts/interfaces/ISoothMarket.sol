// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../core/SoothInterfaces.sol";
import "./ISoothTraderVault.sol";
import "./IYieldStrategy.sol";
import "./ITimeLock.sol";

/// @title ISoothMarket
/// @notice Market interface with unified orderbook (Sell YES = Buy NO)
/// @dev Called by TraderVault only - users don't interact directly
interface ISoothMarket {
    // ============ Structs ============

    /// @notice Unified order - always normalized to YES price internally
    struct OrderV3 {
        uint256 id;
        address maker;
        uint256 yesPrice;    // Always stored as YES price (0-1e18)
        uint256 amount;      // Remaining shares
        uint256 timestamp;
        bool isBuySide;      // true = wants YES, false = wants NO
    }

    // ============ Events ============

    event OrderCreated(
        uint256 indexed orderId,
        address indexed maker,
        uint8 outcome,
        uint256 price,
        uint256 amount
    );
    event OrderMatched(
        uint256 indexed buyOrderId,
        uint256 indexed sellOrderId,
        uint256 amount,
        uint256 yesPrice
    );
    event OrderCancelled(uint256 indexed orderId);
    event TradeAMM(
        address indexed trader,
        uint8 outcome,
        int256 deltaShares,
        int256 cost,
        uint256 fee
    );

    // ============ TraderVault Callbacks ============

    /// @notice Create an order on behalf of a user (called by TraderVault only)
    /// @param maker The user placing the order
    /// @param outcome 0 = YES, 1 = NO (which outcome maker wants)
    /// @param price Price per share (1e18 fixed point)
    /// @param amount Number of shares
    /// @return orderId The ID of the created order
    function createOrder(
        address maker,
        uint8 outcome,
        uint256 price,
        uint256 amount
    ) external returns (uint256 orderId);

    /// @notice Cancel an order (called by TraderVault only)
    /// @param orderId The order ID
    /// @param maker The original maker (for validation)
    /// @return refund Amount refunded to maker
    function cancelOrder(uint256 orderId, address maker) external returns (uint256 refund);

    /// @notice Execute AMM trade (called by TraderVault only)
    /// @param trader The user trading
    /// @param outcome 0 = YES, 1 = NO
    /// @param deltaShares Positive to buy, negative to sell
    /// @return cost The cost (positive) or proceeds (negative)
    /// @return fee The fee charged
    function executeAMMTrade(
        address trader,
        uint8 outcome,
        int256 deltaShares
    ) external returns (int256 cost, uint256 fee);

    // ============ View Functions ============

    /// @notice Get an order by ID
    function orders(uint256 orderId) external view returns (OrderV3 memory);

    /// @notice Get the best ask (lowest yesPrice for YES buyers)
    function bestAsk() external view returns (uint256 orderId);

    /// @notice Get the best bid (highest yesPrice for NO buyers)
    function bestBid() external view returns (uint256 orderId);

    /// @notice Get current AMM price for an outcome
    function getPrice(uint8 outcome) external view returns (uint256);

    /// @notice Get the market ID
    function marketId() external view returns (uint256);

    /// @notice Get user's token balance
    function yesBalance(address user) external view returns (uint256);
    function noBalance(address user) external view returns (uint256);

    /// @notice Check if market is live
    function isLive() external view returns (bool);

    /// @notice Check if market is settled
    function isSettled() external view returns (bool);

    /// @notice Get the winning outcome (only valid after settlement)
    function winningOutcome() external view returns (uint8);

    /// @notice Get the TraderVault address
    function traderVault() external view returns (address);
}
