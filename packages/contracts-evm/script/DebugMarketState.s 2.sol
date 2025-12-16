// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/launchpad/LaunchpadMarket.sol";

contract DebugMarketState is Script {
    function run() external view {
        address marketAddress = 0xFf38c86Ac7481b298F2196Cca553685bAE385977;
        address expectedVault = 0xAd461C1c55bf552756Ad29Ac96f341A1fC007176;

        LaunchpadMarket market = LaunchpadMarket(marketAddress);
        
        address currentVault = market.traderVault();
        address creator = market.creator();
        
        console.log("Market Address:", marketAddress);
        console.log("Stored TraderVault:", currentVault);
        console.log("Expected TraderVault:", expectedVault);
        console.log("Market Creator:", creator);
        
        if (currentVault == expectedVault) {
            console.log("State is CORRECT.");
        } else {
            console.log("State is MISMATCHED.");
        }
    }
}
