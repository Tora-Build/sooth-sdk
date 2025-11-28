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
        market.initialize(MARKET_ID, vault, riskManager, amm, ADJ_ID);

        // Authorize market on vault
        vm.prank(address(this)); // vault owner is test contract (since it deployed it)
        vault.setAuthorized(address(market), true);
    }

    function testTradeBuyYes() public {
        vm.startPrank(trader);
        collateral.approve(address(market), type(uint256).max);
        uint256 balBefore = collateral.balanceOf(trader);

        market.trade(0, int256(10 ether)); // buy 10 YES

        uint256 balAfter = collateral.balanceOf(trader);
        assertLt(balAfter, balBefore, "should pay to buy YES");
        assertEq(market.yesBalance(trader), 10 ether);
        vm.stopPrank();
    }

    function testTradeSellYes() public {
        vm.startPrank(trader);
        collateral.approve(address(market), type(uint256).max);
        
        // Buy first
        market.trade(0, int256(10 ether));
        uint256 balAfterBuy = collateral.balanceOf(trader);

        // Sell half
        market.trade(0, -int256(5 ether));
        
        uint256 balAfterSell = collateral.balanceOf(trader);
        assertGt(balAfterSell, balAfterBuy, "should receive funds when selling");
        assertEq(market.yesBalance(trader), 5 ether);
        vm.stopPrank();
    }

    function testCannotShortWithoutBalance() public {
        vm.startPrank(trader);
        vm.expectRevert();
        market.trade(0, -int256(1 ether)); // try to sell YES without holding
        vm.stopPrank();
    }
}
