// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothMarketV4.sol";
import "../contracts/core/OutcomeToken.sol";

/// @title Step1_DeployContracts
/// @notice Deploy Market and OutcomeToken contracts only
contract Step1_DeployContracts is Script {
    function run() external {
        vm.startBroadcast();
        
        OutcomeToken outcomeToken = new OutcomeToken();
        SoothMarketV4 market = new SoothMarketV4();
        
        console.log("=== Step 1 Complete ===");
        console.log("Market:", address(market));
        console.log("OutcomeToken:", address(outcomeToken));
        console.log("");
        console.log("Save these addresses for Step 2!");
        
        vm.stopBroadcast();
    }
}
