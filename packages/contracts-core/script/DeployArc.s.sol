// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {TickBookPoolManagerV10} from "../src/TickBookPoolManagerV10.sol";
import {TickBookVault} from "../src/TickBookVault.sol";
import {AMMEngine} from "../src/AMMEngine.sol";
import {Collateralizer} from "../src/Collateralizer.sol";
import {LaunchpadEngine} from "../src/LaunchpadEngine.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/**
 * @title DeployArc
 * @notice Deploy V9.9.6 to Arc Testnet
 * @dev Arc has native USDC at 0x3600000000000000000000000000000000000000
 *      But we deploy MockUSDC for test flexibility (unlimited minting)
 * 
 * Usage:
 *   forge script script/DeployArc.s.sol --rpc-url arcTestnet --broadcast --profile arc
 */
contract DeployArc is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("========================================");
        console.log("  ARC TESTNET DEPLOYMENT - V9.9.6");
        console.log("========================================");
        console.log("Chain ID: 5041490");
        console.log("Deployer:", deployer);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy MockUSDC (for test flexibility)
        MockUSDC mockUSDC = new MockUSDC("Mock USDC", "USDC");
        console.log("[1/6] MockUSDC:", address(mockUSDC));

        // 2. Deploy Collateralizer
        Collateralizer collateralizer = new Collateralizer(address(mockUSDC));
        console.log("[2/6] Collateralizer:", address(collateralizer));

        // 3. Deploy AMMEngine
        AMMEngine ammEngine = new AMMEngine(address(mockUSDC), deployer);
        console.log("[3/6] AMMEngine:", address(ammEngine));

        // 4. Deploy TickBookVault
        TickBookVault vault = new TickBookVault(address(mockUSDC), deployer);
        console.log("[4/6] TickBookVault:", address(vault));

        // 5. Deploy TickBookPoolManager V10
        TickBookPoolManagerV10 poolManager = new TickBookPoolManagerV10(address(vault));
        console.log("[5/6] TickBookPoolManager (V10):", address(poolManager));

        // Link vault to pool manager
        vault.setTickBook(address(poolManager));
        console.log("      -> Vault linked to PoolManager");

        // 6. Deploy LaunchpadEngine
        LaunchpadEngine launchpad = new LaunchpadEngine(
            address(mockUSDC),
            address(ammEngine),
            address(collateralizer),
            address(poolManager),
            deployer,  // treasury
            deployer   // owner
        );
        console.log("[6/6] LaunchpadEngine:", address(launchpad));

        // Configure permissions
        ammEngine.setRouter(address(launchpad));
        console.log("      -> AMMEngine router set to LaunchpadEngine");

        poolManager.setRegistrar(address(launchpad));
        console.log("      -> PoolManager registrar set to LaunchpadEngine");

        poolManager.setFeeRecipient(deployer);
        console.log("      -> Fee recipient set to deployer");

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("  ARC TESTNET DEPLOYMENT COMPLETE");
        console.log("========================================");
        console.log("");
        console.log("Contract Addresses:");
        console.log("  MockUSDC:             ", address(mockUSDC));
        console.log("  Collateralizer:       ", address(collateralizer));
        console.log("  AMMEngine:            ", address(ammEngine));
        console.log("  TickBookVault:        ", address(vault));
        console.log("  TickBookPoolManager:  ", address(poolManager));
        console.log("  LaunchpadEngine:      ", address(launchpad));
        console.log("");
        console.log("========================================");
        console.log("  NEXT STEPS");
        console.log("========================================");
        console.log("1. Update packages/contracts-core/deployments/v9-arcTestnet.json");
        console.log("2. Run: pnpm deploy-sync (in repo root)");
        console.log("3. Verify on Arcscan: https://testnet.arcscan.app");
    }
}
