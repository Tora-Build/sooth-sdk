// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SoothBook} from "../src/SoothBook.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/**
 * @title DeploySoothBook
 * @notice Deploy SoothBook V12 to Base Sepolia
 *
 * Usage:
 *   export PRIVATE_KEY=0x...
 *   forge script script/DeploySoothBook.s.sol --rpc-url https://sepolia.base.org --broadcast
 */
contract DeploySoothBook is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("========================================");
        console.log("  SOOTHBOOK V12 - BASE SEPOLIA");
        console.log("========================================");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy MockUSDC
        MockUSDC usdc = new MockUSDC("Mock USDC", "USDC");
        console.log("[1/2] MockUSDC:", address(usdc));

        // 2. Deploy SoothBook
        SoothBook book = new SoothBook();
        console.log("[2/2] SoothBook:", address(book));

        // 3. Create a test market
        bytes32 marketKey = keccak256("btc-100k-2026");
        (address yesToken, address noToken) = book.createMarket(
            marketKey,
            address(usdc),
            "Will BTC hit $100k by end of 2026?"
        );
        console.log("Test market created:");
        console.log("  Key:", vm.toString(marketKey));
        console.log("  YES:", yesToken);
        console.log("  NO:", noToken);

        // 4. Mint some USDC to deployer for testing
        usdc.mint(deployer, 10000e18);
        console.log("Minted 10,000 USDC to deployer");

        vm.stopBroadcast();

        console.log("");
        console.log("========================================");
        console.log("  DEPLOYMENT COMPLETE");
        console.log("========================================");
        console.log("  MockUSDC:  ", address(usdc));
        console.log("  SoothBook: ", address(book));
        console.log("  YES Token: ", yesToken);
        console.log("  NO Token:  ", noToken);
    }
}
