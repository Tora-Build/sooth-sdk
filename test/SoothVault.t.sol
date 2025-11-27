// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothVault.sol";
import "./MockERC20.sol";

contract SoothVaultTest is Test {
    MockERC20 collateral;
    SoothVault vault;
    address lp = address(0xBEEF);
    address other = address(0xCAFE);

    function setUp() public {
        collateral = new MockERC20();
        vault = new SoothVault(collateral);
        collateral._mint(lp, 1_000 ether);
        collateral._mint(other, 500 ether);
    }

    function testDepositAndWithdraw() public {
        vm.startPrank(lp);
        collateral.approve(address(vault), type(uint256).max);
        vault.depositFor(lp, 100 ether);
        vm.stopPrank();

        assertEq(vault.totalAssets(), 100 ether);
        assertEq(vault.balanceOfLP(lp), 100 ether);

        vm.startPrank(lp);
        vault.withdrawFor(lp, 40 ether, lp);
        vm.stopPrank();

        assertEq(vault.totalAssets(), 60 ether);
        assertEq(vault.balanceOfLP(lp), 60 ether);
        assertEq(collateral.balanceOf(lp), 1_000 ether - 100 ether + 40 ether);
    }

    function testExposureAccounting() public {
        vm.startPrank(lp);
        collateral.approve(address(vault), type(uint256).max);
        vault.depositFor(lp, 200 ether);
        vm.stopPrank();

        // authorize test contract as spender
        vault.setAuthorized(address(this), true);

        vault.allocateExposure(1, 50 ether);
        assertEq(vault.totalLockedExposure(), 50 ether);

        vault.allocateExposure(2, 80 ether);
        assertEq(vault.totalLockedExposure(), 130 ether);

        // cannot withdraw more than free assets
        vm.expectRevert();
        vm.prank(lp);
        vault.withdrawFor(lp, 100 ether, lp);

        // release exposure and withdraw
        vault.releaseExposure(1, type(uint256).max);
        vault.releaseExposure(2, type(uint256).max);
        assertEq(vault.totalLockedExposure(), 0);

        vm.prank(lp);
        vault.withdrawFor(lp, 100 ether, lp);
        assertEq(vault.balanceOfLP(lp), 100 ether);
        assertEq(vault.totalAssets(), 100 ether);
    }
}
