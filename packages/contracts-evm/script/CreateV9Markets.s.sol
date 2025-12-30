// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {LaunchpadEngine} from "../contracts/LaunchpadEngine.sol";
import {TruthMarket} from "../contracts/TruthMarket.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CreateV9Markets
 * @notice Creates test markets using already-deployed V9 infrastructure
 */
contract CreateV9Markets is Script {
    // Base Sepolia addresses from fresh deployment
    address constant USDC = 0x856FbEebD91Db28e3b4550e7602142Cfab683796;
    address constant LAUNCHPAD = 0x7eeCBc32c3750C95e32dA060E2FFADa3Cdbf50d4;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deployer:", deployer);
        console.log("USDC balance:", IERC20(USDC).balanceOf(deployer));

        LaunchpadEngine launchpad = LaunchpadEngine(LAUNCHPAD);

        vm.startBroadcast(deployerPrivateKey);

        uint64 deadline = uint64(block.timestamp + 30 days);
        uint256 liquidity = 1000 * 1e18; // 1000 MockUSDC (18 decimals)
        
        // Approve USDC
        IERC20(USDC).approve(address(launchpad), type(uint256).max);
        
        // Market 1: Alien Life
        TruthMarket alienMarket = new TruthMarket(
            "Will UN confirm alien life by 2026?",
            deadline,
            deployer,  // adjudicator
            deployer   // guardian
        );
        console.log("AlienMarket:", address(alienMarket));
        alienMarket.activate();
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

        console.log("\n=== Markets Created ===");
        console.log("ALIEN:", address(alienMarket));
        console.log("BTC100K:", address(btcMarket));
    }
}
