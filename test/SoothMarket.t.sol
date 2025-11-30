// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothMarket.sol";
import "../contracts/core/SoothVault.sol";
import "../contracts/core/SoothBalancedAMM.sol";
import "../contracts/core/SoothRiskManager.sol";
import "./MockERC20.sol";

contract SoothMarketTest is Test {
    MockERC20 collateral;
    SoothVault vault;
    SoothRiskManager riskManager;
    SoothBalancedAMM amm;
    SoothMarket market;

    address lp = address(0xBEEF);
    address trader = address(0xCAFE);

    uint256 constant MARKET_ID = 1;
    bytes32 constant ADJ_ID = keccak256("DUMMY_ADJ");

    function setUp() public {
        collateral = new MockERC20();
        vault = new SoothVault(collateral);
        riskManager = new SoothRiskManager(vault);
        amm = new SoothBalancedAMM();

        collateral._mint(lp, 1_000_000 ether);
        collateral._mint(trader, 1_000 ether);

        // LP deposit
        vm.startPrank(lp);
        collateral.approve(address(vault), type(uint256).max);
        vault.depositFor(lp, 500_000 ether);
        vm.stopPrank();

        // Risk config
        riskManager.setMarketRiskClass(MARKET_ID, SoothRiskManager.RiskClass.MEDIUM);
        riskManager.updateGlobalB();

        // Market
        market = new SoothMarket();
        market.initialize(MARKET_ID, vault, riskManager, amm, ADJ_ID, 1000 ether);

        // Authorize market on vault
        vm.prank(address(this)); // vault owner is test contract (since it deployed it)
        vault.setAuthorized(address(market), true);
    }

    function testTradeBuyYes() public {
        vm.startPrank(trader);
        collateral.approve(address(vault), type(uint256).max);
        uint256 balBefore = collateral.balanceOf(trader);

        market.trade(0, int256(10 ether), type(int256).max); // buy 10 YES

        uint256 balAfter = collateral.balanceOf(trader);
        assertLt(balAfter, balBefore, "should pay to buy YES");
        assertEq(market.yesBalance(trader), 10 ether);
        vm.stopPrank();
    }

    function testTradeSellYes() public {
        vm.startPrank(trader);
        collateral.approve(address(vault), type(uint256).max);
        
        // Buy first
        market.trade(0, int256(10 ether), type(int256).max);
        uint256 balAfterBuy = collateral.balanceOf(trader);

        // Sell half (use type(int256).max to accept any proceeds)
        market.trade(0, -int256(5 ether), type(int256).max);
        
        uint256 balAfterSell = collateral.balanceOf(trader);
        assertGt(balAfterSell, balAfterBuy, "should receive funds when selling");
        assertEq(market.yesBalance(trader), 5 ether);
        vm.stopPrank();
    }

    function testCannotShortWithoutBalance() public {
        vm.startPrank(trader);
        vm.expectRevert();
        market.trade(0, -int256(1 ether), type(int256).max); // try to sell YES without holding
        vm.stopPrank();
    }

    function testSlippageProtectionBuy() public {
        vm.startPrank(trader);
        collateral.approve(address(vault), type(uint256).max);
        
        // Calculate expected cost for 10 YES shares
        uint256 b = riskManager.getBForMarket(MARKET_ID);
        (int256 qYes, int256 qNo) = market.ammState();
        (int256 expectedCost,) = amm.costDelta(
            ISoothAMM.State({qYes: qYes, qNo: qNo}),
            0,
            int256(10 ether),
            b
        );
        
        // Set maxCost too low - should revert
        vm.expectRevert("Market: slippage exceeded");
        market.trade(0, int256(10 ether), expectedCost - 1);
        
        // Set maxCost at exact amount - should succeed
        market.trade(0, int256(10 ether), expectedCost);
        assertEq(market.yesBalance(trader), 10 ether);
        
        vm.stopPrank();
    }

    function testSlippageProtectionSell() public {
        vm.startPrank(trader);
        collateral.approve(address(vault), type(uint256).max);
        
        // Buy first
        market.trade(0, int256(10 ether), type(int256).max);
        
        // Calculate expected proceeds for selling 5 YES shares
        uint256 b = riskManager.getBForMarket(MARKET_ID);
        (int256 qYes, int256 qNo) = market.ammState();
        (int256 expectedProceeds,) = amm.costDelta(
            ISoothAMM.State({qYes: qYes, qNo: qNo}),
            0,
            -int256(5 ether),
            b
        );
        
        // expectedProceeds is negative (e.g., -2.5 means receive 2.5)
        // For algebraic check: cost <= maxCost
        // expectedProceeds - 1 (e.g., -3.5) means willing to accept less (worse for us) - should revert
        vm.expectRevert("Market: slippage exceeded");
        market.trade(0, -int256(5 ether), expectedProceeds - 1);
        
        // Set maxCost at exact amount - should succeed
        market.trade(0, -int256(5 ether), expectedProceeds);
        assertEq(market.yesBalance(trader), 5 ether);
        
        vm.stopPrank();
    }

    function testSlippageProtectionWithPriceMovement() public {
        vm.startPrank(trader);
        collateral.approve(address(vault), type(uint256).max);
        
        // Get cost for 10 YES at current state
        uint256 b = riskManager.getBForMarket(MARKET_ID);
        (int256 qYes1, int256 qNo1) = market.ammState();
        (int256 cost1,) = amm.costDelta(
            ISoothAMM.State({qYes: qYes1, qNo: qNo1}),
            0,
            int256(10 ether),
            b
        );
        
        // Execute a large trade to move the price
        market.trade(0, int256(100 ether), type(int256).max);
        
        // Now the cost for 10 YES should be higher
        (int256 qYes2, int256 qNo2) = market.ammState();
        (int256 cost2,) = amm.costDelta(
            ISoothAMM.State({qYes: qYes2, qNo: qNo2}),
            0,
            int256(10 ether),
            b
        );
        
        assertGt(cost2, cost1, "Price should have moved up");
        
        // Try to buy with old (lower) maxCost - should revert
        vm.expectRevert("Market: slippage exceeded");
        market.trade(0, int256(10 ether), cost1);
        
        vm.stopPrank();
    }
    
    function testMarketInitializesWithBalancedQuantities() public {
        (int256 qYes, int256 qNo) = market.ammState();
        assertEq(qYes, 1000 ether, "qYes should be 1000");
        assertEq(qNo, 1000 ether, "qNo should be 1000");
    }

    function testFirstTradePricing() public {
        vm.startPrank(trader);
        collateral.approve(address(vault), type(uint256).max);
        
        uint256 balBefore = collateral.balanceOf(trader);
        
        // Buy 1 share - should cost approximately 0.5 USDC for 50/50 market
        market.trade(0, int256(1 ether), type(int256).max);
        
        uint256 balAfter = collateral.balanceOf(trader);
        uint256 cost = balBefore - balAfter;
        
        // Cost should be reasonable (between 0.4 and 0.6 USDC)
        // NOT 0.00385 USDC like the bug showed
        assertGt(cost, 0.4 ether, "Cost too low - pricing broken");
        assertLt(cost, 0.6 ether, "Cost too high - pricing broken");
        
        vm.stopPrank();
    }
}
