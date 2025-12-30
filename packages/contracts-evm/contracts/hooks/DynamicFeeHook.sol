// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ITickBookHooks} from "../interfaces/ITickBookHooks.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title DynamicFeeHook
 * @notice Hook implementation for dynamic fee adjustment based on market conditions
 * @dev Implements getDynamicFee hook to adjust fees based on:
 *      - Volume: Higher volume = lower fees (rewards liquidity)
 *      - Volatility: Higher volatility = higher fees (protects makers)
 *      - Time: Fees increase near market resolution
 *
 * Hook Permission Address:
 * This contract must be deployed at an address where:
 *   uint256(address) & (1 << 8) != 0  (GET_DYNAMIC_FEE_FLAG)
 *
 * Use CREATE2 with salt mining to achieve the correct address bits.
 */
contract DynamicFeeHook is ITickBookHooks, Ownable {
    // ============================================
    // Constants
    // ============================================

    uint24 public constant MIN_FEE = 1;      // 0.01%
    uint24 public constant MAX_FEE = 1000;   // 10%
    uint24 public constant DEFAULT_FEE = 10; // 0.1%

    // ============================================
    // State
    // ============================================

    /// @notice Fee configuration per market
    struct FeeConfig {
        uint24 baseFee;           // Base fee in bps
        uint24 maxFee;            // Maximum fee in bps
        uint24 volumeDiscount;    // Discount per 1000 USDC volume (in bps)
        uint24 volatilityPremium; // Premium per 1% price move (in bps)
        uint256 windowStart;      // Start of tracking window
        uint256 windowVolume;     // Volume in current window
        uint16 lastTick;          // Last known tick (for volatility)
        uint16 tickMovement;      // Tick movement in window
    }

    mapping(bytes32 => FeeConfig) public feeConfigs;

    // Volume tracking (per market, per time window)
    uint256 public constant VOLUME_WINDOW = 1 hours;

    // ============================================
    // Events
    // ============================================

    event FeeConfigUpdated(bytes32 indexed marketKey, uint24 baseFee, uint24 maxFee);
    event FeeCharged(bytes32 indexed marketKey, uint256 shares, uint24 fee);

    // ============================================
    // Constructor
    // ============================================

    constructor() Ownable(msg.sender) {}

    // ============================================
    // Admin Functions
    // ============================================

    function setFeeConfig(
        bytes32 marketKey,
        uint24 baseFee,
        uint24 maxFee,
        uint24 volumeDiscount,
        uint24 volatilityPremium
    ) external onlyOwner {
        require(baseFee >= MIN_FEE && baseFee <= MAX_FEE, "Invalid base fee");
        require(maxFee >= baseFee && maxFee <= MAX_FEE, "Invalid max fee");

        feeConfigs[marketKey] = FeeConfig({
            baseFee: baseFee,
            maxFee: maxFee,
            volumeDiscount: volumeDiscount,
            volatilityPremium: volatilityPremium,
            windowStart: block.timestamp,
            windowVolume: 0,
            lastTick: 500, // 50% default
            tickMovement: 0
        });

        emit FeeConfigUpdated(marketKey, baseFee, maxFee);
    }

    // ============================================
    // Dynamic Fee Calculation
    // ============================================

    /**
     * @notice Calculate dynamic fee based on market conditions
     * @param marketKey The market
     * @param outcome The outcome being traded
     * @param shares Number of shares
     * @param baseFee Default fee from protocol
     * @return fee Adjusted fee in basis points
     */
    function getDynamicFee(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares,
        uint24 baseFee
    ) external view override returns (uint24 fee) {
        FeeConfig storage config = feeConfigs[marketKey];

        // Use config base fee if set, otherwise use passed baseFee
        uint24 effectiveBase = config.baseFee > 0 ? config.baseFee : baseFee;

        // Calculate volume discount
        // More volume in window = lower fee (rewards active markets)
        uint256 volumeInWindow = config.windowVolume;
        uint256 discount = (volumeInWindow / 1000e18) * config.volumeDiscount;
        if (discount > effectiveBase - MIN_FEE) {
            discount = effectiveBase - MIN_FEE;
        }

        // Calculate volatility premium
        // More tick movement = higher fee (protects makers)
        uint256 premium = uint256(config.tickMovement) * config.volatilityPremium / 100;

        // Combine
        fee = effectiveBase;
        if (discount > 0) {
            fee -= uint24(discount);
        }
        if (premium > 0) {
            fee += uint24(premium);
        }

        // Clamp to bounds
        if (fee < MIN_FEE) fee = MIN_FEE;
        if (fee > config.maxFee && config.maxFee > 0) fee = config.maxFee;
        if (fee > MAX_FEE) fee = MAX_FEE;

        // Suppress unused parameter warning
        (outcome, shares, marketKey);
    }

    // ============================================
    // Volume & Volatility Tracking
    // ============================================

    /**
     * @notice Update volume tracking after a trade
     * @dev Called by afterExecuteOrder hook
     */
    function _updateVolumeTracking(bytes32 marketKey, uint256 volume) internal {
        FeeConfig storage config = feeConfigs[marketKey];

        // Reset window if expired
        if (block.timestamp > config.windowStart + VOLUME_WINDOW) {
            config.windowStart = block.timestamp;
            config.windowVolume = 0;
            config.tickMovement = 0;
        }

        config.windowVolume += volume;
    }

    /**
     * @notice Update volatility tracking
     * @dev Called after tick changes
     */
    function _updateVolatilityTracking(bytes32 marketKey, uint16 newTick) internal {
        FeeConfig storage config = feeConfigs[marketKey];

        // Reset window if expired
        if (block.timestamp > config.windowStart + VOLUME_WINDOW) {
            config.windowStart = block.timestamp;
            config.windowVolume = 0;
            config.tickMovement = 0;
            config.lastTick = newTick;
            return;
        }

        // Calculate tick movement
        uint16 movement = newTick > config.lastTick
            ? newTick - config.lastTick
            : config.lastTick - newTick;

        config.tickMovement += movement;
        config.lastTick = newTick;
    }

    // ============================================
    // Hook Implementations (Stubs for permissions)
    // ============================================

    function beforePlaceOrder(PlaceOrderParams calldata)
        external
        pure
        override
        returns (bytes4, bytes memory)
    {
        return (ITickBookHooks.beforePlaceOrder.selector, "");
    }

    function afterPlaceOrder(PlaceOrderParams calldata, uint256, bytes memory)
        external
        pure
        override
    {
        // No-op
    }

    function beforeExecuteOrder(ExecuteOrderParams calldata)
        external
        pure
        override
        returns (bytes4, bytes memory)
    {
        return (ITickBookHooks.beforeExecuteOrder.selector, "");
    }

    function afterExecuteOrder(
        ExecuteOrderParams calldata params,
        uint256 sharesFilled,
        uint256 totalCost,
        bytes memory
    ) external override {
        // Update volume tracking
        _updateVolumeTracking(params.marketKey, totalCost);
    }

    function beforeCancelOrder(CancelOrderParams calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return ITickBookHooks.beforeCancelOrder.selector;
    }

    function afterCancelOrder(CancelOrderParams calldata, uint256)
        external
        pure
        override
    {
        // No-op
    }

    function beforeCross(CrossParams calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return ITickBookHooks.beforeCross.selector;
    }

    function afterCross(CrossParams calldata params, uint256, uint256)
        external
        override
    {
        // Update volatility tracking on cross
        _updateVolatilityTracking(params.marketKey, params.crossTick);
    }

    function beforeClaim(ClaimParams calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return ITickBookHooks.beforeClaim.selector;
    }

    function afterClaim(ClaimParams calldata, uint256)
        external
        pure
        override
    {
        // No-op
    }

    function beforeSpotSell(SpotSellParams calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return ITickBookHooks.beforeSpotSell.selector;
    }

    function afterSpotSell(SpotSellParams calldata, uint256, uint256)
        external
        pure
        override
    {
        // No-op
    }
}
