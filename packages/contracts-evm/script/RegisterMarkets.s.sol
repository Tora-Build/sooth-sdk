// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {Collateralizer} from "../contracts/Collateralizer.sol";
import {TruthMarket} from "../contracts/TruthMarket.sol";

/**
 * @title RegisterMarkets
 * @notice Register existing markets with Collateralizer
 */
contract RegisterMarkets is Script {
    address constant COLLATERALIZER = 0x1C146C1e79c6C20afdb90eDb13D0eAa11C412557;
    address constant ALIEN_MARKET = 0xfc43d6Be9B988a0b06DCb6F14b6741D353ADE5e1;
    address constant BTC_MARKET = 0x45FdB4e8b8E38cD9b8B587B4334af71986c2Af78;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        console.log("========================================");
        console.log("  REGISTER MARKETS WITH COLLATERALIZER");
        console.log("========================================");

        vm.startBroadcast(deployerPrivateKey);

        Collateralizer collat = Collateralizer(COLLATERALIZER);

        // Register ALIEN market
        try collat.registerMarket(ALIEN_MARKET, "UN Confirms Alien Life", "ALIEN") returns (address yesToken, address noToken) {
            console.log("[1/2] ALIEN registered");
            console.log("      YES:", yesToken);
            console.log("      NO:", noToken);
        } catch Error(string memory reason) {
            console.log("[1/2] ALIEN failed:", reason);
        } catch {
            console.log("[1/2] ALIEN failed: unknown error");
        }

        // Register BTC100K market
        try collat.registerMarket(BTC_MARKET, "BTC TWAP >= $100k", "BTC100K") returns (address yesToken, address noToken) {
            console.log("[2/2] BTC100K registered");
            console.log("      YES:", yesToken);
            console.log("      NO:", noToken);
        } catch Error(string memory reason) {
            console.log("[2/2] BTC100K failed:", reason);
        } catch {
            console.log("[2/2] BTC100K failed: unknown error");
        }

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("  REGISTRATION COMPLETE");
        console.log("========================================");
    }
}
