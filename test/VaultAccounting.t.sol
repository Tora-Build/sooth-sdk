// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothVault.sol";
import "./MockERC20.sol";

/// @notice Tests for vault accounting, specifically unrealized P&L isolation
contract VaultAccountingTest is Test {
    MockERC20 collateral;
    SoothVault vault;
    
    address lp1 = address(0x1);
    address lp2 = address(0x2);
    address market = address(0x3);
    address trader = address(0x4);
    address settlement = address(0x5);
    
    function setUp() public {
        collateral = new MockERC20();
        vault = new SoothVault(collateral);
        
        // Authorize market and settlement
        vault.setAuthorized(market, true);
        vault.setAuthorized(settlement, true);
        
        // Mint tokens
        collateral._mint(lp1, 1_000_000 ether);
        collateral._mint(lp2, 1_000_000 ether);
        collateral._mint(trader, 1_000_000 ether);
        
        // Approve vault
        vm.prank(lp1);
        collateral.approve(address(vault), type(uint256).max);
        vm.prank(lp2);
        collateral.approve(address(vault), type(uint256).max);
        vm.prank(trader);
        collateral.approve(address(vault), type(uint256).max);
    }
    
    function testUnrealizedPnLDoesNotAffectTotalAssets() public {
        // LP1 deposits 100k
        vm.prank(lp1);
        vault.deposit(100_000 ether, lp1);
        
        assertEq(vault.totalAssets(), 100_000 ether);
        assertEq(vault.balanceOf(lp1), 100_000 ether);
        
        // Market generates 10k unrealized profit (trader pays vault)
        vm.prank(market);
        vault.recordMarketFlow(1, 10_000 ether, trader);
        
        // totalAssets should NOT change (unrealized P&L)
        assertEq(vault.totalAssets(), 100_000 ether, "totalAssets should not change with unrealized P&L");
        
        // Market reserve should track the unrealized profit
        assertEq(vault.getMarketReserve(1), 10_000 ether);
    }
    
    function testUnrealizedPnLDoesNotAffectLPShares() public {
        // LP1 deposits 100k
        vm.prank(lp1);
        vault.deposit(100_000 ether, lp1);
        
        // Market generates 10k unrealized profit
        vm.prank(market);
        vault.recordMarketFlow(1, 10_000 ether, trader);
        
        // LP2 deposits 50k - should get fair share price
        vm.prank(lp2);
        vault.deposit(50_000 ether, lp2);
        
        // Both LPs should have proportional shares (1:1 ratio)
        assertEq(vault.balanceOf(lp1), 100_000 ether);
        assertEq(vault.balanceOf(lp2), 50_000 ether, "LP2 should not be affected by unrealized P&L");
        
        // Total shares should be sum of deposits
        assertEq(vault.totalSupply(), 150_000 ether);
        assertEq(vault.totalAssets(), 150_000 ether);
    }
    
    function testSettlementRealizesProfit() public {
        // LP deposits 100k
        vm.prank(lp1);
        vault.deposit(100_000 ether, lp1);
        
        // Market generates 10k unrealized profit
        vm.prank(market);
        vault.recordMarketFlow(1, 10_000 ether, trader);
        
        // Before settlement
        assertEq(vault.totalAssets(), 100_000 ether);
        assertEq(vault.getMarketReserve(1), 10_000 ether);
        
        // Settlement: trader loses 10k, vault gains 10k
        // pnlDelta = -10k (negative = trader loses)
        vm.prank(settlement);
        vault.applySettlementDelta(1, trader, -10_000 ether);
        
        // After settlement: P&L is realized
        assertEq(vault.totalAssets(), 110_000 ether, "totalAssets should increase after settlement");
        // marketReserves -= pnlDelta => 10k - (-10k) = 20k
        assertEq(vault.getMarketReserve(1), 20_000 ether, "Market reserve updated");
    }
    
    function testSettlementRealizesLoss() public {
        // LP deposits 100k
        vm.prank(lp1);
        vault.deposit(100_000 ether, lp1);
        
        // Market generates 10k unrealized loss (vault pays trader)
        vm.prank(market);
        vault.recordMarketFlow(1, -10_000 ether, trader);
        
        // Before settlement
        assertEq(vault.totalAssets(), 100_000 ether);
        assertEq(vault.getMarketReserve(1), -10_000 ether);
        
        // Settlement: trader wins 10k, vault loses 10k
        // pnlDelta = +10k (positive = trader wins)
        vm.prank(settlement);
        vault.applySettlementDelta(1, trader, 10_000 ether);
        
        // After settlement: P&L is realized
        assertEq(vault.totalAssets(), 90_000 ether, "totalAssets should decrease after settlement");
        // marketReserves -= pnlDelta => -10k - 10k = -20k
        assertEq(vault.getMarketReserve(1), -20_000 ether, "Market reserve updated");
    }
    
    function testMultipleMarketsUnrealizedPnL() public {
        // LP deposits 100k
        vm.prank(lp1);
        vault.deposit(100_000 ether, lp1);
        
        // Market 1: +5k unrealized profit
        vm.prank(market);
        vault.recordMarketFlow(1, 5_000 ether, trader);
        
        // Market 2: -3k unrealized loss
        vm.prank(market);
        vault.recordMarketFlow(2, -3_000 ether, trader);
        
        // totalAssets should not change
        assertEq(vault.totalAssets(), 100_000 ether);
        
        // Market reserves tracked separately
        assertEq(vault.getMarketReserve(1), 5_000 ether);
        assertEq(vault.getMarketReserve(2), -3_000 ether);
    }
    
    function testCannotWithdrawUnrealizedProfit() public {
        // LP deposits 100k
        vm.prank(lp1);
        vault.deposit(100_000 ether, lp1);
        
        // Market generates 10k unrealized profit
        vm.prank(market);
        vault.recordMarketFlow(1, 10_000 ether, trader);
        
        // LP can only withdraw their original deposit (100k)
        uint256 maxWithdraw = vault.maxWithdraw(lp1);
        assertEq(maxWithdraw, 100_000 ether, "Can only withdraw realized assets");
        
        // Attempting to withdraw more than deposited should fail
        vm.prank(lp1);
        vm.expectRevert();
        vault.withdraw(110_000 ether, lp1, lp1);
    }
    
    function testPhysicalTokenBalanceVsTotalAssets() public {
        // LP deposits 100k
        vm.prank(lp1);
        vault.deposit(100_000 ether, lp1);
        
        // Market generates 10k unrealized profit (trader pays vault)
        vm.prank(market);
        vault.recordMarketFlow(1, 10_000 ether, trader);
        
        // Physical token balance should be 110k
        assertEq(collateral.balanceOf(address(vault)), 110_000 ether);
        
        // But totalAssets (LP share value) should still be 100k
        assertEq(vault.totalAssets(), 100_000 ether);
        
        // The difference is unrealized P&L
        uint256 unrealizedPnL = collateral.balanceOf(address(vault)) - vault.totalAssets();
        assertEq(unrealizedPnL, 10_000 ether);
    }
    
    function testRoundTripTradingDoesNotAffectTotalAssets() public {
        // LP deposits 100k
        vm.prank(lp1);
        vault.deposit(100_000 ether, lp1);
        
        uint256 initialTotalAssets = vault.totalAssets();
        
        // Trader buys (pays vault)
        vm.prank(market);
        vault.recordMarketFlow(1, 5_000 ether, trader);
        
        // Trader sells (vault pays trader)
        vm.prank(market);
        vault.recordMarketFlow(1, -5_000 ether, trader);
        
        // totalAssets should be unchanged
        assertEq(vault.totalAssets(), initialTotalAssets, "Round-trip trading should not affect totalAssets");
        
        // Market reserve should be back to 0
        assertEq(vault.getMarketReserve(1), 0);
    }
}
