// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothMarket.sol";

/// @notice Script to check the status of Monad markets (IDs 2-5)
contract CheckMonadMarkets is Script {
    function run() external view {
        // Market addresses from markets-monad.json
        address[4] memory markets = [
            0xCDA07815143EDf950858960710D0DEB0d18cd9D4, // Market 2: ETH Gas
            0xDfD4752125D83B6F31c95280C1423090b3bf1c0D, // Market 3: Monad Launch
            0x349AF10164E70085b872020f4D6fa6702D040ce6, // Market 4: Sooth TVL
            0x112849fd9A34041c17C37DC735Ec7154e9Fe1299  // Market 5: Monad Top 10
        ];

        string[4] memory names = [
            "ETH Gas Market",
            "Monad Launch Market",
            "Sooth TVL Market",
            "Monad Top 10 Market"
        ];

        console2.log("=== MONAD MARKET STATUS CHECK ===\n");

        for (uint256 i = 0; i < 4; i++) {
            console2.log("\n--- Market ID:", i + 2);
            console2.log("Name:", names[i]);
            console2.log("Address:", markets[i]);
            
            SoothMarket market = SoothMarket(markets[i]);
            
            try market.isLive() returns (bool live) {
                console2.log("isLive:", live);
            } catch {
                console2.log("ERROR: Failed to read isLive");
            }
            
            try market.isSettled() returns (bool settled) {
                console2.log("isSettled:", settled);
            } catch {
                console2.log("ERROR: Failed to read isSettled");
            }
            
            try market.marketId() returns (uint256 id) {
                console2.log("marketId:", id);
            } catch {
                console2.log("ERROR: Failed to read marketId");
            }
            
            try market.ammState() returns (int256 qYes, int256 qNo) {
                console2.log("qYes:", uint256(qYes) / 1e18);
                console2.log("qNo:", uint256(qNo) / 1e18);
            } catch {
                console2.log("ERROR: Failed to read ammState");
            }
            
            // Check orderbook state
            try market.bestOrder(0) returns (uint256 bestYes) {
                console2.log("bestOrder[YES]:", bestYes);
            } catch {
                console2.log("ERROR: Failed to read bestOrder[YES]");
            }
            
            try market.bestOrder(1) returns (uint256 bestNo) {
                console2.log("bestOrder[NO]:", bestNo);
            } catch {
                console2.log("ERROR: Failed to read bestOrder[NO]");
            }
            
            console2.log("");
        }
    }
}
