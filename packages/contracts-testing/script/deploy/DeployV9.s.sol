// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {TickBookPoolManager} from "@core/TickBookPoolManager.sol";
import {TickBookVault} from "@core/TickBookVault.sol";
import {DynamicFeeHook} from "@core/hooks/DynamicFeeHook.sol";

/**
 * @title DeployV9
 * @notice Deploys V9 contracts: TickBookPoolManager (singleton) + TickBookVault
 *
 * Usage:
 *   forge script script/DeployV9.s.sol --rpc-url $RPC_URL --broadcast --verify
 *
 * Environment variables:
 *   - PRIVATE_KEY: Deployer private key
 *   - USDC_ADDRESS: USDC token address on target chain
 */
contract DeployV9 is Script {
    function run() external {
        // Get environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address deployer = vm.addr(deployerPrivateKey);

        require(usdc != address(0), "DeployV9: USDC_ADDRESS not set");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy TickBookVault
        TickBookVault vault = new TickBookVault(usdc, deployer);
        console.log("TickBookVault deployed at:", address(vault));

        // 2. Deploy TickBookPoolManager
        TickBookPoolManager poolManager = new TickBookPoolManager(address(vault));
        console.log("TickBookPoolManager deployed at:", address(poolManager));

        // 3. Link vault to pool manager
        vault.setTickBook(address(poolManager));
        console.log("Vault linked to PoolManager");

        // 4. Deploy DynamicFeeHook (optional)
        DynamicFeeHook feeHook = new DynamicFeeHook();
        console.log("DynamicFeeHook deployed at:", address(feeHook));

        vm.stopBroadcast();

        // Output deployment summary
        console.log("\n=== V9 Deployment Summary ===");
        console.log("Chain ID:", block.chainid);
        console.log("USDC:", usdc);
        console.log("TickBookVault:", address(vault));
        console.log("TickBookPoolManager:", address(poolManager));
        console.log("DynamicFeeHook:", address(feeHook));
        console.log("\nNext steps:");
        console.log("1. Deploy LaunchpadEngine with poolManager as tickBook");
        console.log("2. Register existing markets via registerMarket()");
        console.log("3. Update frontend config with new addresses");
    }
}

/**
 * @title DeployV9WithLaunchpad
 * @notice Full V9 deployment including LaunchpadEngine
 */
contract DeployV9WithLaunchpad is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address usdc = vm.envAddress("USDC_ADDRESS");

        require(usdc != address(0), "DeployV9: USDC_ADDRESS not set");

        vm.startBroadcast(deployerPrivateKey);

        // Core V9 contracts
        TickBookVault vault = new TickBookVault(usdc, msg.sender);
        TickBookPoolManager poolManager = new TickBookPoolManager(address(vault));
        vault.setTickBook(address(poolManager));

        // Import existing contracts
        // Collateralizer collateralizer = new Collateralizer(usdc);
        // AMMEngine amm = new AMMEngine(...);
        // LaunchpadEngine launchpad = new LaunchpadEngine(
        //     usdc,
        //     address(collateralizer),
        //     address(amm),
        //     address(poolManager), // TickBookPoolManager as tickBook
        //     feeController
        // );

        vm.stopBroadcast();

        console.log("TickBookVault:", address(vault));
        console.log("TickBookPoolManager:", address(poolManager));
    }
}
