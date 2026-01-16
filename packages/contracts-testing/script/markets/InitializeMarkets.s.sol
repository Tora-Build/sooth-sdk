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

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        uint64 startTime = uint64(block.timestamp);
        uint256 depositPerMarket = 1000 * 693147180559945309;

        vm.broadcast(deployerPrivateKey);
        IERC20(USDC).approve(LAUNCHPAD_ENGINE, depositPerMarket * 3);

        vm.broadcast(deployerPrivateKey);
        ILaunchpadEngine(LAUNCHPAD_ENGINE).createMarket(
            "UN Confirms Alien Life",
            startTime,
            uint64(block.timestamp + 365 days),
            deployer,
            deployer,
            1000e18
        );

        vm.broadcast(deployerPrivateKey);
        ILaunchpadEngine(LAUNCHPAD_ENGINE).createMarket(
            "BTC TWAP >= $100k",
            startTime,
            uint64(block.timestamp + 180 days),
            deployer,
            deployer,
            1000e18
        );

        console2.log("Market initialization complete.");
    }
}
