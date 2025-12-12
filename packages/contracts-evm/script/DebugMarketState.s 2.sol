// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothMarketV4.sol";

contract DebugMarketState is Script {
    function run() external view {
        address marketAddress = 0xFf38c86Ac7481b298F2196Cca553685bAE385977;
        address expectedVault = 0xAd461C1c55bf552756Ad29Ac96f341A1fC007176;

        SoothMarketV4 market = SoothMarketV4(marketAddress);
        
        address currentVault = market.traderVault();
        address owner = market.owner();
        
        console.log("Market Address:", marketAddress);
        console.log("Stored TraderVault:", currentVault);
        console.log("Expected TraderVault:", expectedVault);
        console.log("Market Owner:", owner);
        
        if (currentVault == expectedVault) {
            console.log("State is CORRECT.");
        } else {
            console.log("State is MISMATCHED.");
        }
    }
}
