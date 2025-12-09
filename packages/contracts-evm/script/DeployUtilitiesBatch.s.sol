// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/mocks/MockUSDC.sol";
import "../contracts/core/TickCostRegistry.sol";
import "../contracts/core/libs/TickMath.sol";

/// @title DeployUtilitiesBatch
/// @notice Phase 0: Deploy utilities with batch registry initialization
/// @dev For chains with low gas limits (like Base Sepolia)
contract DeployUtilitiesBatch is Script {
    
    // How many ticks to initialize per batch (adjust based on gas limits)
    uint16 constant BATCH_SIZE = 100;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Phase 0: Deploy Utility Contracts (Batch Mode) ===");
        console.log("Deployer:", deployer);

        // 1. MockUSDC
        MockUSDC usdc = new MockUSDC();
        usdc.mint(deployer, 10_000_000 * 1e18);
        console.log("MockUSDC:", address(usdc));

        // 2. TickCostRegistry (empty)
        TickCostRegistry registry = new TickCostRegistry();
        console.log("TickCostRegistry:", address(registry));
        console.log("Registry will need batch initialization");

        vm.stopBroadcast();

        console.log("");
        console.log("=== Phase 0a Complete ===");
        console.log("USDC:", address(usdc));
        console.log("TickCostRegistry:", address(registry));
        console.log("");
        console.log("Next: Run DeployUtilitiesBatch_Init with TICK_REGISTRY set");
    }
}

/// @title DeployUtilitiesBatch_Init
/// @notice Initialize TickCostRegistry in batches
contract DeployUtilitiesBatch_Init is Script {
    // Set this after Phase 0a deployment
    address constant TICK_REGISTRY = 0xF8928d461BB54F5B8473A133DF1d77BC043Af605;
    
    uint16 constant BATCH_SIZE = 100;
    uint256 constant LN2_WAD = 693147180559945309;
    
    function run() external {
        require(TICK_REGISTRY != address(0), "Set TICK_REGISTRY first");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        TickCostRegistry registry = TickCostRegistry(TICK_REGISTRY);
        uint16 startTick = registry.ticksInitialized();
        
        console.log("=== Initializing TickCostRegistry Batch ===");
        console.log("Current progress:", startTick, "/ 1000");
        
        if (registry.initialized()) {
            console.log("Registry already fully initialized!");
            return;
        }
        
        // Compute weights for this batch off-chain to save gas
        uint256[] memory batchCosts = _computeBatchCosts(startTick, BATCH_SIZE);
        
        vm.startBroadcast(deployerPrivateKey);
        
        registry.initBatch(startTick, batchCosts);
        
        vm.stopBroadcast();
        
        console.log("Initialized ticks:", startTick, "-", startTick + BATCH_SIZE - 1);
        console.log("Registry initialized:", registry.initialized());
        
        if (!registry.initialized()) {
            console.log("Run this script again to continue initialization");
        }
    }
    
    function _computeBatchCosts(uint16 startTick, uint16 batchSize) internal pure returns (uint256[] memory) {
        uint256[] memory costs = new uint256[](batchSize);
        
        // Compute total weight for normalization
        uint256 totalWeight = 0;
        uint256 maxDistSq = (uint256(999) * uint256(999)) / 4;
        
        // First pass: compute all weights
        uint256[1000] memory weights;
        for (uint16 i = 0; i < 1000; i++) {
            int256 twoDist = int256(uint256(i) * 2) - 999;
            uint256 distSq = uint256(twoDist * twoDist) / 4;
            weights[i] = maxDistSq - distSq + 1000;
            totalWeight += weights[i];
        }
        
        // Second pass: normalize batch
        for (uint16 i = 0; i < batchSize; i++) {
            uint16 tick = startTick + i;
            if (tick < 1000) {
                costs[i] = (weights[tick] * LN2_WAD) / totalWeight;
            }
        }
        
        return costs;
    }
}
