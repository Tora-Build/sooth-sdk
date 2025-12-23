// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";

import {OutcomeToken} from "../contracts/OutcomeToken.sol";
import {Collateralizer} from "../contracts/Collateralizer.sol";
import {AMMEngine} from "../contracts/AMMEngine.sol";
import {TickBook} from "../contracts/TickBook.sol";
import {LaunchpadEngine} from "../contracts/LaunchpadEngine.sol";
import {TruthMarket} from "../contracts/TruthMarket.sol";

contract DeployV8 is Script {
    // Deployment addresses (will be populated)
    address public collateralizer;
    address public ammEngine;
    address public tickBook;
    address public launchpadEngine;
    
    // Configuration
    address public usdc;
    address public guardian;
    address public defaultAdjudicator;
    
    function setUp() public {
        // Load from environment
        usdc = vm.envAddress("USDC_ADDRESS");
        guardian = vm.envAddress("GUARDIAN_ADDRESS");
        defaultAdjudicator = vm.envAddress("DEFAULT_ADJUDICATOR");
        
        require(usdc != address(0), "USDC address required");
        require(guardian != address(0), "Guardian address required");
        require(defaultAdjudicator != address(0), "Default adjudicator required");
    }
    
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("=== V8 Deployment ===");
        console.log("Deployer:", deployer);
        console.log("USDC:", usdc);
        console.log("Guardian:", guardian);
        console.log("Default Adjudicator:", defaultAdjudicator);
        console.log("");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 1. Deploy Collateralizer (no OutcomeToken implementation needed - creates tokens dynamically)
        console.log("1. Deploying Collateralizer...");
        collateralizer = address(new Collateralizer(usdc));
        console.log("   Collateralizer:", collateralizer);
        
        // 2. Deploy AMMEngine
        console.log("2. Deploying AMMEngine...");
        ammEngine = address(new AMMEngine(usdc));
        console.log("   AMMEngine:", ammEngine);
        
        // 3. Deploy TickBook
        console.log("3. Deploying TickBook...");
        tickBook = address(new TickBook());
        console.log("   TickBook:", tickBook);
        
        // 4. Deploy LaunchpadEngine
        console.log("4. Deploying LaunchpadEngine...");
        launchpadEngine = address(new LaunchpadEngine(
            usdc,
            ammEngine,
            collateralizer,
            deployer // Initial owner (can transfer later)
        ));
        console.log("   LaunchpadEngine:", launchpadEngine);
        
        vm.stopBroadcast();
        
        // Print summary
        console.log("");
        console.log("=== V8 Deployment Summary ===");
        console.log("Collateralizer:", collateralizer);
        console.log("AMMEngine:", ammEngine);
        console.log("TickBook:", tickBook);
        console.log("LaunchpadEngine:", launchpadEngine);
        console.log("============================");
        
        // Save to JSON
        string memory json = string.concat(
            '{\n',
            '  "collateralizer": "', vm.toString(collateralizer), '",\n',
            '  "ammEngine": "', vm.toString(ammEngine), '",\n',
            '  "tickBook": "', vm.toString(tickBook), '",\n',
            '  "launchpadEngine": "', vm.toString(launchpadEngine), '"\n',
            '}'
        );
        
        vm.writeFile("deployments/v8-latest.json", json);
        console.log("");
        console.log("Deployment saved to: deployments/v8-latest.json");
        console.log("");
        console.log("Next steps:");
        console.log("1. Verify contracts on block explorer");
        console.log("2. Deploy test market with DeployTestMarket.s.sol");
        console.log("3. Update frontend config");
    }
}
