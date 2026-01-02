// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";

interface ILaunchpadEngine {
    function registerGraduatedMarketInTickBook(address market) external;
}

/**
 * @title RegisterTickBookViaLaunchpad
 * @notice Register graduated markets in TickBook via LaunchpadEngine
 * @dev Must be called by LaunchpadEngine owner (0xEfdB15EE6e7C7C7906cb230AfF1EDb75CcBaA74F)
 */
contract RegisterTickBookViaLaunchpad is Script {
    // Current V9 LaunchpadEngine
    address constant LAUNCHPAD = 0x7a886fc43508A37f7F5467AC7460F72C578Da19B;
    
    // ALIEN Market
    address constant ALIEN_MARKET = 0xA428556d84374A92dde26B87a3cd607cE94Af91B;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Registering ALIEN market in TickBook via LaunchpadEngine...");
        console.log("LaunchpadEngine:", LAUNCHPAD);
        console.log("Market:", ALIEN_MARKET);
        console.log("Caller:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        ILaunchpadEngine(LAUNCHPAD).registerGraduatedMarketInTickBook(ALIEN_MARKET);
        
        console.log("Success!");

        vm.stopBroadcast();
    }
}
