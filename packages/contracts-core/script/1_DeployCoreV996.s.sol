// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {TickBookPoolManagerV996} from "../src/TickBookPoolManagerV996.sol";
import {TickBookVault} from "../src/TickBookVault.sol";
import {AMMEngine} from "../src/AMMEngine.sol";
import {Collateralizer} from "../src/Collateralizer.sol";
import {LaunchpadEngine} from "../src/LaunchpadEngine.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title 1_DeployCoreV996
 * @notice STEP 1: Deploy V9.9.6 Unified Order API core contracts
 * @dev Run this first. After successful deployment:
 *      1. Update deployments.json with addresses
 *      2. Update environment with LAUNCHPAD_ENGINE address
 *      3. Then run 2_CreateMarket.s.sol
 * 
 * Supports multiple chains:
 * - Base Sepolia (84532)
 * - Monad Testnet (10143)
 */
contract DeployCoreV996 is Script {
    // Known MockUSDC addresses per chain
    address constant USDC_BASE_SEPOLIA = 0x0C31bbB6dA82ba97fBAfBe3425ee8757a4d724e3;
    address constant USDC_MONAD_TESTNET = 0x7192f46FA78e7d1b5BB6BA687D15d0b6A0802dA3;
    address constant USDC_ARC_TESTNET = 0xD9DfdEC3046eaD9891714f9fb465DbE89Da48689;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        uint256 chainId = block.chainid;

        console.log("========================================");
        console.log("  STEP 1: DEPLOY CORE CONTRACTS (V9.9.6)");
        console.log("  Unified Order API");
        console.log("========================================");
        console.log("Deployer:", deployer);
        console.log("Chain ID:", chainId);

        // Get USDC based on chain
        address usdc;
        if (chainId == 84532) {
            usdc = USDC_BASE_SEPOLIA;
            console.log("Chain: Base Sepolia");
        } else if (chainId == 10143) {
            usdc = USDC_MONAD_TESTNET;
            console.log("Chain: Monad Testnet");
        } else if (chainId == 5042002) {
            usdc = USDC_ARC_TESTNET;
            console.log("Chain: Arc Testnet");
        } else {
            revert("Unsupported chain. Add MockUSDC address for this chain.");
        }
        
        console.log("USDC:", usdc);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Collateralizer
        Collateralizer collateralizer = new Collateralizer(usdc);
        console.log("[1/5] Collateralizer:", address(collateralizer));

        // 2. Deploy AMMEngine
        AMMEngine ammEngine = new AMMEngine(usdc, deployer);
        console.log("[2/5] AMMEngine:", address(ammEngine));

        // 3. Deploy TickBookVault
        TickBookVault vault = new TickBookVault(usdc, deployer);
        console.log("[3/5] TickBookVault:", address(vault));

        // 4. Deploy TickBookPoolManager V9.9.6 (Unified Order API)
        TickBookPoolManagerV996 poolManager = new TickBookPoolManagerV996(address(vault));
        console.log("[4/5] TickBookPoolManager (V9.9.6 Unified):", address(poolManager));

        // Link vault to pool manager
        vault.setTickBook(address(poolManager));
        console.log("      -> Vault linked to PoolManager");

        // 5. Deploy LaunchpadEngine
        LaunchpadEngine launchpad = new LaunchpadEngine(
            usdc,
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
        console.log("  CORE DEPLOYMENT COMPLETE (V9.9.6)");
        console.log("========================================");
        console.log("");
        console.log("Contract Addresses:");
        console.log("  Collateralizer:       ", address(collateralizer));
        console.log("  AMMEngine:            ", address(ammEngine));
        console.log("  TickBookVault:        ", address(vault));
        console.log("  TickBookPoolManager:  ", address(poolManager));
        console.log("  LaunchpadEngine:      ", address(launchpad));
        console.log("  MockUSDC:             ", usdc);
        console.log("");
        console.log("========================================");
        console.log("  NEXT STEPS");
        console.log("========================================");
        console.log("1. Run: ./apps/web/scripts/sync-deployments.sh");
        console.log("2. Create test market via interactive CLI");
    }
}
