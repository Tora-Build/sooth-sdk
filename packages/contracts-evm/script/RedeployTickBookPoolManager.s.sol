// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../contracts/TickBookPoolManager.sol";

/**
 * @title RedeployTickBookPoolManager
 * @notice Redeploys TickBookPoolManager with getPendingFills function
 *         and updates the registrar to point to LaunchpadEngine
 */
contract RedeployTickBookPoolManager is Script {
    function run() external {
        // Existing addresses from V9.4.0 deployment
        address tickBookVault = 0x9733E1641DEEF3cC810F8635697288C36a8ff966;
        address launchpadEngine = 0xD44eF417a6124031DB529B14AB279A36Caeb4338;
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Deploy new TickBookPoolManager
        TickBookPoolManager newPoolManager = new TickBookPoolManager(tickBookVault);
        console.log("New TickBookPoolManager deployed at:", address(newPoolManager));
        
        // Set registrar to LaunchpadEngine
        newPoolManager.setRegistrar(launchpadEngine);
        console.log("Registrar set to LaunchpadEngine:", launchpadEngine);
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("=== IMPORTANT ===");
        console.log("Update these addresses in frontend:");
        console.log("  TickBookPoolManager:", address(newPoolManager));
        console.log("");
        console.log("NOTE: Existing markets from old PoolManager won't transfer.");
        console.log("You need to re-graduate markets or re-register them.");
    }
}
