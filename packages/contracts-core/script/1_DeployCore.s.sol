// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {TickBookPoolManagerV995} from "../src/TickBookPoolManagerV995.sol";
import {TickBookVault} from "../src/TickBookVault.sol";
import {AMMEngine} from "../src/AMMEngine.sol";
import {Collateralizer} from "../src/Collateralizer.sol";
import {LaunchpadEngine} from "../src/LaunchpadEngine.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title 1_DeployCore
 * @notice STEP 1: Deploy V9.9.5 LEAN core contracts
 * @dev Run this first. After successful deployment:
 *      1. Update deployments.json with addresses
 *      2. Update environment with LAUNCHPAD_ENGINE address
 *      3. Then run 2_CreateMarket.s.sol
 */
contract DeployCore is Script {
    // Base Sepolia MockUSDC (6 decimals)
    address constant USDC = 0x0C31bbB6dA82ba97fBAfBe3425ee8757a4d724e3;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("========================================");
        console.log("  STEP 1: DEPLOY CORE CONTRACTS");
        console.log("  V9.9.5 LEAN (no hooks)");
        console.log("========================================");
        console.log("Deployer:", deployer);
        console.log("USDC:", USDC);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Collateralizer
        Collateralizer collateralizer = new Collateralizer(USDC);
        console.log("[1/5] Collateralizer:", address(collateralizer));

        // 2. Deploy AMMEngine
        AMMEngine ammEngine = new AMMEngine(USDC, deployer);
        console.log("[2/5] AMMEngine:", address(ammEngine));

        // 3. Deploy TickBookVault
        TickBookVault vault = new TickBookVault(USDC, deployer);
        console.log("[3/5] TickBookVault:", address(vault));

        // 4. Deploy TickBookPoolManager V9.9.5 (LEAN - no hooks)
        TickBookPoolManagerV995 poolManager = new TickBookPoolManagerV995(address(vault));
        console.log("[4/5] TickBookPoolManager (V9.9.5 LEAN):", address(poolManager));

        // Link vault to pool manager
        vault.setTickBook(address(poolManager));
        console.log("      -> Vault linked to PoolManager");

        // 5. Deploy LaunchpadEngine
        LaunchpadEngine launchpad = new LaunchpadEngine(
            USDC,
            address(ammEngine),
            address(collateralizer),
            address(poolManager),
            deployer,  // treasury
            deployer   // owner
        );
        console.log("[5/5] LaunchpadEngine:", address(launchpad));

        // Link AMMEngine to LaunchpadEngine (router pattern)
        ammEngine.setRouter(address(launchpad));
        console.log("      -> AMMEngine router set to LaunchpadEngine");

        // Set LaunchpadEngine as registrar for TickBook
        poolManager.setRegistrar(address(launchpad));
        console.log("      -> PoolManager registrar set to LaunchpadEngine");

        // Set fee recipient
        poolManager.setFeeRecipient(deployer);
        console.log("      -> Fee recipient set to deployer");

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("  CORE DEPLOYMENT COMPLETE");
        console.log("========================================");
        console.log("");
        console.log("Contract Addresses:");
        console.log("  Collateralizer:       ", address(collateralizer));
        console.log("  AMMEngine:            ", address(ammEngine));
        console.log("  TickBookVault:        ", address(vault));
        console.log("  TickBookPoolManager:  ", address(poolManager));
        console.log("  LaunchpadEngine:      ", address(launchpad));
        console.log("  MockUSDC:             ", USDC);
        console.log("");
        console.log("========================================");
        console.log("  NEXT STEPS");
        console.log("========================================");
        console.log("1. Update apps/web/src/config/deployments.json");
        console.log("2. Update packages/contracts-core/deployments/v9-baseSepolia.json");
        console.log("3. Export LAUNCHPAD_ENGINE=", address(launchpad));
        console.log("4. Run: forge script script/2_CreateMarket.s.sol --rpc-url $RPC --broadcast");
    }
}
