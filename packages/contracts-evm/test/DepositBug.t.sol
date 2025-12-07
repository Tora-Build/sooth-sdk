// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothTraderVault.sol";
import "../contracts/core/SoothGovernorVault.sol";
import "../contracts/core/SoothFeeController.sol";
import "../contracts/core/SoothLMSRReal.sol";

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

contract DepositBugTest is Test {
    SoothTraderVault vault;
    SoothGovernorVault governor;
    MockUSDC usdc;
    address user = address(0x123);

    function setUp() public {
        usdc = new MockUSDC();
        governor = new SoothGovernorVault(IERC20(address(usdc)));
        vault = new SoothTraderVault(IERC20(address(usdc)), governor);
        
        // Setup user
        usdc.mint(user, 1000 * 1e18);
    }

    function test_Depositv3() public {
        vm.startPrank(user);
        
        uint256 amount = 100 * 1e18;
        usdc.approve(address(vault), amount);
        
        vault.deposit(amount);
        
        assertEq(vault.availableBalance(user), amount);
        console.log("Deposit successful");
        
        vm.stopPrank();
    }
    
    function test_DepositInsufficientBalance() public {
        vm.startPrank(user);
        
        uint256 amount = 2000 * 1e18; // User has 1000
        usdc.approve(address(vault), amount);
        
        vm.expectRevert(); // Should revert with panic
        vault.deposit(amount);
        
        vm.stopPrank();
    }
}
