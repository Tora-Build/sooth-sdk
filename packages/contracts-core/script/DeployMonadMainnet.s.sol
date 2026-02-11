// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {TickBookPoolManager} from "../src/TickBookPoolManager.sol";
import {TickBookVault} from "../src/TickBookVault.sol";
import {AMMEngine} from "../src/AMMEngine.sol";
import {Collateralizer} from "../src/Collateralizer.sol";
import {LaunchpadEngine} from "../src/LaunchpadEngine.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {ProtocolConfig} from "../src/ProtocolConfig.sol";
import {ValidatedAdjudicator} from "../src/ValidatedAdjudicator.sol";

/**
 * @title DeployMonadMainnet
 * @notice Deploy Sooth Protocol to Monad Mainnet (Chain ID: 143)
 * 
 * Usage:
 *   export PRIVATE_KEY=0x...
 *   forge script script/DeployMonadMainnet.s.sol --rpc-url https://rpc.monad.xyz --broadcast --profile monad
 */
contract DeployMonadMainnet is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("========================================");
        console.log("  MONAD MAINNET DEPLOYMENT - SOOTH");
        console.log("========================================");
        console.log("Chain ID: 143");
        console.log("Deployer:", deployer);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy MockUSDC
        MockUSDC mockUSDC = new MockUSDC("Sooth USD", "sUSDC");
        console.log("[1/8] MockUSDC:", address(mockUSDC));

        // 2. Deploy ProtocolConfig
        ProtocolConfig protocolConfig = new ProtocolConfig(deployer);
        console.log("[2/8] ProtocolConfig:", address(protocolConfig));

        // 3. Deploy Collateralizer
        Collateralizer collateralizer = new Collateralizer(address(mockUSDC));
        console.log("[3/8] Collateralizer:", address(collateralizer));

        // 4. Deploy AMMEngine
        AMMEngine ammEngine = new AMMEngine(address(mockUSDC), address(protocolConfig), deployer);
        console.log("[4/8] AMMEngine:", address(ammEngine));

        // 5. Deploy TickBookVault
        TickBookVault vault = new TickBookVault(address(mockUSDC), address(protocolConfig), deployer);
        console.log("[5/8] TickBookVault:", address(vault));

        // 6. Deploy TickBookPoolManager
        TickBookPoolManager poolManager = new TickBookPoolManager(address(vault), address(protocolConfig));
        console.log("[6/8] TickBookPoolManager:", address(poolManager));

        // Link vault to pool manager
        vault.setTickBook(address(poolManager));
        console.log("      -> Vault linked to PoolManager");

        // 7. Deploy LaunchpadEngine
        LaunchpadEngine launchpad = new LaunchpadEngine(
            address(mockUSDC),
            address(ammEngine),
            address(collateralizer),
            address(poolManager),
            address(protocolConfig),
            deployer,  // treasury
            deployer   // owner
        );
        console.log("[7/8] LaunchpadEngine:", address(launchpad));

        // Configure permissions
        ammEngine.setRouter(address(launchpad));
        console.log("      -> AMMEngine router set to LaunchpadEngine");

        poolManager.setRegistrar(address(launchpad));
        console.log("      -> PoolManager registrar set to LaunchpadEngine");

        // 8. Deploy ValidatedAdjudicator
        // ValidationRegistry = deployer (placeholder), 1 day window, min score 0
        ValidatedAdjudicator adjudicator = new ValidatedAdjudicator(deployer, 86400, 0, deployer);
        console.log("[8/8] ValidatedAdjudicator:", address(adjudicator));

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("  DEPLOYMENT COMPLETE");
        console.log("========================================");
        console.log("MockUSDC:           ", address(mockUSDC));
        console.log("ProtocolConfig:     ", address(protocolConfig));
        console.log("Collateralizer:     ", address(collateralizer));
        console.log("AMMEngine:          ", address(ammEngine));
        console.log("TickBookVault:      ", address(vault));
        console.log("TickBookPoolManager:", address(poolManager));
        console.log("LaunchpadEngine:    ", address(launchpad));
        console.log("ValidatedAdjudicator:", address(adjudicator));
    }
}
