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
    function isMarket(address market) external view returns (bool);
    function asset() external view returns (address);

    // ============ Admin & Internal ============
    function setMarket(address market, bool enabled) external;
    function transferShares(address market, address to, uint8 outcome, uint256 amount) external;
    function creditMergeProceeds(address user, uint256 amount) external;
    
    /// @notice Place a Spot Sell order (uses owned shares as collateral)
    function placeSpotOrder(
        address market,
        uint8 outcome,
        uint256 price,
        uint256 amount
    ) external returns (uint256 orderId);

    /// @notice Callback from Market when a Vault-owned order is matched
    function onOrderMatched(
        uint256 orderId,
        uint256 matchedAmount
    ) external;
}
