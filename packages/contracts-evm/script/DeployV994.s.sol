// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {TickBookPoolManagerV994} from "../contracts/TickBookPoolManagerV994.sol";
import {TickBookVault} from "../contracts/TickBookVault.sol";
import {AMMEngine} from "../contracts/AMMEngine.sol";
import {Collateralizer} from "../contracts/Collateralizer.sol";
import {LaunchpadEngine} from "../contracts/LaunchpadEngine.sol";
import {TruthMarket} from "../contracts/TruthMarket.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployV994
 * @notice Complete V9.9.4 deployment with Lean TickBook and Audit Fixes
 */
contract DeployV994 is Script {
    // Base Sepolia USDC (Mock)
    address constant USDC = 0x0C31bbB6dA82ba97fBAfBe3425ee8757a4d724e3;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying V9.9.4 to Base Sepolia");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Collateralizer
        Collateralizer collateralizer = new Collateralizer(USDC);
        console.log("Collateralizer:", address(collateralizer));
        
        // 2. Deploy AMMEngine (Lean V9.9.4)
        AMMEngine ammEngine = new AMMEngine(USDC, deployer);
        console.log("AMMEngine:", address(ammEngine));
        
        // 3. Deploy TickBookVault
        TickBookVault vault = new TickBookVault(USDC, deployer);
        console.log("TickBookVault:", address(vault));
        
        // 4. Deploy TickBookPoolManagerV994 (Lean singleton)
        TickBookPoolManagerV994 poolManager = new TickBookPoolManagerV994(address(vault));
        console.log("TickBookPoolManagerV994:", address(poolManager));
        
        // Link vault to pool manager
        vault.setTickBook(address(poolManager));
        
        // 5. Deploy LaunchpadEngine
        LaunchpadEngine launchpad = new LaunchpadEngine(
            USDC,
            address(ammEngine),
            address(collateralizer),
            address(poolManager),
            deployer,  // treasury
            deployer   // owner
        );
        console.log("LaunchpadEngine:", address(launchpad));
        
        // Link AMMEngine to LaunchpadEngine
        ammEngine.setRouter(address(launchpad));
        
        // Set LaunchpadEngine as registrar for TickBook
        poolManager.setRegistrar(address(launchpad));
        console.log("Registrar set to LaunchpadEngine");
        
        // Set Fee Recipient in TickBook
        poolManager.setFeeRecipient(deployer);
        
        // Optional: Create initial test markets if needed
        // (Skipped here to keep deployment clean)

        vm.stopBroadcast();

        console.log("\n========================================");
        console.log("  V9.9.4 DEPLOYMENT COMPLETE");
        console.log("========================================");
        console.log("TickBookPoolManagerV994:", address(poolManager));
        console.log("LaunchpadEngine:", address(launchpad));
        console.log("AMMEngine:", address(ammEngine));
        console.log("Collateralizer:", address(collateralizer));
        console.log("TickBookVault:", address(vault));
        console.log("\n>>> Update deploy-sync and frontend/deployments.json");
    }
}
