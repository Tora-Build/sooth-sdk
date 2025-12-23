// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {TraderVaultLite} from "../../contracts/TraderVaultLite.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

contract TraderVaultLiteTest is Test {
    TraderVaultLite public vault;
    ERC20Mock public usdc;
    
    address public alice = address(0x1);
    address public bob = address(0x2);
    
    uint256 constant WAD = 1e18;
    
    function setUp() public {
        usdc = new ERC20Mock();
        vault = new TraderVaultLite(address(usdc));
        
        // Mint USDC to test users
        usdc.mint(alice, 1000 * WAD);
        usdc.mint(bob, 1000 * WAD);
    }
    
    function test_Deposit() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 100 * WAD);
        vault.deposit(100 * WAD);
        vm.stopPrank();
        
        assertEq(vault.balanceOf(alice), 100 * WAD);
        assertEq(vault.totalAssets(), 100 * WAD);
    }
    
    function test_Withdraw() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 100 * WAD);
        vault.deposit(100 * WAD);
        
        vault.withdraw(50 * WAD);
        vm.stopPrank();
        
        assertEq(vault.balanceOf(alice), 50 * WAD);
        assertEq(usdc.balanceOf(alice), 950 * WAD);
    }
    
    function test_RevertWhen_WithdrawInsufficientBalance() public {
        vm.startPrank(alice);
        usdc.approve(address(vault), 100 * WAD);
        vault.deposit(100 * WAD);
        
        vm.expectRevert("TraderVaultLite: insufficient balance");
        vault.withdraw(200 * WAD);
        vm.stopPrank();
    }
    
    function test_MultipleUsers() public {
        // Alice deposits
        vm.startPrank(alice);
        usdc.approve(address(vault), 100 * WAD);
        vault.deposit(100 * WAD);
        vm.stopPrank();
        
        // Bob deposits
        vm.startPrank(bob);
        usdc.approve(address(vault), 200 * WAD);
        vault.deposit(200 * WAD);
        vm.stopPrank();
        
        assertEq(vault.balanceOf(alice), 100 * WAD);
        assertEq(vault.balanceOf(bob), 200 * WAD);
        assertEq(vault.totalAssets(), 300 * WAD);
    }
    
    function testFuzz_Deposit(uint256 amount) public {
        amount = bound(amount, 1, 1000 * WAD);
        
        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
        
        assertEq(vault.balanceOf(alice), amount);
    }
    
    function testFuzz_DepositWithdraw(uint256 depositAmount, uint256 withdrawAmount) public {
        depositAmount = bound(depositAmount, 1, 1000 * WAD);
        withdrawAmount = bound(withdrawAmount, 1, depositAmount);
        
        vm.startPrank(alice);
        usdc.approve(address(vault), depositAmount);
        vault.deposit(depositAmount);
        vault.withdraw(withdrawAmount);
        vm.stopPrank();
        
        assertEq(vault.balanceOf(alice), depositAmount - withdrawAmount);
    }
}
