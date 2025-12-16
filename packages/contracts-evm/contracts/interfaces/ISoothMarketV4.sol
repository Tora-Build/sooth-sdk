// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../core/SoothInterfaces.sol";
import "./ISoothTraderVaultV4.sol";
import "./IOutcomeToken.sol";

/// @title ISoothMarketV4
/// @notice V4 Market interface - Continuous LMSR AMM with qYes/qNo state
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
        address _liquidityVault,
        address _traderVault,
        address _feeController,
        address _outcomeToken,
        bytes32 _adjudicatorId,
        uint256 _bBase,
        address _marketOperator,
        int256 _initialQYes,
        int256 _initialQNo
    ) external;

    function executeAMMTrade(
        address trader,
        uint8 outcome,
        int256 deltaShares
    ) external returns (int256 cost, uint256 fee);

    /// @notice Calculate AMM trade cost (V4: returns newQYes/newQNo instead of tick)
    function calculateAMMTradeCost(
        uint8 outcome,
        uint256 shares,
        bool isBuy
    ) external view returns (int256 cost, uint256 fee, int256 newQYes, int256 newQNo);

    function createOrder(
        address maker,
        uint8 outcome,
        uint256 price,
        uint256 amount
    ) external returns (
        uint256 orderId,
        uint256 matchedAmount,
        uint256 matchedValue
    );

    function cancelOrder(uint256 orderId, address maker) external returns (uint256 refund);

    // ============ View Functions ============

    function marketId() external view returns (uint256);
    function liquidityVault() external view returns (ISoothLiquidityVault);
    function traderVault() external view returns (address);
    function feeController() external view returns (ISoothFeeController);
    function feeLMSR() external view returns (uint256); // Added for Launchpad override visibility
    
    function bBase() external view returns (uint256);
    function isLive() external view returns (bool);
    function isSettled() external view returns (bool);
    function winningOutcome() external view returns (uint8);
    
    // Continuous LMSR state
    function qYes() external view returns (int256);
    function qNo() external view returns (int256);
    
    function price(uint8 outcome) external view returns (uint256 priceWad);
    function yesBalance(address user) external view returns (uint256);
    function noBalance(address user) external view returns (uint256);
    function outcomeToken() external view returns (IOutcomeToken);
    function merge(uint256 amount) external returns (uint256 proceeds);
    
    function nextOrderId() external view returns (uint256);
    function orders(uint256 orderId) external view returns (OrderV4 memory);
}
