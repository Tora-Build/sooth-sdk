// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import {LaunchpadFactory} from "../contracts/launchpad/LaunchpadFactory.sol";
import {LaunchpadMarket} from "../contracts/launchpad/LaunchpadMarket.sol";
import {LaunchpadOutcomeToken} from "../contracts/launchpad/LaunchpadOutcomeToken.sol";
import {SoothTraderVaultV4} from "../contracts/core/SoothTraderVaultV4.sol";
import {SoothFeeController} from "../contracts/core/SoothFeeController.sol";
import {SoothLiquidityVault} from "../contracts/core/SoothLiquidityVault.sol";
import {ProtocolConfig} from "../contracts/core/ProtocolConfig.sol";
import {SoothAdjudicatorRegistry} from "../contracts/core/SoothAdjudicatorRegistry.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DeployV5Upgrade is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Core dependecies
        address usdc = 0x53d34066A316AE1699d434753B70593A6D59Fec1;
        address globalGovernor = 0x2A2DfA1B3B3F4db798b759d07064Bb800BD10fB1;
        address feeController = 0x1a646107e7E88aa01Fadff3145Af08156679198e;
        // Treasury/Adjudicator = deployer for now
        address treasury = 0xEfdB15EE6e7C7C7906cb230AfF1EDb75CcBaA74F;
        address adjudicator = 0xEfdB15EE6e7C7C7906cb230AfF1EDb75CcBaA74F;

        // 1. Deploy NEW TraderVault V4 (Implementation)
        SoothTraderVaultV4 traderVault = new SoothTraderVaultV4(
            IERC20(usdc),
            SoothLiquidityVault(globalGovernor)
        );
        console.log("New TraderVault:", address(traderVault));

        // 2. Deploy NEW Market Implemenation & OutcomeToken
        LaunchpadOutcomeToken tokenImpl = new LaunchpadOutcomeToken();
        LaunchpadMarket marketImpl = new LaunchpadMarket();
        console.log("OutcomeToken Impl:", address(tokenImpl));
        console.log("Market Impl:", address(marketImpl));

        // 3a. Deploy mutable config + adjudicator allowlist
        ProtocolConfig protocolConfig = new ProtocolConfig(adjudicator, 0);
        SoothAdjudicatorRegistry registry = new SoothAdjudicatorRegistry(adjudicator);
        registry.setAdjudicator(adjudicator, 1, true, bytes32(0));

        // 3. Deploy NEW LaunchpadFactory (linked to new TraderVault)
        LaunchpadFactory factory = new LaunchpadFactory(
            address(marketImpl),
            usdc,
            address(traderVault),
            feeController,
            address(tokenImpl),
            treasury,
            adjudicator,
            address(registry),
            address(protocolConfig)
        );
        console.log("New LaunchpadFactory:", address(factory));

        // 4. Configure TraderVault to trust Factory
        traderVault.setLaunchpadFactory(address(factory));
        console.log("Linked Vault to Factory");

        vm.stopBroadcast();
    }
}
