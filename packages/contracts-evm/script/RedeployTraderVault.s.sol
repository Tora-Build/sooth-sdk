// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothTraderVaultV4.sol";
import "../contracts/core/SoothLiquidityVault.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract RedeployTraderVault is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Constants for Base Sepolia
        address usdc = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
        address governor = 0x56a64627B00331A98616110F01d51a660d24F215; // Current Governor per deployments.json

        // Deploy New TraderVault
        SoothTraderVaultV4 newVault = new SoothTraderVaultV4(
            IERC20(usdc),
            ISoothLiquidityVault(governor)
        );

        console.log("Renouncing ownership of new TraderVault (testing only)... or Transferring to deployer?");
        // newVault.transferOwnership(msg.sender); 

        console.log("Deployed SoothTraderVaultV4 at:", address(newVault));

        vm.stopBroadcast();
    }
}
