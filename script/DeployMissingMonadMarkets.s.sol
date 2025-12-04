// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothInterfaces.sol";
import "../contracts/core/SoothVault.sol";
import "../contracts/core/SoothRiskManager.sol";
import "../contracts/core/SoothMarketFactory.sol";

/// @notice Deploy missing markets 2-5 on Monad Testnet
contract DeployMissingMonadMarkets is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        
        // Existing deployed contracts from deployments-monad.json
        address vaultAddr = 0x02672d30F6f08fA021d37539ba86fF4366aCdd31;
        address factoryAddr = 0x03B92b6A9C9B9B480964Cc82C8820249A9B13D4E;
        address riskManagerAddr = 0xD3BDA14BF62Aac1487283554b3Ddc22551783bA1;
        
        vm.startBroadcast(deployerKey);
        
        console2.log("\n=== DEPLOYING MISSING MONAD MARKETS ===");
        console2.log("Deployer:", deployer);
        console2.log("Factory:", factoryAddr);
        
        SoothVault vault = SoothVault(vaultAddr);
        SoothMarketFactory factory = SoothMarketFactory(factoryAddr);
        SoothRiskManager riskManager = SoothRiskManager(riskManagerAddr);
        
        // Adjudicator IDs (same as original deployment)
        bytes32[] memory adjIds = new bytes32[](4);
        adjIds[0] = keccak256("CHAINLINK_FUNCTIONS");
        adjIds[1] = keccak256("TELLOR_ORACLE");
        adjIds[2] = keccak256("MULTISIG_COMMITTEE");
        adjIds[3] = keccak256("GOVERNANCE_VOTE");
        
        // Risk classes
        SoothRiskManager.RiskClass[] memory risks = new SoothRiskManager.RiskClass[](4);
        risks[0] = SoothRiskManager.RiskClass.LOW;
        risks[1] = SoothRiskManager.RiskClass.MEDIUM;
        risks[2] = SoothRiskManager.RiskClass.HIGH;
        risks[3] = SoothRiskManager.RiskClass.CRITICAL;
        
        string[] memory names = new string[](4);
        names[0] = "ETH Gas Market";
        names[1] = "Monad Launch Market";
        names[2] = "Sooth TVL Market";
        names[3] = "Monad Top 10 Market";
        
        address[] memory marketAddresses = new address[](4);
        uint256[] memory marketIds = new uint256[](4);
        
        for (uint256 i = 0; i < 4; i++) {
            console2.log("\n--- Creating Market ID:", i + 2);
            console2.log("Name:", names[i]);
            
            SoothMarket market = factory.createMarket(adjIds[i], risks[i]);
            marketAddresses[i] = address(market);
            marketIds[i] = market.marketId();
            
            // Authorize market on vault
            vault.setAuthorized(address(market), true);
            
            console2.log("Market Address:", address(market));
            console2.log("Market ID:", marketIds[i]);
            console2.log("Risk Class:", uint8(risks[i]));
            
            uint256 bMarket = riskManager.getBForMarket(marketIds[i]);
            console2.log("b parameter:", bMarket / 1e18, "mUSDC");
        }
        
        vm.stopBroadcast();
        
        // Generate updated markets-monad.json
        console2.log("\n=== GENERATING UPDATED markets-monad.json ===");
        
        string memory json = "[";
        
        // Market 1 (already exists)
        json = string.concat(json, "{");
        json = string.concat(json, "\"id\":1,");
        json = string.concat(json, "\"address\":\"0x532bCD52FD7c6E582E572490949655A340229E51\",");
        json = string.concat(json, "\"name\":\"BTC Price Market\",");
        json = string.concat(json, "\"description\":\"Will BTC price exceed $100k by Dec 31?\",");
        json = string.concat(json, "\"adjudicator\":\"UMA Optimistic Oracle\",");
        json = string.concat(json, "\"riskClass\":0,");
        json = string.concat(json, "\"bMarket\":43281000000000000000000");
        json = string.concat(json, "}");
        
        // Markets 2-5 (newly deployed)
        string[] memory descriptions = new string[](4);
        descriptions[0] = "Will ETH gas exceed 100 gwei average?";
        descriptions[1] = "Will Monad mainnet launch in Q1 2026?";
        descriptions[2] = "Will Sooth Protocol TVL exceed $10M?";
        descriptions[3] = "Will Monad become top 10 L1 by TVL?";
        
        string[] memory adjNames = new string[](4);
        adjNames[0] = "Chainlink Functions";
        adjNames[1] = "Tellor Oracle";
        adjNames[2] = "Multisig Committee";
        adjNames[3] = "Governance Vote";
        
        for (uint256 i = 0; i < 4; i++) {
            json = string.concat(json, ",{");
            json = string.concat(json, "\"id\":", vm.toString(marketIds[i]), ",");
            json = string.concat(json, "\"address\":\"", vm.toString(marketAddresses[i]), "\",");
            json = string.concat(json, "\"name\":\"", names[i], "\",");
            json = string.concat(json, "\"description\":\"", descriptions[i], "\",");
            json = string.concat(json, "\"adjudicator\":\"", adjNames[i], "\",");
            json = string.concat(json, "\"riskClass\":", vm.toString(uint8(risks[i])), ",");
            uint256 bMarket = riskManager.getBForMarket(marketIds[i]);
            json = string.concat(json, "\"bMarket\":", vm.toString(bMarket));
            json = string.concat(json, "}");
        }
        
        json = string.concat(json, "]");
        
        vm.writeFile("markets-monad-updated.json", json);
        console2.log("\nWrote: markets-monad-updated.json");
        console2.log("\n=== DEPLOYMENT COMPLETE ===");
    }
}
