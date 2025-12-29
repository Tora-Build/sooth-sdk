// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {TickBookPoolManager} from "../contracts/TickBookPoolManager.sol";
import {TickBookVault} from "../contracts/TickBookVault.sol";
import {DynamicFeeHook} from "../contracts/hooks/DynamicFeeHook.sol";
import {AMMEngine} from "../contracts/AMMEngine.sol";
import {Collateralizer} from "../contracts/Collateralizer.sol";
import {LaunchpadEngine} from "../contracts/LaunchpadEngine.sol";
import {TruthMarket} from "../contracts/TruthMarket.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DeployFreshV9
 * @notice Complete fresh V9.1.0 deployment with all contracts and test markets
 *
 * Usage:
 *   forge script script/DeployFreshV9.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast -vvv
 *
 * Requirements:
 *   - PRIVATE_KEY in .env
 *   - ~2000 MockUSDC in deployer wallet for market liquidity
 */
contract DeployFreshV9 is Script {
    // Base Sepolia USDC
    address constant USDC = 0x856FbEebD91Db28e3b4550e7602142Cfab683796;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("USDC balance:", IERC20(USDC).balanceOf(deployer));

        vm.startBroadcast(deployerPrivateKey);

        // ===== 1. Deploy Core Infrastructure =====
        
        // Collateralizer (only takes USDC)
        Collateralizer collateralizer = new Collateralizer(USDC);
        console.log("Collateralizer:", address(collateralizer));
        
        // AMMEngine
        AMMEngine ammEngine = new AMMEngine(USDC, deployer);
        console.log("AMMEngine:", address(ammEngine));
        
        // TickBookVault
        TickBookVault vault = new TickBookVault(USDC, deployer);
        console.log("TickBookVault:", address(vault));
        
        // TickBookPoolManager
        TickBookPoolManager poolManager = new TickBookPoolManager(address(vault));
        console.log("TickBookPoolManager:", address(poolManager));
        
        // Link vault to pool manager
        vault.setTickBook(address(poolManager));
        
        // DynamicFeeHook
        DynamicFeeHook feeHook = new DynamicFeeHook();
        console.log("DynamicFeeHook:", address(feeHook));
        
        // LaunchpadEngine
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
        
        // ===== 2. Create Test Markets =====
        
        uint64 deadline = uint64(block.timestamp + 30 days);
        
        // Market 1: Alien Life
        TruthMarket alienMarket = new TruthMarket(
            "Will UN confirm alien life by 2026?",
            deadline,
            deployer,  // adjudicator
            deployer   // guardian
        );
        console.log("AlienMarket:", address(alienMarket));
        
        // Activate the market (creator is deployer since we deployed it)
        alienMarket.activate();
        
        // Initialize with liquidity via LaunchpadEngine
        IERC20(USDC).approve(address(launchpad), type(uint256).max);
        uint256 liquidity = 1000 * 1e18; // 1000 MockUSDC (18 decimals)
        launchpad.createMarket(address(alienMarket), liquidity, "UN Confirms Alien Life", "ALIEN");
        console.log("ALIEN market initialized");
        
        // Market 2: BTC 100k
        TruthMarket btcMarket = new TruthMarket(
            "Will BTC 7-day TWAP >= $100k by EOY 2025?",
            deadline,
            deployer,
            deployer
        );
        console.log("BtcMarket:", address(btcMarket));
        
        btcMarket.activate();
        launchpad.createMarket(address(btcMarket), liquidity, "BTC TWAP >= $100k", "BTC100K");
        console.log("BTC100K market initialized");
        
        vm.stopBroadcast();

        // ===== 3. Output Summary =====
        console.log("\n========================================");
        console.log("  V9.1.0 FRESH DEPLOYMENT COMPLETE");
        console.log("========================================");
        console.log("\nCore Contracts:");
        console.log("  Collateralizer:", address(collateralizer));
        console.log("  AMMEngine:", address(ammEngine));
        console.log("  TickBookVault:", address(vault));
        console.log("  TickBookPoolManager:", address(poolManager));
        console.log("  DynamicFeeHook:", address(feeHook));
        console.log("  LaunchpadEngine:", address(launchpad));
        console.log("\nMarkets:");
        console.log("  ALIEN:", address(alienMarket));
        console.log("  BTC100K:", address(btcMarket));
        console.log("\n>>> Update apps/web/src/config/deployments.json with these addresses");
    }
}

