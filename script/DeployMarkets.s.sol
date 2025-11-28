// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothMarketFactory.sol";
import "../contracts/core/SoothRiskManager.sol";

contract DeployMarkets is Script {
    struct MarketConfig {
        string question;
        string[] outcomes;
        string riskClass;
        bytes32 adjudicatorId;
    }

    function parseRiskClass(string memory riskClassStr) internal pure returns (SoothRiskManager.RiskClass) {
        bytes32 hash = keccak256(bytes(riskClassStr));
        if (hash == keccak256(bytes("LOW"))) {
            return SoothRiskManager.RiskClass.LOW;
        } else if (hash == keccak256(bytes("MEDIUM"))) {
            return SoothRiskManager.RiskClass.MEDIUM;
        } else if (hash == keccak256(bytes("HIGH"))) {
            return SoothRiskManager.RiskClass.HIGH;
        } else if (hash == keccak256(bytes("CRITICAL"))) {
            return SoothRiskManager.RiskClass.CRITICAL;
        } else {
            revert(string.concat("Invalid risk class: ", riskClassStr));
        }
    }

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        
        // Read deployments.json to get factory address
        string memory deploymentsJson = vm.readFile("deployments.json");
        address factoryAddress = vm.parseJsonAddress(deploymentsJson, ".SoothMarketFactory");
        SoothMarketFactory factory = SoothMarketFactory(factoryAddress);

        // Read markets.json
        string memory marketsJson = vm.readFile("markets.json");
        MarketConfig[] memory markets = abi.decode(vm.parseJson(marketsJson), (MarketConfig[]));

        vm.startBroadcast(deployerKey);

        for (uint256 i = 0; i < markets.length; i++) {
            SoothRiskManager.RiskClass riskClass = parseRiskClass(markets[i].riskClass);
            SoothMarket market = factory.createMarket(markets[i].adjudicatorId, riskClass);
            
            console2.log("Created market for question:", markets[i].question);
            console2.log("Market address:", address(market));
        }

        vm.stopBroadcast();
    }
}
