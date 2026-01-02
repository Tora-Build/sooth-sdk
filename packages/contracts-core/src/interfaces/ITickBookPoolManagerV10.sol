// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ITickBookPoolManagerV10
 * @notice Interface for TickBookPoolManager V10 with (tick, user) primary indexing
 */
interface ITickBookPoolManagerV10 {
    // ============================================
    // Types
    // ============================================

    struct Market {
        address truthMarket;
        address yesToken;
        address noToken;
        bool isActive;
    }

    struct Position {
        uint128 shares;
        uint128 collateralDepositedWad;
        uint128 filledShares;
        uint128 collateralUsedWad;
        uint256 fillGrowthLastX128;
        uint256 collateralGrowthLastX128;
    }

    struct TickState {
        uint128 totalShares;
        uint256 fillGrowthX128;
        uint256 collateralGrowthX128;
    }

    struct PoolKey {
        address truthMarket;
        address yesToken;
        address noToken;
    }

    // ============================================
    // Events
    // ============================================

    event MarketRegistered(bytes32 indexed marketKey, address market, address yesToken, address noToken);
    event RegistrarChanged(address indexed oldRegistrar, address indexed newRegistrar);
    event FeeRecipientChanged(address indexed newFeeRecipient);
    event FeesUpdated(uint24 takerFee, uint24 makerFee);

    event OrderPlaced(
        address indexed owner,
        bytes32 indexed marketKey,
        uint8 outcome,
        uint16 tick,
        uint256 shares,
        uint256 filledShares,
        uint256 filledCost,
        uint256 restingShares
    );

    event OrderCancelled(
        address indexed owner,
        bytes32 indexed marketKey,
        uint8 outcome,
        uint16 tick,
        uint256 sharesRemoved,
        uint256 collateralReleased
    );

    event FillsClaimed(
        address indexed owner,
        bytes32 indexed marketKey,
        uint8 outcome,
        uint16 tick,
        uint256 filledShares,
        uint256 collateralUsedWad
    );

    event MarketOrderExecuted(
        address indexed taker,
        bytes32 indexed marketKey,
        uint8 outcome,
        uint256 sharesFilled,
        uint256 totalCost
    );

    // ============================================
    // Market Registration
    // ============================================

    function registerMarket(
        PoolKey calldata key,
        uint256 initialProbabilityWad
    ) external returns (bytes32 marketKey);

    function registerMarket(
        address market,
        address yesToken,
        address noToken,
        uint256 initialProbabilityWad,
        address hook
    ) external returns (bytes32 marketKey);

    // ============================================
    // Order Placement
    // ============================================

    /**
     * @notice Place an order - unified API for limit and market orders
     * @param marketKey The market identifier
     * @param outcome 0 = NO, 1 = YES
     * @param shares Total shares to place
     * @param tick Price tick (0 for market order, 1-999 for limit)
     * @param maxCost Maximum cost willing to pay
     * @return filledShares Shares filled immediately
     * @return filledCost Cost of immediately filled shares
     * @return restingShares Shares remaining as resting order
     */
    function placeOrder(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares,
        uint16 tick,
        uint256 maxCost
    ) external returns (
        uint256 filledShares,
        uint256 filledCost,
        uint256 restingShares
    );

    // ============================================
    // Cancel
    // ============================================

    function cancelOrder(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tick
    ) external returns (uint256 collateralReleased);

    // ============================================
    // Claims
    // ============================================

    function claimFills(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tick
    ) external returns (uint256 filledShares, uint256 collateralUsedWad);

    function claimAllFills(bytes32 marketKey)
        external
        returns (uint256 totalFilledShares, uint256 totalCollateralUsed);

    // ============================================
    // View Functions
    // ============================================

    function vault() external view returns (address);
    function registrar() external view returns (address);
    function feeRecipient() external view returns (address);
    function takerFeeBps() external view returns (uint24);
    function makerFeeBps() external view returns (uint24);

    function getMarket(bytes32 marketKey) external view returns (Market memory);

    function getPosition(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tick,
        address user
    ) external view returns (Position memory);

    function getTickState(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tick
    ) external view returns (TickState memory);

    function getUserTicks(
        bytes32 marketKey,
        uint8 outcome,
        address user
    ) external view returns (uint16[] memory);

    function getPendingFills(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tick,
        address user
    ) external view returns (uint256 pendingShares, uint256 pendingCollateralUsed);

    function getLiquidityAtTick(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tick
    ) external view returns (uint128);

    function getBestTick(
        bytes32 marketKey,
        uint8 outcome,
        bool isBid
    ) external view returns (uint16);

    // ============================================
    // Admin Functions
    // ============================================

    function setRegistrar(address _registrar) external;
    function setFeeRecipient(address _feeRecipient) external;
    function setFees(uint24 _takerFee, uint24 _makerFee) external;
}
