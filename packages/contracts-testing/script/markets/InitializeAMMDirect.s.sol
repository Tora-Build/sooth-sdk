// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {LaunchpadEngine} from "@core/LaunchpadEngine.sol";
import {AMMEngine} from "@core/AMMEngine.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title InitializeAMMDirect
 * @notice Initialize AMM through createMarket which will handle everything
 */
contract InitializeAMMDirect is Script {
    address constant USDC = 0x0C31bbB6dA82ba97fBAfBe3425ee8757a4d724e3;
    address constant LAUNCHPAD = 0x4Ec2FD4c6a8584976c1e032624574E9ecba28D11;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("========================================");
        console.log("  INITIALIZE AMM VIA LAUNCHPAD");
        console.log("========================================");

        vm.startBroadcast(deployerPrivateKey);

        LaunchpadEngine launchpad = LaunchpadEngine(LAUNCHPAD);
        IERC20(USDC).approve(address(launchpad), type(uint256).max);

        uint256 liquidity = 500 * 1e18;
        uint64 startTime = uint64(block.timestamp);

        try launchpad.createMarket(
            "UN Confirms Alien Life",
            startTime,
            uint64(block.timestamp + 365 days),
            deployer,
            deployer,
            liquidity
        ) returns (address market, uint256 lpTokens) {
            console.log("[1/2] ALIEN created:", market);
            console.log("      LP:", lpTokens);
        } catch Error(string memory reason) {
            console.log("[1/2] ALIEN failed:", reason);
        } catch {
            console.log("[1/2] ALIEN failed");
        }

        try launchpad.createMarket(
            "BTC TWAP >= $100k",
            startTime,
            uint64(block.timestamp + 180 days),
            deployer,
            deployer,
            liquidity
        ) returns (address market, uint256 lpTokens) {
            console.log("[2/2] BTC100K created:", market);
            console.log("      LP:", lpTokens);
        } catch Error(string memory reason) {
            console.log("[2/2] BTC100K failed:", reason);
        } catch {
            console.log("[2/2] BTC100K failed");
        }

        vm.stopBroadcast();

        console.log("");
        console.log("AMM pools ready!");
    }
}
