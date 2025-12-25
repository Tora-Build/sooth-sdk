// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {TruthMarket} from "../../contracts/TruthMarket.sol";
import {Collateralizer} from "../../contracts/Collateralizer.sol";
import {TickBook} from "../../contracts/TickBook.sol";
import {OutcomeToken} from "../../contracts/OutcomeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";
import {TickMath} from "../../contracts/libraries/TickMath.sol";

contract TickBookTest is Test {
    TruthMarket public market;
    Collateralizer public collateralizer;
    TickBook public tickBook;
    ERC20Mock public usdc;
    
    address public creator = address(0x1);
    address public adjudicator = address(0x2);
    address public alice = address(0x10);
    address public bob = address(0x11);
    
    address public yesToken;
    address public noToken;
    bytes32 public marketKey;
    
    uint256 constant WAD = 1e18;

    function setUp() public {
        usdc = new ERC20Mock();
        collateralizer = new Collateralizer(address(usdc));
        tickBook = new TickBook();
        
        vm.prank(creator);
        market = new TruthMarket("Test Market", uint64(block.timestamp + 30 days), adjudicator, address(0x3));
        vm.prank(creator);
        market.activate();
        
        (yesToken, noToken) = collateralizer.registerMarket(address(market), "YES", "YES");
        marketKey = tickBook.registerMarket(address(market), yesToken, noToken);
        
        usdc.mint(alice, 10000 * WAD);
        usdc.mint(bob, 10000 * WAD);
    }

    function test_PlaceLimitOrder_AbovePrice() public {
        uint16 lower = 6000;
        uint16 upper = 7000;
        uint256 L = 100 * WAD;

        uint256 expectedYes = TickMath.getVirtualReserveYES(L, lower) - TickMath.getVirtualReserveYES(L, upper + 1);
        
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), expectedYes);
        collateralizer.split(address(market), expectedYes);
        
        OutcomeToken(yesToken).approve(address(tickBook), expectedYes);
        tickBook.placeLimitOrder(marketKey, lower, upper, L);
        vm.stopPrank();

        assertEq(OutcomeToken(yesToken).balanceOf(address(tickBook)), expectedYes);
        assertEq(OutcomeToken(noToken).balanceOf(address(tickBook)), 0);
        assertEq(tickBook.getLimitOrder(marketKey, lower, upper, alice), L);
        assertEq(tickBook.getLimitOrder(marketKey, upper, upper, alice), L);
    }

    function test_PlaceLimitOrder_BelowPrice() public {
        uint16 lower = 3000;
        uint16 upper = 4000;
        uint256 L = 100 * WAD;

        uint256 expectedNo = TickMath.getVirtualReserveNO(L, upper) - TickMath.getVirtualReserveNO(L, lower - 1);
        
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), expectedNo);
        collateralizer.split(address(market), expectedNo);
        
        OutcomeToken(noToken).approve(address(tickBook), expectedNo);
        tickBook.placeLimitOrder(marketKey, lower, upper, L);
        vm.stopPrank();

        assertEq(OutcomeToken(noToken).balanceOf(address(tickBook)), expectedNo);
        assertEq(OutcomeToken(yesToken).balanceOf(address(tickBook)), 0);
    }

    function test_MarketOrder_Concentrated() public {
        uint16 tick = 6000;
        uint256 L = 1000 * WAD;
        uint256 yesNeeded = TickMath.getVirtualReserveYES(L, tick) - TickMath.getVirtualReserveYES(L, tick + 1);
        
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), yesNeeded);
        collateralizer.split(address(market), yesNeeded);
        OutcomeToken(yesToken).approve(address(tickBook), yesNeeded);
        tickBook.placeLimitOrder(marketKey, tick, tick, L);
        vm.stopPrank();

        vm.startPrank(bob);
        uint256 noToGive = 1 * WAD; // 1 NO is enough to cross at least one tick
        usdc.approve(address(collateralizer), noToGive);
        collateralizer.split(address(market), noToGive);
        OutcomeToken(noToken).approve(address(tickBook), noToGive);
        
        uint256 yesReceived = tickBook.executeMarketOrder(marketKey, true, noToGive, 7000);
        vm.stopPrank();

        assertTrue(yesReceived > 0);
        (uint16 finalTick, ) = tickBook.getCurrentTick(marketKey);
        assertTrue(finalTick >= 6000);
    }

    function test_CancelLimitOrder() public {
        uint16 lower = 6000;
        uint16 upper = 7000;
        uint256 L = 100 * WAD;
        uint256 yesNeeded = TickMath.getVirtualReserveYES(L, lower) - TickMath.getVirtualReserveYES(L, upper + 1);

        vm.startPrank(alice);
        usdc.approve(address(collateralizer), yesNeeded);
        collateralizer.split(address(market), yesNeeded);
        OutcomeToken(yesToken).approve(address(tickBook), yesNeeded);
        tickBook.placeLimitOrder(marketKey, lower, upper, L);
        
        (uint256 yesBack, uint256 noBack) = tickBook.cancelLimitOrder(marketKey, lower, upper, L);
        vm.stopPrank();

        assertEq(yesBack, yesNeeded);
        assertEq(noBack, 0);
        assertEq(tickBook.getLimitOrder(marketKey, lower, upper, alice), 0);
    }
}
