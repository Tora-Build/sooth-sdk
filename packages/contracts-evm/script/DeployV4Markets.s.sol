// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothMarketV4.sol";
import "../contracts/core/OutcomeToken.sol";
import "../contracts/core/SoothGovernorVault.sol";
import "../contracts/core/SoothTraderVaultV4.sol";

/// @title DeployV4Markets  
/// @notice Phase 2: Deploy 2 markets using infrastructure from Phase 1
contract DeployV4Markets is Script {
    // Phase 1 addresses (from redeployment)
    address constant USDC = 0xd2C6903C7311C7EC6F2f09DA7A0d417A59CB04ab;
    address constant GOVERNOR_VAULT = 0x0C96BcCa40f5D45D0a000C91276E3b5ac3A45e6f;
    address constant TRADER_VAULT = 0xee91e05f95cBaACD46f58432DF72CB5C451e98E0;
    address constant FEE_CONTROLLER = 0xa367B312Ca1845B7c6076345cB5cd529F935B4FA;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Phase 2: Deploy V4 Markets ===");
        console.log("Using infrastructure:");
        console.log("  GovernorVault:", GOVERNOR_VAULT);
        console.log("  TraderVaultV4:", TRADER_VAULT);

        SoothGovernorVault governorVault = SoothGovernorVault(GOVERNOR_VAULT);
        SoothTraderVaultV4 traderVault = SoothTraderVaultV4(TRADER_VAULT);

        // ===== MARKET 1: Trump 2024 Win =====
        
        OutcomeToken outcomeToken1 = new OutcomeToken();
        SoothMarketV4 market1 = new SoothMarketV4();
        
        outcomeToken1.initialize(address(market1), TRADER_VAULT);
        
        market1.initialize(
            1,                          // marketId
            GOVERNOR_VAULT,
            TRADER_VAULT,
            FEE_CONTROLLER,
            address(outcomeToken1),
            bytes32(0),                 // adjudicatorId
            10_000 * 1e18,              // bBase = 10k
            deployer,                   // governor
            500                         // 50% initial tick
        );
        
        traderVault.setMarket(address(market1), true);
        governorVault.setAuthorized(address(market1), true);
        
        console.log("");
        console.log("Market 1: Trump 2024 Win");
        console.log("  Market:", address(market1));
        console.log("  OutcomeToken:", address(outcomeToken1));
        
        // ===== MARKET 2: BTC > $100k =====
        
        OutcomeToken outcomeToken2 = new OutcomeToken();
        SoothMarketV4 market2 = new SoothMarketV4();
        
        outcomeToken2.initialize(address(market2), TRADER_VAULT);
        
        market2.initialize(
            2,                          // marketId
            GOVERNOR_VAULT,
            TRADER_VAULT,
            FEE_CONTROLLER,
            address(outcomeToken2),
            bytes32(0),                 // adjudicatorId
            15_000 * 1e18,              // bBase = 15k (higher liquidity)
            deployer,                   // governor
            700                         // 70% initial tick (bullish)
        );
        
        traderVault.setMarket(address(market2), true);
        governorVault.setAuthorized(address(market2), true);
        
        console.log("");
        console.log("Market 2: BTC > $100k");
        console.log("  Market:", address(market2));
        console.log("  OutcomeToken:", address(outcomeToken2));

        vm.stopBroadcast();

        console.log("");
        console.log("=== V4 Markets Deployed ===");
        console.log("1. Trump 2024:", address(market1));
        console.log("2. BTC > $100k:", address(market2));
    }
}
