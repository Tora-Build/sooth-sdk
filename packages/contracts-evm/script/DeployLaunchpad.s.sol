// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {LaunchpadFactory} from "../contracts/launchpad/LaunchpadFactory.sol";
import {LaunchpadMarket} from "../contracts/launchpad/LaunchpadMarket.sol";
import {LaunchpadOutcomeToken} from "../contracts/launchpad/LaunchpadOutcomeToken.sol";
import {SoothTraderVaultV4} from "../contracts/core/SoothTraderVaultV4.sol";
import {SoothFeeController} from "../contracts/core/SoothFeeController.sol";
import {SoothGovernorVault} from "../contracts/core/SoothGovernorVault.sol";

contract DeployLaunchpad is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Load existing deployments from env or hardcoded addresses?
        // Ideally reads from deployments.json but in script we usually hardcode or read env.
        // For verify, we'll fetch them or deploying everything fresh for dev.
        // Assuming we rely on existing Core:
        address usdc = 0x53d34066A316AE1699d434753B70593A6D59Fec1;
        address traderVault = 0xa8aDE73124B3256F98f510F6A9E7C1e3Aa71d20B;
        address feeController = 0x1a646107e7E88aa01Fadff3145Af08156679198e;
        address globalGovernor = 0x2A2DfA1B3B3F4db798b759d07064Bb800BD10fB1;
        address outcomeTokenImpl = address(new LaunchpadOutcomeToken()); // Deploy new logic or usage

        // Deploy Implementation
        LaunchpadMarket marketImpl = new LaunchpadMarket();
        
        // Deploy Factory
        LaunchpadFactory factory = new LaunchpadFactory(
            address(marketImpl),
            usdc,
            traderVault,
            globalGovernor,
            feeController,
            outcomeTokenImpl,
            msg.sender, // Treasury
            msg.sender  // Adjudicator
        );

        console.log("LaunchpadMarket Impl:", address(marketImpl));
        console.log("LaunchpadFactory:", address(factory));

        vm.stopBroadcast();
    }
}
