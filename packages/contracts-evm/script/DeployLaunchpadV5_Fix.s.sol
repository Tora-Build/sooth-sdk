// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {LaunchpadFactory} from "../contracts/launchpad/LaunchpadFactory.sol";
import {LaunchpadMarket} from "../contracts/launchpad/LaunchpadMarket.sol";
import {LaunchpadOutcomeToken} from "../contracts/launchpad/LaunchpadOutcomeToken.sol";
import {SoothTraderVaultV4} from "../contracts/core/SoothTraderVaultV4.sol";
import {ProtocolConfig} from "../contracts/core/ProtocolConfig.sol";
import {SoothAdjudicatorRegistry} from "../contracts/core/SoothAdjudicatorRegistry.sol";

contract DeployLaunchpadV5_Fix is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Core Constants (Base Sepolia)
        address usdc = 0x53d34066A316AE1699d434753B70593A6D59Fec1;
        address traderVault = 0x80dbB5604579B9d23E6FF092A97Eea05B176C528; // NEW V4.7 Vault
        address feeController = 0x1a646107e7E88aa01Fadff3145Af08156679198e;

        // 1. Deploy Implementations
        LaunchpadOutcomeToken outcomeTokenImpl = new LaunchpadOutcomeToken();
        LaunchpadMarket marketImpl = new LaunchpadMarket();
        ProtocolConfig protocolConfig = new ProtocolConfig(msg.sender, 0);
        SoothAdjudicatorRegistry registry = new SoothAdjudicatorRegistry(msg.sender);
        registry.setAdjudicator(msg.sender, 1, true, bytes32(0));
        
        // 2. Deploy Factory
        LaunchpadFactory factory = new LaunchpadFactory(
            address(marketImpl),
            usdc,
            traderVault,
            feeController,
            address(outcomeTokenImpl),
            msg.sender, // Treasury
            msg.sender, // Default Adjudicator
            address(registry),
            address(protocolConfig)
        );

        console.log("LaunchpadMarket Impl:", address(marketImpl));
        console.log("LaunchpadOutcomeToken Impl:", address(outcomeTokenImpl));
        console.log("LaunchpadFactory:", address(factory));

        // 3. Configure TraderVault to trust the new Factory
        // This is crucial for _isValidMarket check to pass
        console.log("Configuring TraderVault to trust Factory...");
        SoothTraderVaultV4(traderVault).setLaunchpadFactory(address(factory));

        vm.stopBroadcast();
    }
}
