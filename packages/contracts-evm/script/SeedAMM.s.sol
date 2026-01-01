// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {LaunchpadEngine} from "../contracts/LaunchpadEngine.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title SeedAMM
 * @notice Seed AMM pools with initial trades
 */
contract SeedAMM is Script {
    address constant USDC = 0x0C31bbB6dA82ba97fBAfBe3425ee8757a4d724e3;
    address constant LAUNCHPAD = 0x4Ec2FD4c6a8584976c1e032624574E9ecba28D11;

    address constant ALIEN_MARKET = 0xfc43d6Be9B988a0b06DCb6F14b6741D353ADE5e1;
    address constant BTC_MARKET = 0x45FdB4e8b8E38cD9b8B587B4334af71986c2Af78;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("========================================");
        console.log("  SEED AMM POOLS");
        console.log("========================================");
        console.log("Deployer:", deployer);

        uint256 balance = IERC20(USDC).balanceOf(deployer);
        console.log("USDC balance:", balance);

        LaunchpadEngine launchpad = LaunchpadEngine(LAUNCHPAD);

        vm.startBroadcast(deployerPrivateKey);

        // Approve USDC
        IERC20(USDC).approve(address(launchpad), type(uint256).max);
        console.log("USDC approved");

        // Seed ALIEN market: Buy 2 YES shares (small trade to initialize)
        uint256 cost1 = launchpad.tradePositions(
            ALIEN_MARKET,
            1,  // YES
            int256(2 * 1e18),  // 2 shares
            10 * 1e6  // max 10 USDC
        );
        console.log("[1/2] ALIEN seeded - Cost:", cost1);

        // Seed BTC100K market: Buy 2 YES shares
        uint256 cost2 = launchpad.tradePositions(
            BTC_MARKET,
            1,  // YES
            int256(2 * 1e18),  // 2 shares
            10 * 1e6  // max 10 USDC
        );
        console.log("[2/2] BTC100K seeded - Cost:", cost2);

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("  AMM POOLS SEEDED");
        console.log("========================================");
        console.log("Total cost:", (cost1 + cost2) / 1e6, "USDC");
        console.log("");
        console.log("Markets ready for trading!");
    }
}
