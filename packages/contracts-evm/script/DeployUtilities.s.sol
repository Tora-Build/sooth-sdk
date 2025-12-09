// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/mocks/MockUSDC.sol";
import "../contracts/core/TickCostRegistry.sol";

/// @title DeployUtilities
/// @notice Phase 0: Deploy reusable utility contracts
/// @dev Run this FIRST, save addresses for subsequent phase deployments
contract DeployUtilities is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Phase 0: Deploy Utility Contracts ===");
        console.log("Deployer:", deployer);

        // 1. MockUSDC
        MockUSDC usdc = new MockUSDC();
        usdc.mint(deployer, 10_000_000 * 1e18); // 10M tokens
        console.log("MockUSDC:", address(usdc));

        // 2. TickCostRegistry
        TickCostRegistry registry = new TickCostRegistry();
        console.log("TickCostRegistry:", address(registry));

        // 3. Initialize registry (all at once - works on local/high gas chains)
        //    For low gas chains, use initBatch in separate transactions
        try registry.initializeAll() {
            console.log("Registry initialized (all ticks)");
        } catch {
            console.log("Registry init failed - use batch init on this chain");
        }

        vm.stopBroadcast();

        console.log("");
        console.log("=== Phase 0 Complete ===");
        console.log("USDC:", address(usdc));
        console.log("TickCostRegistry:", address(registry));
        console.log("Registry initialized:", registry.initialized());
    }
}
