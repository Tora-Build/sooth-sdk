// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITickBook
 * @notice Interface for Continuous Linear Tick orderbook venue
 * @dev Token-based venue with 10,000 probability ticks (1bp precision)
 */
interface ITickBook {
    // ============================================
    // Events
    // ============================================

    event MarketOrderExecuted(
        address indexed user,
        bytes32 indexed marketKey,
        bool isBuy,
        uint256 amountIn,
        uint256 amountOut,
        uint16 startTick,
        uint16 endTick,
        uint256 feeAmount
    );

    event LimitOrderPlaced(
        address indexed maker,
        bytes32 indexed marketKey,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 amount,
        uint256 yesAmount,
        uint256 noAmount
    );

    event LimitOrderCancelled(
        address indexed maker,
        bytes32 indexed marketKey,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 amount,
        uint256 yesAmount,
        uint256 noAmount
    );

    // ============================================
    // Structs
    // ============================================

    struct TickData {
        uint128 liquidityYES;  // YES token liquidity at this tick
        uint128 liquidityNO;   // NO token liquidity at this tick
    }

    struct SwapResult {
        uint256 amountOut;     // Output token amount
        uint16 finalTick;      // Final tick after swap
        uint256 feeAmount;     // Total fee charged
    }

    // ============================================
    // Trading
    // ============================================

    /**
     * @notice Execute a market order (immediate fill)
     * @dev Walks ticks until amountIn is consumed or limitTick is reached
     * @param marketKey Unique market identifier
     * @param isBuy true = buy YES, false = sell YES
     * @param amountIn Input token amount (WAD)
     * @param limitTick Maximum/minimum tick to execute
     * @return amountOut Output token amount (WAD)
     */
    function executeMarketOrder(
        bytes32 marketKey,
        bool isBuy,
        uint256 amountIn,
        uint16 limitTick
    ) external returns (uint256 amountOut);

    /**
     * @notice Get quote for swap (view-only)
     * @param marketKey Market identifier
     * @param isBuy true = buy YES, false = sell YES
     * @param amountIn Input token amount (WAD)
     * @param limitTick Maximum/minimum tick to execute
     * @return result Swap result with amountOut, finalTick, and feeAmount
     */
    function getQuote(
        bytes32 marketKey,
        bool isBuy,
        uint256 amountIn,
        uint16 limitTick
    ) external view returns (SwapResult memory result);

    // ============================================
    // Maker Order Management
    // ============================================

    /**
     * @notice Place a limit order across a range of ticks
     * @dev Automatically calculates YES/NO requirements based on current tick.
     *      Range can be a single tick (tickLower == tickUpper).
     * @param marketKey Market identifier
     * @param tickLower Lower tick of the range
     * @param tickUpper Upper tick of the range
     * @param amount Order amount (WAD)
     * @return yesAmount YES tokens transferred from maker
     * @return noAmount NO tokens transferred from maker
     */
    function placeLimitOrder(
        bytes32 marketKey,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 amount
    ) external returns (uint256 yesAmount, uint256 noAmount);

    /**
     * @notice Cancel a limit order and withdraw remaining tokens
     * @param marketKey Market identifier
     * @param tickLower Lower tick
     * @param tickUpper Upper tick
     * @param amount Amount to cancel (WAD)
     * @return yesAmount YES tokens returned
     * @return noAmount NO tokens returned
     */
    function cancelLimitOrder(
        bytes32 marketKey,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 amount
    ) external returns (uint256 yesAmount, uint256 noAmount);

    /**
     * @notice Get maker's active order size in a range
     * @param marketKey Market identifier
     * @param tickLower Lower tick
     * @param tickUpper Upper tick
     * @param maker Maker address
     * @return amount Active order amount (WAD)
     */
    function getLimitOrder(
        bytes32 marketKey,
        uint16 tickLower,
        uint16 tickUpper,
        address maker
    ) external view returns (uint256 amount);

    // ============================================
    // Market State
    // ============================================

    /**
     * @notice Get tick data
     * @param marketKey Market identifier
     * @param tickIndex Tick index (0-9999)
     * @return data Tick liquidity data
     */
    function getTick(bytes32 marketKey, uint16 tickIndex)
        external
        view
        returns (TickData memory data);

    /**
     * @notice Get current mid-market tick
     * @param marketKey Market identifier
     * @return tickIndex Current tick index
     * @return probability Implied probability at this tick (WAD, 0-1e18)
     */
    function getCurrentTick(bytes32 marketKey)
        external
        view
        returns (uint16 tickIndex, uint256 probability);

    /**
     * @notice Find next active tick in direction
     * @dev Uses bitmap for O(1) lookup
     * @param marketKey Market identifier
     * @param startTick Starting tick
     * @param isBuy true = search upward, false = search downward
     * @return nextTick Next tick with liquidity (returns 0 if none)
     */
    function findNextActiveTick(
        bytes32 marketKey,
        uint16 startTick,
        bool isBuy
    ) external view returns (uint16 nextTick);

    // ============================================
    // Market Registration
    // ============================================

    /**
     * @notice Register a new market
     * @dev Only callable by market creator or authorized operator
     * @param market Market address (must implement ITruthMarket)
     * @param yesToken YES outcome token address
     * @param noToken NO outcome token address
     * @return marketKey Unique market identifier
     */
    function registerMarket(
        address market,
        address yesToken,
        address noToken
    ) external returns (bytes32 marketKey);

    /**
     * @notice Get market registration info
     * @param marketKey Market identifier
     * @return market Truth market address
     * @return yesToken YES token address
     * @return noToken NO token address
     * @return isActive Whether market is active
     */
    function getMarketInfo(bytes32 marketKey)
        external
        view
        returns (
            address market,
            address yesToken,
            address noToken,
            bool isActive
        );

    // ============================================
    // Fee Management
    // ============================================

    /**
     * @notice Get accumulated fees for recipient
     * @param marketKey Market identifier
     * @param recipient Fee recipient address
     * @return amount Accumulated fees (WAD)
     */
    function getAccruedFees(bytes32 marketKey, address recipient)
        external
        view
        returns (uint256 amount);

    /**
     * @notice Claim accumulated fees
     * @param marketKey Market identifier
     * @return amount Fees claimed (WAD)
     */
    function claimFees(bytes32 marketKey) external returns (uint256 amount);
}
