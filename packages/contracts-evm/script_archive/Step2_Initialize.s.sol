// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothMarketV4.sol";
import "../contracts/core/OutcomeToken.sol";

/// @title Step2_Initialize
/// @notice Initialize the deployed contracts
contract Step2_Initialize is Script {
    // From Step 1
    address constant MARKET = 0x7FA9385bE102ac3EAc297483Dd6233D62b3e1496;
    address constant OUTCOME_TOKEN = 0x5b73C5498c1E3b4dbA84de0F1833c4a029d90519;
    
    // Infrastructure  
    address constant TRADER_VAULT = 0xee91e05f95cBaACD46f58432DF72CB5C451e98E0;
    address constant GOVERNOR_VAULT = 0x0C96BcCa40f5D45D0a000C91276E3b5ac3A45e6f;
    address constant FEE_CONTROLLER = 0xa367B312Ca1845B7c6076345cB5cd529F935B4FA;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Initialize OutcomeToken
        OutcomeToken(OUTCOME_TOKEN).initialize(MARKET, TRADER_VAULT);
        console.log("OutcomeToken initialized");
        
        // Initialize Market
        SoothMarketV4(MARKET).initialize(
            1,                      // marketId
            GOVERNOR_VAULT,
            TRADER_VAULT,
            FEE_CONTROLLER,
            OUTCOME_TOKEN,
            bytes32(0),            // adjudicatorId
            10_000 * 1e18,         // bBase = 10k
            deployer,              // governor
            500                    // initial tick (50%)
        );
        console.log("Market initialized");
        
        console.log("");
        console.log("=== Step 2 Complete ===");
        console.log("Ready for Step 3 (permissions)");
        
        vm.stopBroadcast();
    }
}
