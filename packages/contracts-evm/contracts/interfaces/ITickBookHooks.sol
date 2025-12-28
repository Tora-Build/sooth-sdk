// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITickBookHooks
 * @notice Hook interface for extending TickBook functionality (Uniswap V4 pattern)
 * @dev Hooks allow custom logic at key execution points:
 *      - Before/after order placement
 *      - Before/after order execution
 *      - Before/after order cancellation
 *      - Dynamic fee calculation
 *
 * Hook Permission Encoding:
 * Following Uniswap V4, hook permissions are encoded in the contract address.
 * The last 14 bits of the address indicate which hooks are enabled.
 * This eliminates storage reads for permission checks.
 *
 * Permission Bits:
 * Bit 0:  beforePlaceOrder
 * Bit 1:  afterPlaceOrder
 * Bit 2:  beforeExecuteOrder
 * Bit 3:  afterExecuteOrder
 * Bit 4:  beforeCancelOrder
 * Bit 5:  afterCancelOrder
 * Bit 6:  beforeCross
 * Bit 7:  afterCross
 * Bit 8:  getDynamicFee
 * Bit 9:  beforeClaim
 * Bit 10: afterClaim
 * Bit 11: beforeSpotSell
 * Bit 12: afterSpotSell
 * Bit 13: (reserved)
 */
interface ITickBookHooks {
    // ============================================
    // Structs
    // ============================================

    struct PlaceOrderParams {
        bytes32 marketKey;
        address sender;
        uint8 outcome;
        uint16 tickLower;
        uint16 tickUpper;
        uint256 sharesTotal;
    }

    struct ExecuteOrderParams {
        bytes32 marketKey;
        address sender;
        uint8 outcome;
        uint256 shares;
        uint256 maxCost;
    }

    struct CancelOrderParams {
        bytes32 marketKey;
        address sender;
        uint256 orderId;
    }

    struct CrossParams {
        bytes32 marketKey;
        uint256 newOrderId;
        uint256 crossedShares;
        uint16 crossTick;
    }

    struct ClaimParams {
        bytes32 marketKey;
        address sender;
        uint256 orderId;
        uint256 filledShares;
    }

    struct SpotSellParams {
        bytes32 marketKey;
        address sender;
        uint8 outcome;
        uint256 shares;
        uint256 minProceeds;
    }

    // ============================================
    // Order Placement Hooks
    // ============================================

    /**
     * @notice Called before a range order is placed
     * @param params Order parameters
     * @return selector Must return this function's selector to proceed
     * @return hookData Data to pass to afterPlaceOrder
     */
    function beforePlaceOrder(PlaceOrderParams calldata params)
        external
        returns (bytes4 selector, bytes memory hookData);

    /**
     * @notice Called after a range order is placed
     * @param params Order parameters
     * @param orderId The created order ID
     * @param hookData Data from beforePlaceOrder
     */
    function afterPlaceOrder(
        PlaceOrderParams calldata params,
        uint256 orderId,
        bytes memory hookData
    ) external;

    // ============================================
    // Order Execution Hooks
    // ============================================

    /**
     * @notice Called before a market order is executed
     * @param params Order parameters
     * @return selector Must return this function's selector to proceed
     * @return hookData Data to pass to afterExecuteOrder
     */
    function beforeExecuteOrder(ExecuteOrderParams calldata params)
        external
        returns (bytes4 selector, bytes memory hookData);

    /**
     * @notice Called after a market order is executed
     * @param params Order parameters
     * @param sharesFilled Actual shares filled
     * @param totalCost Total cost paid
     * @param hookData Data from beforeExecuteOrder
     */
    function afterExecuteOrder(
        ExecuteOrderParams calldata params,
        uint256 sharesFilled,
        uint256 totalCost,
        bytes memory hookData
    ) external;

    // ============================================
    // Order Cancellation Hooks
    // ============================================

    /**
     * @notice Called before an order is cancelled
     * @param params Cancel parameters
     * @return selector Must return this function's selector to proceed
     */
    function beforeCancelOrder(CancelOrderParams calldata params)
        external
        returns (bytes4 selector);

    /**
     * @notice Called after an order is cancelled
     * @param params Cancel parameters
     * @param collateralReleased Amount of collateral released
     */
    function afterCancelOrder(CancelOrderParams calldata params, uint256 collateralReleased)
        external;

    // ============================================
    // Crossing Hooks
    // ============================================

    /**
     * @notice Called before orders cross
     * @param params Cross parameters
     * @return selector Must return this function's selector to proceed
     */
    function beforeCross(CrossParams calldata params) external returns (bytes4 selector);

    /**
     * @notice Called after orders cross
     * @param params Cross parameters
     * @param newOrderCost Cost to new order
     * @param oppositeOrderCost Cost to opposite orders
     */
    function afterCross(
        CrossParams calldata params,
        uint256 newOrderCost,
        uint256 oppositeOrderCost
    ) external;

