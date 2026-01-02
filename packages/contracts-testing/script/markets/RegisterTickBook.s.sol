// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {ITickBook} from "@core/interfaces/ITickBook.sol";

/**
 * @title ManuallyRegisterTickBook
 * @notice Manually register graduated markets in TickBook
 */
contract ManuallyRegisterTickBook is Script {
    address constant TICKBOOK = 0xbc0e25537871f6f0e13D130a3E23278c8B85228D;
    
    // ALIEN Market
    address constant ALIEN_MARKET = 0xA428556d84374A92dde26B87a3cd607cE94Af91B;
    address constant ALIEN_YES = 0xe163F61Bf1028497F6359186b4753F9E25Df0629;
    address constant ALIEN_NO = 0x231475C46b15B4C61ddd5C7d61d88fA8A131B778;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        console.log("Registering ALIEN market in TickBook...");
        console.log("Market:", ALIEN_MARKET);
        console.log("YES Token:", ALIEN_YES);
        console.log("NO Token:", ALIEN_NO);

        vm.startBroadcast(deployerPrivateKey);

        try ITickBook(TICKBOOK).registerMarket(
            ALIEN_MARKET,
            ALIEN_YES,
            ALIEN_NO,
            500000000000000000, // 50% initial probability
            address(0) // no hook
        ) returns (bytes32 marketKey) {
            console.log("Success! Market Key:");
            console.logBytes32(marketKey);
        } catch Error(string memory reason) {
            console.log("Failed:", reason);
        } catch (bytes memory lowLevelData) {
            console.log("Failed with low-level error");
            console.logBytes(lowLevelData);
        }

        vm.stopBroadcast();
    }
}
