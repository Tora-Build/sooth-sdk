// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {TruthMarket} from "../../contracts/TruthMarket.sol";
import {Collateralizer} from "../../contracts/Collateralizer.sol";
import {TickBook} from "../../contracts/TickBook.sol";
import {OutcomeToken} from "../../contracts/OutcomeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";
import {TickMath} from "../../contracts/libraries/TickMath.sol";

/**
 * @title TickBookEdgeCasesTest
 * @notice Additional tests to improve TickBook coverage from 55% to 80%+
 * @dev Focuses on:
 *   - getQuote() function
 *   - Market orders in both directions (buy YES / buy NO)
 *   - Cross-tick trading scenarios
 *   - Edge ticks (0, 5000, 9999)
 *   - Revert conditions
 *   - View function coverage
 */
contract TickBookEdgeCasesTest is Test {
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
        
        usdc.mint(alice, 100000 * WAD);
        usdc.mint(bob, 100000 * WAD);
    }

    // ============================================
    // getQuote() Tests
    // ============================================

    function test_GetQuote_BuyYES() public {
        // Setup: Alice provides liquidity at tick 6000
        uint16 tick = 6000;
        uint256 L = 1000 * WAD;
        uint256 yesNeeded = TickMath.getVirtualReserveYES(L, tick) - TickMath.getVirtualReserveYES(L, tick + 1);
        
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), yesNeeded);
        collateralizer.split(address(market), yesNeeded);
        OutcomeToken(yesToken).approve(address(tickBook), yesNeeded);
        tickBook.placeLimitOrder(marketKey, tick, tick, L);
        vm.stopPrank();

        // Get quote for buying YES
        uint256 noToGive = 1 * WAD;
        TickBook.SwapResult memory quote = tickBook.getQuote(marketKey, true, noToGive, 7000);
        
        assertTrue(quote.amountOut > 0, "Quote should return positive output");
        assertLt(quote.amountOut, noToGive, "Output should be less than input (fee)");
        assertGt(quote.feeAmount, 0, "Fee should be positive");
    }

    function test_GetQuote_SellYES() public {
        // Setup: Alice provides liquidity at tick 4000
        uint16 tick = 4000;
        uint256 L = 1000 * WAD;
        uint256 noNeeded = TickMath.getVirtualReserveNO(L, tick) - TickMath.getVirtualReserveNO(L, tick - 1);
        
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), noNeeded);
        collateralizer.split(address(market), noNeeded);
        OutcomeToken(noToken).approve(address(tickBook), noNeeded);
        tickBook.placeLimitOrder(marketKey, tick, tick, L);
        vm.stopPrank();

        // Get quote for selling YES (isBuy=false means giving YES, getting NO)
        uint256 yesToGive = 1 * WAD;
        TickBook.SwapResult memory quote = tickBook.getQuote(marketKey, false, yesToGive, 3000);
        
        assertTrue(quote.amountOut > 0, "Quote should return positive output");
    }

    // ============================================
    // Market Order Direction Tests
    // ============================================

    function test_MarketOrder_BuyNO() public {
        // Setup: Alice provides NO liquidity at tick 4000
        uint16 tick = 4000;
        uint256 L = 1000 * WAD;
        uint256 noNeeded = TickMath.getVirtualReserveNO(L, tick) - TickMath.getVirtualReserveNO(L, tick - 1);
        
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), noNeeded);
        collateralizer.split(address(market), noNeeded);
        OutcomeToken(noToken).approve(address(tickBook), noNeeded);
        tickBook.placeLimitOrder(marketKey, tick, tick, L);
        vm.stopPrank();

        // Bob buys NO (sells YES)
        uint256 yesToGive = 1 * WAD;
        vm.startPrank(bob);
        usdc.approve(address(collateralizer), yesToGive);
        collateralizer.split(address(market), yesToGive);
        OutcomeToken(yesToken).approve(address(tickBook), yesToGive);
        
        uint256 noReceived = tickBook.executeMarketOrder(marketKey, false, yesToGive, 3000);
        vm.stopPrank();

        assertTrue(noReceived > 0, "Should receive NO tokens");
    }

    // ============================================
    // Cross-Tick Trading Tests
    // ============================================

    function test_MarketOrder_CrossesMultipleTicks() public {
        // Setup: Provide liquidity at ticks 6000, 6500, 7000
        uint16[] memory ticks = new uint16[](3);
        ticks[0] = 6000;
        ticks[1] = 6500;
        ticks[2] = 7000;
        
        uint256 L = 100 * WAD;
        
        vm.startPrank(alice);
        for (uint256 i = 0; i < ticks.length; i++) {
            uint256 yesNeeded = TickMath.getVirtualReserveYES(L, ticks[i]) - TickMath.getVirtualReserveYES(L, ticks[i] + 1);
            usdc.approve(address(collateralizer), yesNeeded);
            collateralizer.split(address(market), yesNeeded);
            OutcomeToken(yesToken).approve(address(tickBook), yesNeeded);
            tickBook.placeLimitOrder(marketKey, ticks[i], ticks[i], L);
        }
        vm.stopPrank();

        // Bob executes large order that should cross multiple ticks
        uint256 noToGive = 10 * WAD;
        vm.startPrank(bob);
        usdc.approve(address(collateralizer), noToGive);
        collateralizer.split(address(market), noToGive);
        OutcomeToken(noToken).approve(address(tickBook), noToGive);
        
        uint256 yesReceived = tickBook.executeMarketOrder(marketKey, true, noToGive, 8000);
        vm.stopPrank();

        assertTrue(yesReceived > 0, "Should receive YES tokens");
        
        // Verify tick moved
        (uint16 finalTick, ) = tickBook.getCurrentTick(marketKey);
        assertTrue(finalTick > 6000, "Tick should have moved up");
    }

    // ============================================
    // Edge Tick Tests
    // ============================================

    function test_PlaceLimitOrder_TickNearMax() public {
        uint16 tick = 9500;
        uint256 L = 100 * WAD;
        uint256 yesNeeded = TickMath.getVirtualReserveYES(L, tick) - TickMath.getVirtualReserveYES(L, tick + 1);
        
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), yesNeeded);
        collateralizer.split(address(market), yesNeeded);
        OutcomeToken(yesToken).approve(address(tickBook), yesNeeded);
        tickBook.placeLimitOrder(marketKey, tick, tick, L);
        vm.stopPrank();

        assertEq(tickBook.getLimitOrder(marketKey, tick, tick, alice), L, "Order should be placed");
    }

    function test_PlaceLimitOrder_TickNearMin() public {
        uint16 tick = 500;
        uint256 L = 100 * WAD;
        uint256 noNeeded = TickMath.getVirtualReserveNO(L, tick) - TickMath.getVirtualReserveNO(L, tick - 1);
        
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), noNeeded);
        collateralizer.split(address(market), noNeeded);
        OutcomeToken(noToken).approve(address(tickBook), noNeeded);
        tickBook.placeLimitOrder(marketKey, tick, tick, L);
        vm.stopPrank();

        assertEq(tickBook.getLimitOrder(marketKey, tick, tick, alice), L, "Order should be placed");
    }

    // ============================================
    // Revert Condition Tests
    // ============================================

    function test_RevertWhen_MarketOrderZeroAmount() public {
        // Setup some liquidity
        uint16 tick = 6000;
        uint256 L = 100 * WAD;
        uint256 yesNeeded = TickMath.getVirtualReserveYES(L, tick) - TickMath.getVirtualReserveYES(L, tick + 1);
        
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), yesNeeded);
        collateralizer.split(address(market), yesNeeded);
        OutcomeToken(yesToken).approve(address(tickBook), yesNeeded);
        tickBook.placeLimitOrder(marketKey, tick, tick, L);
        vm.stopPrank();

        vm.startPrank(bob);
        vm.expectRevert("TickBook: zero amount");
        tickBook.executeMarketOrder(marketKey, true, 0, 7000);
        vm.stopPrank();
    }

    function test_RevertWhen_MarketNotActive() public {
        bytes32 fakeKey = keccak256("fake");
        
        vm.startPrank(bob);
        vm.expectRevert("TickBook: not active");
        tickBook.executeMarketOrder(fakeKey, true, 1 * WAD, 7000);
        vm.stopPrank();
    }

    function test_RevertWhen_RegisterMarketTwice() public {
        vm.expectRevert("TickBook: already registered");
        tickBook.registerMarket(address(market), yesToken, noToken);
    }

    function test_RevertWhen_RegisterZeroAddresses() public {
        TruthMarket market2 = new TruthMarket("Test2", uint64(block.timestamp + 30 days), adjudicator, address(0x3));
        
        vm.expectRevert("TickBook: zero yes token");
        tickBook.registerMarket(address(market2), address(0), noToken);
        
        vm.expectRevert("TickBook: zero no token");
        tickBook.registerMarket(address(market2), yesToken, address(0));
        
        vm.expectRevert("TickBook: zero market");
        tickBook.registerMarket(address(0), yesToken, noToken);
    }

    // ============================================
    // View Function Tests
    // ============================================

    function test_GetMarketInfo() public view {
        (address tm, address yt, address nt, bool active) = tickBook.getMarketInfo(marketKey);
        
        assertEq(tm, address(market), "Market should match");
        assertEq(yt, yesToken, "YES token should match");
        assertEq(nt, noToken, "NO token should match");
        assertTrue(active, "Market should be active");
    }

    function test_GetCurrentTick_Initial() public view {
        (uint16 tick, uint256 probability) = tickBook.getCurrentTick(marketKey);
        
        assertEq(tick, 5000, "Initial tick should be 5000");
        assertEq(probability, 5000 * 1e14, "Initial probability should be 50%");
    }

    function test_GetTick() public {
        // Place order at tick 6000
        uint16 tick = 6000;
        uint256 L = 100 * WAD;
        uint256 yesNeeded = TickMath.getVirtualReserveYES(L, tick) - TickMath.getVirtualReserveYES(L, tick + 1);
        
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), yesNeeded);
        collateralizer.split(address(market), yesNeeded);
        OutcomeToken(yesToken).approve(address(tickBook), yesNeeded);
        tickBook.placeLimitOrder(marketKey, tick, tick, L);
        vm.stopPrank();

        TickBook.TickData memory data = tickBook.getTick(marketKey, tick);
        // TickData has liquidityYES and liquidityNO, at least one should be non-zero
        assertTrue(data.liquidityYES > 0 || data.liquidityNO > 0, "Tick should have liquidity");
    }

    function test_FindNextActiveTick() public {
        // Place orders at ticks 6000 and 7000
        uint256 L = 100 * WAD;
        
        vm.startPrank(alice);
        // Tick 6000
        uint256 yes1 = TickMath.getVirtualReserveYES(L, 6000) - TickMath.getVirtualReserveYES(L, 6001);
        usdc.approve(address(collateralizer), yes1);
        collateralizer.split(address(market), yes1);
        OutcomeToken(yesToken).approve(address(tickBook), yes1);
        tickBook.placeLimitOrder(marketKey, 6000, 6000, L);
        
        // Tick 7000
        uint256 yes2 = TickMath.getVirtualReserveYES(L, 7000) - TickMath.getVirtualReserveYES(L, 7001);
        usdc.approve(address(collateralizer), yes2);
        collateralizer.split(address(market), yes2);
        OutcomeToken(yesToken).approve(address(tickBook), yes2);
        tickBook.placeLimitOrder(marketKey, 7000, 7000, L);
        vm.stopPrank();

        uint16 nextUp = tickBook.findNextActiveTick(marketKey, 5500, true);
        assertEq(nextUp, 6000, "Next up tick should be 6000");

        uint16 nextDown = tickBook.findNextActiveTick(marketKey, 6500, true);
        assertEq(nextDown, 7000, "Next up from 6500 should be 7000");
    }

    function test_GetAccruedFees() public view {
        // Placeholder function - should return 0
        uint256 fees = tickBook.getAccruedFees(marketKey, alice);
        assertEq(fees, 0, "Accrued fees should be 0 (not implemented)");
    }

    function test_ClaimFees() public {
        // Placeholder function - should return 0
        uint256 claimed = tickBook.claimFees(marketKey);
        assertEq(claimed, 0, "Claimed fees should be 0 (not implemented)");
    }

    // ============================================
    // Range Order Tests
    // ============================================

    function test_PlaceLimitOrder_Range() public {
        uint16 lower = 6000;
        uint16 upper = 7000;
        uint256 L = 100 * WAD;

        uint256 yesNeeded = TickMath.getVirtualReserveYES(L, lower) - TickMath.getVirtualReserveYES(L, upper + 1);
        
        vm.startPrank(alice);
        usdc.approve(address(collateralizer), yesNeeded);
        collateralizer.split(address(market), yesNeeded);
        OutcomeToken(yesToken).approve(address(tickBook), yesNeeded);
        tickBook.placeLimitOrder(marketKey, lower, upper, L);
        vm.stopPrank();

        // Verify order exists at both boundaries
        assertEq(tickBook.getLimitOrder(marketKey, lower, upper, alice), L);
    }
}

