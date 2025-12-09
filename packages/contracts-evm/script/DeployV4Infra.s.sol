// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/core/SoothTraderVaultV4.sol";
import "../contracts/core/SoothMarketV4.sol";
import "../contracts/core/OutcomeToken.sol";
import "../contracts/core/SoothGovernorVault.sol";
import "../contracts/core/SoothFeeController.sol";
import "../contracts/core/SoothInterfaces.sol";

contract MockUSDC is IERC20 {
    string public name = "Mock USDC";
    string public symbol = "mUSDC";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function transfer(address recipient, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[recipient] += amount;
        return true;
    }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        allowance[sender][msg.sender] -= amount;
        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount;
        return true;
    }
    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }
}

/// @title DeployV4Infra
/// @notice Deploy V4 infrastructure contracts only (Phase 1)
contract DeployV4Infra is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        vm.startBroadcast(deployerPrivateKey);

        console.log("=== Phase 1: Deploy V4 Infrastructure ===");
        console.log("Deployer:", deployer);

        // 1. MockUSDC
        MockUSDC usdc = new MockUSDC();
        usdc.mint(deployer, 1_000_000 * 1e18);
        console.log("USDC:", address(usdc));

        // 2. FeeController
        SoothFeeController feeController = new SoothFeeController(deployer);
        feeController.setOrderbookFee(10);
        console.log("FeeController:", address(feeController));

        // 3. GovernorVault
        SoothGovernorVault governorVault = new SoothGovernorVault(IERC20(address(usdc)));
        console.log("GovernorVault:", address(governorVault));

        // 4. TraderVaultV4
        SoothTraderVaultV4 traderVault = new SoothTraderVaultV4(
            IERC20(address(usdc)), 
            ISoothGovernorVault(address(governorVault))
        );
        console.log("TraderVaultV4:", address(traderVault));

        // 5. Setup permissions
        governorVault.setAuthorized(address(traderVault), true);
        governorVault.setAuthorized(deployer, true);

        // 6. Fund vault
        usdc.approve(address(governorVault), 500_000 * 1e18);
        usdc.transfer(address(governorVault), 500_000 * 1e18);
        governorVault.receiveFunds(0, 500_000 * 1e18);

        vm.stopBroadcast();

        console.log("");
        console.log("Phase 1 Complete! Save these addresses:");
        console.log("  USDC:", address(usdc));
        console.log("  GovernorVault:", address(governorVault));
        console.log("  TraderVaultV4:", address(traderVault));
        console.log("  FeeController:", address(feeController));
    }
}
