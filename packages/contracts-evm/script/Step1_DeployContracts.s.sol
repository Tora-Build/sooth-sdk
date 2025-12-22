// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/launchpad/LaunchpadMarket.sol";
import "../contracts/launchpad/LaunchpadOutcomeToken.sol";

/// @title Step1_DeployContracts
/// @notice Deploy Launchpad Market implementation and LaunchpadOutcomeToken implementation
/// @dev These are used as templates by LaunchpadFactory
contract Step1_DeployContracts is Script {
    function run() external {
        vm.startBroadcast();
        
        LaunchpadOutcomeToken outcomeTokenImpl = new LaunchpadOutcomeToken();
        LaunchpadMarket marketImpl = new LaunchpadMarket();
        
        console.log("=== Step 1 Complete ===");
        console.log("MarketImpl:", address(marketImpl));
        console.log("OutcomeTokenImpl:", address(outcomeTokenImpl));
        console.log("");
        console.log("Save these addresses for Factory deployment!");
        
        vm.stopBroadcast();
    }
}
