// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothMarketV4.sol";
import "../contracts/core/OutcomeToken.sol";
import "../contracts/core/SoothGovernorVault.sol";
import "../contracts/core/SoothTraderVaultV4.sol";

contract RedeployMarket2 is Script {
    // Correct Addresses from deployments.json
    address constant GOVERNOR_VAULT = 0x880bCcb111F39CF922b4A85481Ca2eE54507cdb5;
    address constant TRADER_VAULT = 0xAd461C1c55bf552756Ad29Ac96f341A1fC007176;
    address constant FEE_CONTROLLER = 0x2F7a6df471285Cc6893951a16fB67bdBaD026E46;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Redeploying Market 2 (BTC) ===");
        console.log("  TraderVault:", TRADER_VAULT);

        SoothGovernorVault governorVault = SoothGovernorVault(GOVERNOR_VAULT);
        SoothTraderVaultV4 traderVault = SoothTraderVaultV4(TRADER_VAULT);

        // ===== MARKET 2: BTC > $100k =====
        
        OutcomeToken outcomeToken2 = new OutcomeToken();
        SoothMarketV4 market2 = new SoothMarketV4();
        
        // Init Token with NEW Market and EXISTING Vault
        outcomeToken2.initialize(address(market2), TRADER_VAULT);
        
        // Init Market with EXISTING Vault
        market2.initialize(
            2,                          // marketId
            GOVERNOR_VAULT,
            TRADER_VAULT,
            FEE_CONTROLLER,
            address(outcomeToken2),
            bytes32(0),                 // adjudicatorId
            15_000 * 1e18,              // bBase = 15k
            deployer,                   // governor
            0,                          // initialQYes
            0                           // initialQNo
        );
        
        // Whitelist New Market in Vault
        traderVault.setMarket(address(market2), true);
        
        // Authorize New Market in Governor
        governorVault.setAuthorized(address(market2), true);
        
        console.log("");
        console.log("NEW Market 2: BTC > $100k");
        console.log("  Market:", address(market2));
        console.log("  OutcomeToken:", address(outcomeToken2));

        vm.stopBroadcast();
    }
}
