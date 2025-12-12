// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

/// @title ISoothTraderVaultV4
/// @notice Interface for SoothTraderVaultV4
interface ISoothTraderVaultV4 {
    // ============ Events ============
    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);
    event TradeExecuted(address indexed user, address indexed market, uint8 outcome, int256 deltaShares, int256 cost);
    event OrderPlaced(address indexed user, address indexed market, uint256 orderId, uint8 outcome, uint256 price, uint256 amount);
    event OrderCancelled(address indexed user, address indexed market, uint256 orderId, uint256 refund);
    event ProceedsClaimed(address indexed user, uint256 amount);
    event MergeCredit(address indexed user, uint256 amount);
    event SharesRedeemed(address indexed user, address indexed market, uint8 winningOutcome, uint256 shares);
    event AMMBuy(address indexed user, address indexed market, uint8 outcome, uint256 shares, uint256 cost, uint256 unlockTime);
    event AMMSell(address indexed user, address indexed market, uint8 outcome, uint256 shares, uint256 proceeds);
    event Locked(address indexed user, uint256 amount, uint64 unlockTime);
    event Unlocked(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 amount);

    // ============ User Actions ============
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;

    // ============ Trading ============
    function tradeAMM(address market, uint8 outcome, int256 deltaShares, int256 maxCost) external;

    function placeOrder(
        address market,
        uint8 outcome,
        uint256 price,
        uint256 amount,
        bool isBuy
    ) external returns (uint256 orderId);

    function cancelOrder(address market, uint256 orderId) external;
    function redeem(address market) external;

    // ============ View Functions ============
    function availableBalance(address user) external view returns (uint256);
    function totalBalance(address user) external view returns (uint256);
    function lockedBalance(address user) external view returns (uint256);
    function claimableBalance(address user) external view returns (uint256);
    function getLockEntries(address user) external view returns (uint256[] memory amounts, uint64[] memory unlockTimes);
    function nextUnlock(address user) external view returns (uint256 amount, uint64 unlockTime);
    function isMarket(address market) external view returns (bool);
    function asset() external view returns (address);

    // ============ Admin & Internal ============
    function setMarket(address market, bool enabled) external;
    function setOutcomeToken(address token, bool enabled) external;
    function transferShares(address market, address to, uint8 outcome, uint256 amount) external;
    function creditMergeProceeds(address user, uint256 amount) external;
    function isOutcomeToken(address token) external view returns (bool);
    
    /// @notice Place a Spot Sell order (uses owned shares as collateral)
    function placeSpotOrder(
        address market,
        uint8 outcome,
        uint256 price,
        uint256 amount
    ) external returns (uint256 orderId);

    /// @notice Execute atomic Hybrid Sell (Spot Sell available shares + Short Sell remainder)
    function executeHybridSell(
        address market,
        uint8 outcome,
        uint256 price,
        uint256 totalAmount
    ) external;

    /// @notice Callback from Market when an order is matched
    /// @param orderId The ID of the order that was matched
    /// @param matchedAmount The amount of shares matched
    /// @param matchedValue The total value (price * amount) of the match in WAD
    function onOrderMatched(uint256 orderId, uint256 matchedAmount, uint256 matchedValue) external;
}
