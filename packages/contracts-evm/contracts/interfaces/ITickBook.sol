// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITickBook
 * @notice Interface for Continuous Linear Tick orderbook venue
 * @dev Vault-native venue with 1,000 probability ticks (0.1% precision)
 */
interface ITickBook {
    // ============================================
    // Events
    // ============================================

    event RangeOrderPlaced(
        address indexed maker,
        bytes32 indexed marketKey,
        uint8 indexed outcome, // 0 = NO, 1 = YES
        uint16 tickLower,
        uint16 tickUpper,
        uint256 sharesPerTick,
        uint256 totalReservedUsdcWad,
        uint256 firstOrderId,
        uint256 orderCount
    );

    event OrderCancelled(
        address indexed maker,
        bytes32 indexed marketKey,
        uint256 indexed orderId,
        uint8 outcome,
        uint16 tick,
        uint256 remainingShares,
        uint256 collateralReleasedUsdcWad
    );

    event MarketOrderExecuted(
        address indexed taker,
        bytes32 indexed marketKey,
        uint8 indexed outcome, // 0 = NO, 1 = YES
        uint256 sharesRequested,
        uint256 sharesFilled,
        uint16 startTick,
        uint16 endTick
    );

    // ============================================
    // Structs
    // ============================================

    struct TickData {
        uint128 yesDepth; // Remaining YES orders (shares) at this tick (WAD)
        uint128 noDepth;  // Remaining NO orders (shares) at this tick (WAD)
    }

    struct QuoteResult {
        uint256 sharesFillable;      // shares that would fill (WAD)
        uint256 takerCollateralWad;  // USDC WAD required from taker
        uint16 finalTick;            // last tick touched
    }

    struct OrderView {
        address owner;
        uint8 outcome;       // 0 = NO, 1 = YES
        uint16 tick;         // YES probability tick (1..MAX_TICK-1)
        uint256 remaining;   // remaining shares (WAD)
        bool active;
    }

    // ============================================
    // Trading
    // ============================================

    /// @notice Execute a market order (immediate fill) funded by TickBookVault USDC.
    /// @param outcome 0 = buy NO, 1 = buy YES
    /// @param shares Shares to buy (WAD)
    /// @param limitTick Price limit in YES-tick space (1..MAX_TICK-1). For YES buys: max tick. For NO buys: min tick.
    /// @return sharesFilled Shares filled (WAD)
    /// @return finalTick Last tick touched
    function executeMarketOrder(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares,
        uint16 limitTick
    ) external returns (uint256 sharesFilled, uint16 finalTick);

    /// @notice Quote a market order without executing (view-only).
    function getQuote(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares,
        uint16 limitTick
    ) external view returns (QuoteResult memory result);

    // ============================================
    // Maker Order Management
    // ============================================

    /// @notice Place a vault-native limit order across a tick range (creates 1 order per tick).
    /// @dev `sharesPerTick` is the per-tick size (same semantics as prior TickBook range liquidity).
    function placeLimitOrder(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 sharesPerTick
    ) external returns (uint256 firstOrderId, uint256 orderCount);

    /// @notice Cancel a single resting order by id (releases remaining collateral in the vault).
    function cancelOrder(bytes32 marketKey, uint256 orderId)
        external
        returns (uint256 remainingShares, uint256 collateralReleasedUsdcWad);

    /// @notice Get an order view by id.
    function getOrder(bytes32 marketKey, uint256 orderId) external view returns (OrderView memory o);

    /// @notice Get all order ids created by a user for a market (alpha convenience).
    function getUserOrders(bytes32 marketKey, address user) external view returns (uint256[] memory orderIds);

    // ============================================
    // Market State
    // ============================================

    /**
     * @notice Get tick data
     * @param marketKey Market identifier
     * @param tickIndex Tick index (1..MAX_TICK-1)
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
     * @param isUp true = search upward, false = search downward
     * @param outcome 0 = NO book, 1 = YES book
     * @return nextTick Next tick with liquidity (returns MAX_TICK+1 if none)
     */
    function findNextActiveTick(
        bytes32 marketKey,
        uint16 startTick,
        bool isUp,
        uint8 outcome
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
        address noToken,
        uint256 initialProbabilityWad
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
