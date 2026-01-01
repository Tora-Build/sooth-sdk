// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {LaunchpadEngine} from "../contracts/LaunchpadEngine.sol";
import {TruthMarket} from "../contracts/TruthMarket.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title CreateV995Markets
 * @notice Creates 2 test markets on V9.9.5 LEAN infrastructure (Base Sepolia)
 */
contract CreateV995Markets is Script {
    // V9.9.5 LEAN Base Sepolia addresses (deployed 2025-12-31)
    address constant USDC = 0x0C31bbB6dA82ba97fBAfBe3425ee8757a4d724e3;
    address constant LAUNCHPAD = 0x4Ec2FD4c6a8584976c1e032624574E9ecba28D11;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("========================================");
        console.log("  CREATE V9.9.5 TEST MARKETS");
        console.log("========================================");
        console.log("Deployer:", deployer);

        uint256 usdcBalance = IERC20(USDC).balanceOf(deployer);
        console.log("USDC balance:", usdcBalance);

        LaunchpadEngine launchpad = LaunchpadEngine(LAUNCHPAD);

        vm.startBroadcast(deployerPrivateKey);

        uint64 deadline = uint64(block.timestamp + 30 days);
        uint256 liquidity = 500 * 1e6; // 500 MockUSDC (6 decimals)

        // Approve USDC for both markets
        IERC20(USDC).approve(address(launchpad), type(uint256).max);
        console.log("USDC approved");

        // Market 1: Alien Life
        TruthMarket alienMarket = new TruthMarket(
            "Will UN confirm alien life by 2026?",
            deadline,
            deployer,  // adjudicator
            deployer   // guardian
        );
        console.log("[1/2] TruthMarket (ALIEN):", address(alienMarket));
        alienMarket.activate();
        launchpad.createMarket(address(alienMarket), liquidity, "UN Confirms Alien Life", "ALIEN");
        console.log("      -> Market initialized in LaunchpadEngine");

        // Market 2: BTC 100k
        TruthMarket btcMarket = new TruthMarket(
            "Will BTC 7-day TWAP >= $100k by EOY 2025?",
            deadline,
            deployer,
            deployer
        );
        console.log("[2/2] TruthMarket (BTC100K):", address(btcMarket));
        btcMarket.activate();
        launchpad.createMarket(address(btcMarket), liquidity, "BTC TWAP >= $100k", "BTC100K");
        console.log("      -> Market initialized in LaunchpadEngine");

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("  MARKETS CREATED SUCCESSFULLY");
        console.log("========================================");
        console.log("ALIEN Market:   ", address(alienMarket));
        console.log("BTC100K Market: ", address(btcMarket));
        console.log("");
        console.log("Next: Update apps/web/src/config/markets.json");
    }
}
