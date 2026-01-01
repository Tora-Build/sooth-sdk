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

    address constant ALIEN_MARKET = 0xfc43d6Be9B988a0b06DCb6F14b6741D353ADE5e1;
    address constant BTC_MARKET = 0x45FdB4e8b8E38cD9b8B587B4334af71986c2Af78;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console.log("========================================");
        console.log("  INITIALIZE AMM VIA LAUNCHPAD");
        console.log("========================================");

        vm.startBroadcast(deployerPrivateKey);

        LaunchpadEngine launchpad = LaunchpadEngine(LAUNCHPAD);
        IERC20(USDC).approve(address(launchpad), type(uint256).max);

        // Re-call createMarket - it should now succeed since markets are registered
        uint256 liquidity = 500 * 1e18; // 500 WAD

        try launchpad.createMarket(ALIEN_MARKET, liquidity, "UN Confirms Alien Life", "ALIEN") returns (uint256 lpTokens) {
            console.log("[1/2] ALIEN AMM initialized, LP:", lpTokens);
        } catch Error(string memory reason) {
            console.log("[1/2] ALIEN failed:", reason);
        } catch {
            console.log("[1/2] ALIEN failed");
        }

        try launchpad.createMarket(BTC_MARKET, liquidity, "BTC TWAP >= $100k", "BTC100K") returns (uint256 lpTokens) {
            console.log("[2/2] BTC100K AMM initialized, LP:", lpTokens);
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
