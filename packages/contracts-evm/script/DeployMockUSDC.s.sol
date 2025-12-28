// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {MockUSDC} from "../contracts/MockUSDC.sol";

contract DeployMockUSDC is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying MockUSDC...");
        console.log("Deployer:", deployer);
        
        vm.startBroadcast(deployerPrivateKey);
        
        MockUSDC usdc = new MockUSDC("Sooth Test USDC", "stUSDC");
        console.log("MockUSDC deployed:", address(usdc));
        
        // Mint 100k to deployer
        usdc.mint(deployer, 100_000e18);
        console.log("Minted 100,000 stUSDC to deployer");
        
        vm.stopBroadcast();
        
        // Save to file
        string memory json = string.concat('{"mockUSDC": "', vm.toString(address(usdc)), '"}');
        vm.writeFile("deployments/mockusdc-latest.json", json);
        console.log("Saved to deployments/mockusdc-latest.json");
    }
}

