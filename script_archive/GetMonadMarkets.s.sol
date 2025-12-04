// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothMarketFactory.sol";

contract GetMonadMarkets is Script {
    function run() external view {
        address factoryAddr = 0x03B92b6A9C9B9B480964Cc82C8820249A9B13D4E;
        SoothMarketFactory factory = SoothMarketFactory(factoryAddr);
        
        console2.log("=== MONAD MARKET ADDRESSES ===");
        console2.log("Factory:", factoryAddr);
        console2.log("Next Market ID:", factory.nextMarketId());
        console2.log("\nNote: Markets were created with IDs 1-5");
        console2.log("Use block explorer to find MarketCreated events");
    }
}
