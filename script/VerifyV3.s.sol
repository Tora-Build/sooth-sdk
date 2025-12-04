// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothMarket.sol";
import "../contracts/core/SoothTraderVault.sol";

/// @notice Script to verify v3 deployment status on Base Sepolia
contract VerifyV3 is Script {
    address constant MARKET = 0x222948d53B75ED5ef06844ABc8B01dEe557E4945;
    address constant TRADER_VAULT = 0x8B8c1F0711e5A78F1Fe7ba174eB47eb58880293b;
    
    function run() external view {
        SoothMarket market = SoothMarket(MARKET);
        SoothTraderVault vault = SoothTraderVault(TRADER_VAULT);
        
        console.log("=== Market Status ===");
        console.log("Address:", address(market));
        console.log("Is Live:", market.isLive());
        console.log("Is Settled:", market.isSettled());
        console.log("Market ID:", market.marketId());
        console.log("b (liquidity):", market.b());
        
        // Get AMM state directly
        console.log("qYes:", uint256(market.ammState().qYes));
        console.log("qNo:", uint256(market.ammState().qNo));
        
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
    }
}
