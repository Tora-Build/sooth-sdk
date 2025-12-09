// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ITickCostRegistry.sol";
import "./libs/TickMath.sol";

/// @title TickCostRegistry
/// @notice External registry for precomputed LMSR tick costs
/// @dev Deploy ONCE per chain, initialize in batches, share across markets
contract TickCostRegistry is ITickCostRegistry {
    /// @notice ln(2) in WAD precision ≈ 0.693147... * 1e18
    uint256 public constant override LN2_WAD = 693147180559945309;
    
    /// @notice Precomputed marginal costs per tick
    uint256[1000] public costs;
    
    /// @notice Number of ticks initialized so far
    uint16 public ticksInitialized;
    
    /// @notice Owner who can initialize
    address public immutable owner;
    
    /// @notice True when all 1000 ticks are initialized
    bool public override initialized;

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Registry: not owner");
        _;
    }

    /// @notice Initialize a batch of tick costs
    /// @param startTick Starting tick index (must equal ticksInitialized)
    /// @param batchCosts Array of costs for this batch
    function initBatch(uint16 startTick, uint256[] calldata batchCosts) external onlyOwner {
        require(!initialized, "Registry: already initialized");
        require(startTick == ticksInitialized, "Registry: wrong start tick");
        require(startTick + batchCosts.length <= TickMath.TOTAL_TICKS, "Registry: batch overflow");

        for (uint16 i = 0; i < batchCosts.length; i++) {
            costs[startTick + i] = batchCosts[i];
        }
        
        ticksInitialized += uint16(batchCosts.length);
        
        if (ticksInitialized == TickMath.TOTAL_TICKS) {
            initialized = true;
        }
    }

    /// @notice Compute and initialize all ticks (for chains with high gas limits)
    /// @dev Uses ~7M gas - only works on high-gas-limit chains
    function initializeAll() external onlyOwner {
        require(!initialized, "Registry: already initialized");
        
        uint256 totalWeight = 0;
        uint256[1000] memory weights;
        
        uint256 maxDistSq = (uint256(999) * uint256(999)) / 4;
        
        for (uint16 i = 0; i < TickMath.TOTAL_TICKS; i++) {
            int256 twoDist = int256(uint256(i) * 2) - 999;
            uint256 distSq = uint256(twoDist * twoDist) / 4;
            weights[i] = maxDistSq - distSq + uint256(TickMath.TOTAL_TICKS);
            totalWeight += weights[i];
        }
        
        for (uint16 i = 0; i < TickMath.TOTAL_TICKS; i++) {
            costs[i] = (weights[i] * LN2_WAD) / totalWeight;
        }
        
        ticksInitialized = TickMath.TOTAL_TICKS;
        initialized = true;
    }

    /// @notice Get marginal cost for a tick
    function getCost(uint16 tick) external view override returns (uint256) {
        require(tick < TickMath.TOTAL_TICKS, "Registry: invalid tick");
        return costs[tick];
    }

    /// @notice Get costs for a range of ticks
    function getCostRange(uint16 fromTick, uint16 toTick) external view returns (uint256 totalCost) {
        require(fromTick < TickMath.TOTAL_TICKS && toTick <= TickMath.TOTAL_TICKS, "Registry: invalid range");
        
        if (fromTick < toTick) {
            for (uint16 i = fromTick; i < toTick; i++) {
                totalCost += costs[i];
            }
        } else {
            for (uint16 i = toTick; i < fromTick; i++) {
                totalCost += costs[i];
            }
        }
    }

    /// @notice Compute weights off-chain for batch initialization
    /// @dev Returns the weight for a single tick (used to pre-compute off-chain)
    function computeWeight(uint16 tick) external pure returns (uint256 weight, uint256 maxDistSq) {
        maxDistSq = (uint256(999) * uint256(999)) / 4;
        int256 twoDist = int256(uint256(tick) * 2) - 999;
        uint256 distSq = uint256(twoDist * twoDist) / 4;
        weight = maxDistSq - distSq + uint256(TickMath.TOTAL_TICKS);
    }
}
