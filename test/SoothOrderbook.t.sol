// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/core/SoothMarket.sol";
import "../contracts/core/SoothVault.sol";
import "../contracts/core/SoothLMSRReal.sol";
import "../contracts/core/SoothRiskManager.sol";
import "./MockERC20.sol";

contract SoothOrderbookTest is Test {
    MockERC20 collateral;
    SoothVault vault;
    SoothRiskManager riskManager;
    SoothLMSRReal amm;
    SoothMarket market;

    address lp = address(0xBEEF);
    address maker = address(0xFACE);
    address trader = address(0xCAFE);

    uint256 constant MARKET_ID = 1;
    bytes32 constant ADJ_ID = keccak256("DUMMY_ADJ");

    function setUp() public {
        collateral = new MockERC20();
        vault = new SoothVault(collateral);
        riskManager = new SoothRiskManager(vault);
        amm = new SoothLMSRReal();

        collateral._mint(lp, 1_000_000 ether);
        collateral._mint(maker, 1_000_000 ether);
        collateral._mint(trader, 1_000_000 ether);

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
        vm.prank(address(this));
        vault.setAuthorized(address(market), true);
    }

    function testPlaceOrderLocksCollateral() public {
        vm.startPrank(maker);
        collateral.approve(address(vault), type(uint256).max);
        
        uint256 balBefore = collateral.balanceOf(maker);
        
        // Place Sell YES order at 0.6
        // Collateral = (1 - 0.6) * 100 = 40
        uint256 price = 0.6 ether;
        uint256 amount = 100 ether;
        
        uint256 orderId = market.placeOrder(0, price, amount);
        
        uint256 balAfter = collateral.balanceOf(maker);
        uint256 expectedCollateral = (1 ether - price) * amount / 1 ether;
        
        assertEq(balBefore - balAfter, expectedCollateral, "Collateral locked incorrect");
        
        (uint256 id, address m, uint8 o, uint256 p, uint256 a, ) = market.orders(orderId);
        assertEq(id, orderId);
        assertEq(m, maker);
        assertEq(o, 0);
        assertEq(p, price);
        assertEq(a, amount);
        
        vm.stopPrank();
    }

    function testCancelOrderRefundsCollateral() public {
        vm.startPrank(maker);
        collateral.approve(address(vault), type(uint256).max);
        
        uint256 price = 0.6 ether;
        uint256 amount = 100 ether;
        uint256 orderId = market.placeOrder(0, price, amount);
        
        uint256 balLocked = collateral.balanceOf(maker);
        
        market.cancelOrder(orderId);
        
        uint256 balRefunded = collateral.balanceOf(maker);
        uint256 expectedCollateral = (1 ether - price) * amount / 1 ether;
        
        assertEq(balRefunded - balLocked, expectedCollateral, "Collateral refund incorrect");
        
        (uint256 id,,,,,) = market.orders(orderId);
        assertEq(id, 0, "Order not deleted");
        
        vm.stopPrank();
    }

    function testTradeMatchesOrderbookFirst() public {
        // Maker places Sell YES at 0.4 (Cheap!)
        // AMM price is ~0.5
        vm.startPrank(maker);
        collateral.approve(address(vault), type(uint256).max);
        market.placeOrder(0, 0.4 ether, 100 ether);
        vm.stopPrank();
        
        // Trader buys YES
        vm.startPrank(trader);
        collateral.approve(address(vault), type(uint256).max);
        uint256 balBefore = collateral.balanceOf(trader);
        
        // Buy 50 YES. Should fill entirely from Maker at 0.4
        market.trade(0, int256(50 ether), type(int256).max);
        
        uint256 balAfter = collateral.balanceOf(trader);
        uint256 cost = balBefore - balAfter;
        
        // Cost should be 50 * 0.4 = 20
        assertEq(cost, 20 ether, "Should match at order price");
        
        // Check Order updated
        (,,,, uint256 remaining,) = market.orders(1);
        assertEq(remaining, 50 ether, "Order remaining incorrect");
        
        vm.stopPrank();
    }

    function testTradeUnifiedExecution() public {
        // Maker places Sell YES at 0.4 for 10 shares
        vm.startPrank(maker);
        collateral.approve(address(vault), type(uint256).max);
        market.placeOrder(0, 0.4 ether, 10 ether);
        vm.stopPrank();
        
        // Trader buys 20 YES
        // 10 from Maker @ 0.4 = 4 cost
        // 10 from AMM @ ~0.5 = ~5 cost
        // Total cost ~9
        vm.startPrank(trader);
        collateral.approve(address(vault), type(uint256).max);
        uint256 balBefore = collateral.balanceOf(trader);
        
        market.trade(0, int256(20 ether), type(int256).max);
        
        uint256 balAfter = collateral.balanceOf(trader);
        uint256 cost = balBefore - balAfter;
        
        // Verify Order is gone
        (uint256 id,,,,,) = market.orders(1);
        assertEq(id, 0, "Order should be fully filled and deleted");
        
        // Verify Cost
        // 4 ether (Maker) + AMM cost
        // AMM cost for 10 shares starting from 0 is approx 5 ether (0.5 price)
        // So total around 9 ether
        assertGt(cost, 8 ether);
        assertLt(cost, 10 ether);
        
        vm.stopPrank();
    }

    function testTradeSkipsExpensiveOrder() public {
        // Maker places Sell YES at 0.9 (Expensive!)
        // AMM price is ~0.5
        vm.startPrank(maker);
        collateral.approve(address(vault), type(uint256).max);
        market.placeOrder(0, 0.9 ether, 100 ether);
        vm.stopPrank();
        
        // Trader buys 10 YES
        // Should ignore Maker and buy from AMM
        vm.startPrank(trader);
        collateral.approve(address(vault), type(uint256).max);
        uint256 balBefore = collateral.balanceOf(trader);
        
        market.trade(0, int256(10 ether), type(int256).max);
        
        uint256 balAfter = collateral.balanceOf(trader);
        uint256 cost = balBefore - balAfter;
        
        // Cost should be ~5 (AMM price), not 9 (Maker price)
        assertLt(cost, 6 ether, "Should skip expensive order");
        
        // Check Order untouched
        (,,,, uint256 remaining,) = market.orders(1);
        assertEq(remaining, 100 ether, "Order should be untouched");
        
        vm.stopPrank();
    }
}
