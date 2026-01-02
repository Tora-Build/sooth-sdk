// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ILaunchpadEngine} from "@core/interfaces/ILaunchpadEngine.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract InitializeMarkets is Script {
    function run() external {
        address LAUNCHPAD_ENGINE = 0x7a886fc43508A37f7F5467AC7460F72C578Da19B;
        address USDC = 0x0C31bBb6dA82ba97fBAFbE3325Ee8757A4D724e3;
        address ALIEN_MARKET = 0xA428556d84374A92dde26B87a3cd607cE94Af91B;
        address BTC100K_MARKET = 0x82AFbBAD7eb0439131588f60487192E1e93bD81D;

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        // Approve LaunchpadEngine for USDC
        uint256 depositPerMarket = 1000 * 693147180559945309; 
        vm.broadcast(deployerPrivateKey);
        IERC20(USDC).approve(LAUNCHPAD_ENGINE, depositPerMarket * 3);

        // 1. ALIEN Market
        vm.broadcast(deployerPrivateKey);
        ILaunchpadEngine(LAUNCHPAD_ENGINE).createMarket(
            ALIEN_MARKET,
            1000e18, 
            "UN Confirms Alien Life",
            "ALIEN"
        );

        // 2. BTC100K Market
        vm.broadcast(deployerPrivateKey);
        ILaunchpadEngine(LAUNCHPAD_ENGINE).createMarket(
            BTC100K_MARKET,
            1000e18,
            "BTC TWAP >= $100k",
            "BTC100K"
        );
        
        console2.log("Market initialization complete.");
    }
}
