// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothTraderVaultV4.sol";

/// @notice One-time script to register OutcomeTokens after V4.5 contract update
contract SetOutcomeTokens is Script {
    // V4.4 TraderVault
    address constant TRADER_VAULT = 0x9fcE1d647B9b1B0195a78b5AC3f12487e16f911E;
    
    // V4.4 OutcomeTokens
    address constant OUTCOME_TOKEN_1 = 0x3032b400948aE872Fc3d6f2eCda207bf9fAe4ae1; // Alien Life
    address constant OUTCOME_TOKEN_2 = 0x649359bA4EB1D64057d428976976CD2090F27f46; // BTC TWAP

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        SoothTraderVaultV4 traderVault = SoothTraderVaultV4(TRADER_VAULT);
        
        console.log("Setting OutcomeTokens on TraderVault:", TRADER_VAULT);
        
        traderVault.setOutcomeToken(OUTCOME_TOKEN_1, true);
        console.log("  Registered:", OUTCOME_TOKEN_1);
        
        traderVault.setOutcomeToken(OUTCOME_TOKEN_2, true);
        console.log("  Registered:", OUTCOME_TOKEN_2);
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("=== OutcomeTokens Registered ===");
    }
}
