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

    event Swap(
        address indexed user,
        bytes32 indexed marketKey,
        bool isBuy,
        uint256 amountIn,
        uint256 amountOut,
        uint16 startTick,
        uint16 endTick,
        uint256 feeAmount
    );

    event LiquidityAdded(
        address indexed provider,
        bytes32 indexed marketKey,
        uint16 tickIndex,
        uint256 amount
    );

    event LiquidityRemoved(
        address indexed provider,
        bytes32 indexed marketKey,
        uint16 tickIndex,
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
     * @notice Execute swap in token domain
     * @dev Walks ticks until amountIn is consumed or limitTick is reached
     * @param marketKey Unique market identifier
     * @param isBuy true = buy YES, false = sell YES
     * @param amountIn Input token amount (WAD)
     * @param limitTick Maximum/minimum tick to execute
     * @return amountOut Output token amount (WAD)
     */
    function swap(
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
    // Liquidity Management
    // ============================================

    /**
     * @notice Add concentrated liquidity at specific tick
     * @dev Requires equal amounts of YES and NO tokens
     * @param marketKey Market identifier
     * @param tickIndex Tick to provide liquidity (0-9999)
     * @param amount Liquidity amount (in YES+NO pairs, WAD)
     */
    function addLiquidity(
        bytes32 marketKey,
        uint16 tickIndex,
        uint256 amount
    ) external;

    /**
     * @notice Remove liquidity from tick
     * @param marketKey Market identifier
     * @param tickIndex Tick to remove liquidity from
     * @param amount Liquidity amount to remove (WAD)
     * @return yesAmount YES tokens returned
     * @return noAmount NO tokens returned
     */
    function removeLiquidity(
        bytes32 marketKey,
        uint16 tickIndex,
        uint256 amount
    ) external returns (uint256 yesAmount, uint256 noAmount);

    /**
     * @notice Get user's liquidity position at tick
     * @param marketKey Market identifier
     * @param tickIndex Tick index
     * @param provider LP address
     * @return liquidity User's liquidity amount (WAD)
     */
    function getUserLiquidity(
        bytes32 marketKey,
        uint16 tickIndex,
        address provider
    ) external view returns (uint256 liquidity);

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
