// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothMarket.sol";
import "../contracts/core/SoothTraderVault.sol";

    /// @notice Script to verify deployment status on Base Sepolia
    contract Verify is Script {
    address constant MARKET = 0xB2f1d1ebae053cC645055448150c2A11214884E5;
    address constant TRADER_VAULT = 0xA610975CC06de01456a36bD27390D12d5E4B6629;
    
    function run() external view {
        SoothMarket market = SoothMarket(MARKET);
        SoothTraderVault vault = SoothTraderVault(TRADER_VAULT);
        
        console.log("=== Market Status ===");
        console.log("Address:", address(market));
        console.log("Is Live:", market.isLive());
        console.log("Is Settled:", market.isSettled());
        console.log("Market ID:", market.marketId());
        console.log("b (liquidity):", market.bBase());
        
        // Get Tick state directly
        uint16 tick = market.currentTick();
        console.log("Current Tick:", tick);
        
        console.log("\n=== TraderVault Status ===");
        console.log("Address:", address(vault));
        console.log("Asset:", vault.asset());
        console.log("Is Market Enabled:", vault.isMarket(MARKET));
        
        address gov = address(vault.governorVault());
        console.log("Governor Vault:", gov);
        
        console.log("\n=== Prices ===");
        try market.getPrice(0) returns (uint256 yesPrice) {
            console.log("YES Price:", yesPrice);
        } catch {
            console.log("YES Price: ERROR");
        }
        
        try market.getPrice(1) returns (uint256 noPrice) {
            console.log("NO Price:", noPrice);
        } catch {
            console.log("NO Price: ERROR");
        }

        console.log("\n=== Orderbook Status ===");
        try market.bestOrder(0) returns (uint256 bestYes) {
            console.log("bestOrder(0):", bestYes);
        } catch {
            console.log("bestOrder(0): ERROR");
        }
    }
}
