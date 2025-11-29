// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothVault.sol";
import "../contracts/core/SoothRiskManager.sol";

/// @notice Minimal interface for MockERC20 to allow minting
interface MockERC20 {
    function _mint(address to, uint256 amount) external;
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @notice Helper script to initialize existing deployments with liquidity
/// @dev Use this to fix deployments where markets were created before liquidity was added
/// @dev Run with: forge script script/InitializeVault.s.sol:InitializeVault --rpc-url <RPC_URL> --broadcast
contract InitializeVault is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        
        // Read deployments.json
        string memory deploymentsJson = vm.readFile("deployments.json");
        address vaultAddr = vm.parseJsonAddress(deploymentsJson, ".SoothVault");
        address riskManagerAddr = vm.parseJsonAddress(deploymentsJson, ".SoothRiskManager");
        address collateralAddr = vm.parseJsonAddress(deploymentsJson, ".MockERC20");
        
        SoothVault vault = SoothVault(vaultAddr);
        SoothRiskManager riskManager = SoothRiskManager(riskManagerAddr);
        MockERC20 collateral = MockERC20(collateralAddr);
        
        console2.log("=== Vault Initialization Script ===");
        console2.log("Vault:", address(vault));
        console2.log("RiskManager:", address(riskManager));
        console2.log("Collateral:", address(collateral));
        
        // Check current state
        uint256 currentLiquidity = vault.totalAssets();
        console2.log("\nCurrent vault liquidity:", currentLiquidity);
        
        (uint256 currentBGlobal,) = riskManager.globalRisk();
        console2.log("Current bGlobal:", currentBGlobal);
        
        vm.startBroadcast(deployerKey);
        
        // Only deposit if vault is empty
        if (currentLiquidity == 0) {
            console2.log("\n=== Depositing Initial Liquidity ===");
            uint256 initialLiquidity = 100_000 ether; // 100k tokens
            
            // Check deployer balance
            uint256 balance = collateral.balanceOf(msg.sender);
            console2.log("Deployer balance:", balance);
            
            // Mint tokens if needed (only works with MockERC20)
            if (balance < initialLiquidity) {
                console2.log("Insufficient balance, minting tokens...");
                uint256 toMint = initialLiquidity - balance;
                
                // Try to mint (this will only work if the collateral is MockERC20)
                try MockERC20(collateralAddr)._mint(msg.sender, toMint) {
                    console2.log("Minted:", toMint);
                } catch {
                    console2.log("ERROR: Cannot mint tokens. Make sure you have enough balance.");
                    revert("Insufficient balance and cannot mint");
                }
            }
            
            // Approve and deposit
            collateral.approve(address(vault), initialLiquidity);
            vault.depositFor(msg.sender, initialLiquidity);
            console2.log("Deposited:", initialLiquidity);
        } else {
            console2.log("\nVault already has liquidity, skipping deposit");
        }
        
        // Always update bGlobal to ensure it's calculated correctly
        console2.log("\n=== Updating Global B Parameter ===");
        riskManager.updateGlobalB();
        
        (uint256 newBGlobal,) = riskManager.globalRisk();
        console2.log("New bGlobal:", newBGlobal);
        
        // Check vault state after initialization
        uint256 finalLiquidity = vault.totalAssets();
        uint256 treasury = vault.getTreasuryBalance();
        uint256 buffer = vault.getLiquidBufferBalance();
        
        console2.log("\n=== Final Vault State ===");
        console2.log("Total Assets:", finalLiquidity);
        console2.log("Treasury Balance:", treasury);
        console2.log("Liquid Buffer:", buffer);
        
        // Check b parameters for existing markets
        console2.log("\n=== Market B Parameters ===");
        try riskManager.getBForMarket(1) returns (uint256 b1) {
            console2.log("Market 1 b parameter:", b1);
        } catch {
            console2.log("Market 1 not found");
        }
        
        try riskManager.getBForMarket(2) returns (uint256 b2) {
            console2.log("Market 2 b parameter:", b2);
        } catch {
            console2.log("Market 2 not found");
        }
        
        vm.stopBroadcast();
        
        console2.log("\n=== Initialization Complete ===");
        if (newBGlobal > 0) {
            console2.log("[SUCCESS] Markets are now tradeable!");
        } else {
            console2.log("[WARNING] bGlobal is still 0. Check vault liquidity.");
        }
    }
}
