// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothMarketV4.sol";
import "../contracts/core/OutcomeToken.sol";
import "../contracts/core/SoothGovernorVault.sol";
import "../contracts/core/SoothTraderVaultV4.sol";

/// @title DeployV4Markets  
/// @notice Phase 2: Deploy markets using infrastructure from Phase 0 & 1
/// @dev Requires TickCostRegistry to be deployed and initialized first
contract DeployV4Markets is Script {
    // Phase 0 addresses (utilities - deployed 2025-12-09)
    address constant TICK_REGISTRY = 0xF8928d461BB54F5B8473A133DF1d77BC043Af605;
    address constant NEW_USDC = 0xa0eEa05Cc350Ac218683815e85Cac4A1a1eF36dd;
    
    // Phase 1 addresses (infrastructure - deployed 2025-12-12 V4.5 with OutcomeToken auth fix)
    address constant USDC = 0x3E45bf96a8D866D796E168eE77a5fA7507D544F1;
    address constant GOVERNOR_VAULT = 0xcB0f1305951d4BC6EF266790836aC62604cFA733;
    address constant TRADER_VAULT = 0x48Efb2434383E87a4a143D2B07BeE73611f5423C;
    address constant FEE_CONTROLLER = 0xE570Ab7dBbB58241F2cD7E1D3E2dD43196DAee97;
    
    function run() external {
        require(TICK_REGISTRY != address(0), "Set TICK_REGISTRY address first");
        
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Phase 2: Deploy V4 Markets ===");
        console.log("Using infrastructure:");
        console.log("  TickRegistry:", TICK_REGISTRY);
        console.log("  GovernorVault:", GOVERNOR_VAULT);
        console.log("  TraderVault:", TRADER_VAULT);

        SoothGovernorVault governorVault = SoothGovernorVault(GOVERNOR_VAULT);
        SoothTraderVaultV4 traderVault = SoothTraderVaultV4(TRADER_VAULT);

        // ===== MARKET 1: UN Confirms Alien Life =====
        
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
            0,                          // initialQYes (0 for 50% probability)
            0                           // initialQNo (0 for 50% probability)
        );
        
        traderVault.setMarket(address(market1), true);
        traderVault.setOutcomeToken(address(outcomeToken1), true);
        governorVault.setAuthorized(address(market1), true);
        
        console.log("");
        console.log("Market 1: UN Confirms Alien Life");
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
            0,                          // initialQYes (0 for 50% probability)
            0                           // initialQNo (0 for 50% probability)
        );
        
        traderVault.setMarket(address(market2), true);
        traderVault.setOutcomeToken(address(outcomeToken2), true);
        governorVault.setAuthorized(address(market2), true);
        
        console.log("");
        console.log("Market 2: BTC > $100k");
        console.log("  Market:", address(market2));
        console.log("  OutcomeToken:", address(outcomeToken2));

        vm.stopBroadcast();

        console.log("");
        console.log("=== V4 Markets Deployed ===");
        console.log("1. Alien Life:", address(market1));
        console.log("2. BTC > $100k:", address(market2));
    }
}
