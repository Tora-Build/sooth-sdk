// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {AMMEngine} from "../contracts/AMMEngine.sol";
import {LaunchpadEngine} from "../contracts/LaunchpadEngine.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title InitializeAMM
 * @notice Initialize AMM pools for existing markets via LaunchpadEngine
 */
contract InitializeAMM is Script {
    address constant USDC = 0x0C31bbB6dA82ba97fBAfBe3425ee8757a4d724e3;
    address constant LAUNCHPAD = 0x4Ec2FD4c6a8584976c1e032624574E9ecba28D11;
    address constant AMM = 0x76Dc341A2635439Afb503bFE57316ebcb7580B3C;

    address constant ALIEN_MARKET = 0xfc43d6Be9B988a0b06DCb6F14b6741D353ADE5e1;
    address constant BTC_MARKET = 0x45FdB4e8b8E38cD9b8B587B4334af71986c2Af78;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console.log("========================================");
        console.log("  INITIALIZE AMM POOLS");
        console.log("========================================");

        vm.startBroadcast(deployerPrivateKey);

        // Add liquidity to both markets via LaunchpadEngine
        uint256 liquidity = 1000 * 1e18; // 1000 WAD

        IERC20(USDC).approve(address(LAUNCHPAD), type(uint256).max);

        try LaunchpadEngine(LAUNCHPAD).addLiquidity(ALIEN_MARKET, liquidity) returns (uint256 lpTokens) {
            console.log("ALIEN AMM initialized, LP tokens:", lpTokens);
        } catch Error(string memory reason) {
            console.log("ALIEN failed:", reason);
        } catch {
            console.log("ALIEN failed: unknown error");
        }

        try LaunchpadEngine(LAUNCHPAD).addLiquidity(BTC_MARKET, liquidity) returns (uint256 lpTokens) {
            console.log("BTC100K AMM initialized, LP tokens:", lpTokens);
        } catch Error(string memory reason) {
            console.log("BTC100K failed:", reason);
        } catch {
            console.log("BTC100K failed: unknown error");
        }

        vm.stopBroadcast();

        console.log("========================================");
        console.log("  AMM INITIALIZATION COMPLETE");
        console.log("========================================");
    }
}
