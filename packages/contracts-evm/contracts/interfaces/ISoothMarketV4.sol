// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../core/SoothInterfaces.sol";

/// @title ISoothMarketV4
/// @notice V4 Market interface - AMM engine without ERC1155
interface ISoothMarketV4 {
    // ============ Structs ============

    /// @notice Unified order - normalized to YES price
    struct OrderV4 {
        address maker;
        uint8 outcome;
        uint256 yesPrice;
        uint256 amount;
        bool isBuySide;
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
    
    event OrderCancelled(
        uint256 indexed orderId,
        address indexed maker,
        uint256 refund
    );
    
    event TradeAMM(
        address indexed trader,
        uint8 outcome,
        int256 deltaShares,
        int256 cost,
        uint256 fee
    );

    event Merged(address indexed user, uint256 amount);

    // ============ Core Functions ============

    function initialize(
        uint256 _marketId,
        address _governorVault,
        address _traderVault,
        address _feeController,
        address _outcomeToken,
        bytes32 _adjudicatorId,
        uint256 _bBase,
        address _governor,
        uint16 _initialTick
    ) external;

    function executeAMMTrade(
        address trader,
        uint8 outcome,
        int256 deltaShares
    ) external returns (int256 cost, uint256 fee);

    function calculateAMMTradeCost(
        uint8 outcome,
        uint256 shares,
        bool isBuy
    ) external view returns (int256 cost, uint256 fee, uint16 newTick);

    function createOrder(
        address maker,
        uint8 outcome,
        uint256 price,
        uint256 amount
    ) external returns (uint256 orderId);

    function cancelOrder(
        uint256 orderId,
        address maker
    ) external returns (uint256 refund);

    // ============ View Functions ============

    function marketId() external view returns (uint256);
    function currentTick() external view returns (uint16);
    function bBase() external view returns (uint256);
    function b() external view returns (uint256);
    function price(uint8 outcome) external view returns (uint256);
    function isLive() external view returns (bool);
    function isSettled() external view returns (bool);
    function winningOutcome() external view returns (uint8);
    function orders(uint256 orderId) external view returns (OrderV4 memory);
    function bestOrder(uint256 outcome) external view returns (uint256);
    function yesBalance(address user) external view returns (uint256);
    function noBalance(address user) external view returns (uint256);

    // ============ Governor Functions ============

    function settle(uint8 _winningOutcome) external;
    function increaseBBase(uint256 amount) external;
}