    // ============================================
    // Claim Hooks
    // ============================================

    /**
     * @notice Called before fills are claimed
     * @param params Claim parameters
     * @return selector Must return this function's selector to proceed
     */
    function beforeClaim(ClaimParams calldata params) external returns (bytes4 selector);

    /**
     * @notice Called after fills are claimed
     * @param params Claim parameters
     * @param collateralUsed Collateral used in fills
     */
    function afterClaim(ClaimParams calldata params, uint256 collateralUsed) external;

    // ============================================
    // Spot Sell Hooks
    // ============================================

    /**
     * @notice Called before spot sell
     * @param params Spot sell parameters
     * @return selector Must return this function's selector to proceed
     */
    function beforeSpotSell(SpotSellParams calldata params) external returns (bytes4 selector);

    /**
     * @notice Called after spot sell
     * @param params Spot sell parameters
     * @param sharesSold Actual shares sold
     * @param proceeds USDC received
     */
    function afterSpotSell(
        SpotSellParams calldata params,
        uint256 sharesSold,
        uint256 proceeds
    ) external;

    // ============================================
    // Dynamic Fee Hook
    // ============================================

    /**
     * @notice Calculate dynamic fee for an order
     * @dev Can implement time-weighted fees, volume-based fees, etc.
     * @param marketKey The market
     * @param outcome The outcome being traded
     * @param shares Number of shares
     * @param baseFee The default fee (in basis points)
     * @return fee The actual fee to charge (in basis points)
     */
    function getDynamicFee(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares,
        uint24 baseFee
    ) external view returns (uint24 fee);
}

/**
 * @title HookPermissions
 * @notice Library for checking hook permissions from address
 */
library HookPermissions {
    uint256 constant BEFORE_PLACE_ORDER_FLAG = 1 << 0;
    uint256 constant AFTER_PLACE_ORDER_FLAG = 1 << 1;
    uint256 constant BEFORE_EXECUTE_ORDER_FLAG = 1 << 2;
    uint256 constant AFTER_EXECUTE_ORDER_FLAG = 1 << 3;
    uint256 constant BEFORE_CANCEL_ORDER_FLAG = 1 << 4;
    uint256 constant AFTER_CANCEL_ORDER_FLAG = 1 << 5;
    uint256 constant BEFORE_CROSS_FLAG = 1 << 6;
    uint256 constant AFTER_CROSS_FLAG = 1 << 7;
    uint256 constant GET_DYNAMIC_FEE_FLAG = 1 << 8;
    uint256 constant BEFORE_CLAIM_FLAG = 1 << 9;
    uint256 constant AFTER_CLAIM_FLAG = 1 << 10;
    uint256 constant BEFORE_SPOT_SELL_FLAG = 1 << 11;
    uint256 constant AFTER_SPOT_SELL_FLAG = 1 << 12;

    function hasPermission(address hook, uint256 flag) internal pure returns (bool) {
        return uint256(uint160(hook)) & flag != 0;
    }

    function beforePlaceOrder(address hook) internal pure returns (bool) {
        return hasPermission(hook, BEFORE_PLACE_ORDER_FLAG);
    }

    function afterPlaceOrder(address hook) internal pure returns (bool) {
        return hasPermission(hook, AFTER_PLACE_ORDER_FLAG);
    }

    function beforeExecuteOrder(address hook) internal pure returns (bool) {
        return hasPermission(hook, BEFORE_EXECUTE_ORDER_FLAG);
    }

    function afterExecuteOrder(address hook) internal pure returns (bool) {
        return hasPermission(hook, AFTER_EXECUTE_ORDER_FLAG);
    }

    function beforeCancelOrder(address hook) internal pure returns (bool) {
        return hasPermission(hook, BEFORE_CANCEL_ORDER_FLAG);
    }

    function afterCancelOrder(address hook) internal pure returns (bool) {
        return hasPermission(hook, AFTER_CANCEL_ORDER_FLAG);
    }

    function beforeCross(address hook) internal pure returns (bool) {
        return hasPermission(hook, BEFORE_CROSS_FLAG);
    }

    function afterCross(address hook) internal pure returns (bool) {
        return hasPermission(hook, AFTER_CROSS_FLAG);
    }

    function getDynamicFee(address hook) internal pure returns (bool) {
        return hasPermission(hook, GET_DYNAMIC_FEE_FLAG);
    }

    function beforeClaim(address hook) internal pure returns (bool) {
        return hasPermission(hook, BEFORE_CLAIM_FLAG);
    }

    function afterClaim(address hook) internal pure returns (bool) {
        return hasPermission(hook, AFTER_CLAIM_FLAG);
    }

    function beforeSpotSell(address hook) internal pure returns (bool) {
        return hasPermission(hook, BEFORE_SPOT_SELL_FLAG);
    }

    function afterSpotSell(address hook) internal pure returns (bool) {
        return hasPermission(hook, AFTER_SPOT_SELL_FLAG);
    }
}
