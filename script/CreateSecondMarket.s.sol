// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothMarketFactory.sol";
import "../contracts/core/SoothRiskManager.sol";

/// @notice Simple script to create a second market in the same risk class
/// @dev Run with: forge script script/CreateSecondMarket.s.sol:CreateSecondMarket --rpc-url <RPC_URL> --broadcast
contract CreateSecondMarket is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        
        // Read deployments.json to get factory address
        string memory deploymentsJson = vm.readFile("deployments.json");
        address factoryAddress = vm.parseJsonAddress(deploymentsJson, ".SoothMarketFactory");
        
        SoothMarketFactory factory = SoothMarketFactory(factoryAddress);

        // Use the same adjudicator ID as the first market (DUMMY_ADJ)
        bytes32 adjudicatorId = keccak256("DUMMY_ADJ");
        
        // Create market in MEDIUM risk class (same as the first market)
        SoothRiskManager.RiskClass riskClass = SoothRiskManager.RiskClass.MEDIUM;

        vm.startBroadcast(deployerKey);

        SoothMarket newMarket = factory.createMarket(adjudicatorId, riskClass);
        
        console2.log("=== Second Market Created ===");
        console2.log("Market Address:", address(newMarket));
        console2.log("Market ID:", newMarket.marketId());
        console2.log("Risk Class: MEDIUM");
        console2.log("Adjudicator ID:");
        console2.logBytes32(adjudicatorId);
        
        // Get market details
        (int256 qYes, int256 qNo) = newMarket.ammState();
        console2.log("Initial qYes:", uint256(qYes));
        console2.log("Initial qNo:", uint256(qNo));

        vm.stopBroadcast();

        // Update deployments.json to include the second market
        string memory json = vm.readFile("deployments.json");
        
        // Parse existing deployments
        address mockERC20 = vm.parseJsonAddress(json, ".MockERC20");
        address vault = vm.parseJsonAddress(json, ".SoothVault");
        address riskManager = vm.parseJsonAddress(json, ".SoothRiskManager");
        address balancedAMM = vm.parseJsonAddress(json, ".SoothBalancedAMM");
        address lmsrReal = vm.parseJsonAddress(json, ".SoothLMSRReal");
        address adjRegistry = vm.parseJsonAddress(json, ".SoothAdjudicatorRegistry");
        address settlement = vm.parseJsonAddress(json, ".SoothSettlement");
        address exampleMarket = vm.parseJsonAddress(json, ".ExampleMarket");

        // Build new JSON with second market
        string memory newJson = "{";
        newJson = string.concat(newJson, "\"MockERC20\": \"", vm.toString(mockERC20), "\",");
        newJson = string.concat(newJson, "\"SoothVault\": \"", vm.toString(vault), "\",");
        newJson = string.concat(newJson, "\"SoothRiskManager\": \"", vm.toString(riskManager), "\",");
        newJson = string.concat(newJson, "\"SoothBalancedAMM\": \"", vm.toString(balancedAMM), "\",");
        newJson = string.concat(newJson, "\"SoothLMSRReal\": \"", vm.toString(lmsrReal), "\",");
        newJson = string.concat(newJson, "\"SoothAdjudicatorRegistry\": \"", vm.toString(adjRegistry), "\",");
        newJson = string.concat(newJson, "\"SoothSettlement\": \"", vm.toString(settlement), "\",");
        newJson = string.concat(newJson, "\"SoothMarketFactory\": \"", vm.toString(factoryAddress), "\",");
        newJson = string.concat(newJson, "\"ExampleMarket\": \"", vm.toString(exampleMarket), "\",");
        newJson = string.concat(newJson, "\"SecondMarket\": \"", vm.toString(address(newMarket)), "\"");
        newJson = string.concat(newJson, "}");

        vm.writeFile("deployments.json", newJson);
        console2.log("\nUpdated deployments.json with SecondMarket");
    }
}
