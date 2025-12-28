// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {TickBookV2} from "../../contracts/TickBookV2.sol";
import {TickBookVault} from "../../contracts/TickBookVault.sol";
import {MockUSDC} from "../../contracts/MockUSDC.sol";

// Simple mock for TruthMarket interface
contract MockTruthMarket {
    bool public isLive = true;
    bool public isSettled = false;
    uint8 public winningOutcome = 0;

    function setLive(bool _live) external {
        isLive = _live;
    }

    function setSettled(bool _settled, uint8 _winner) external {
        isSettled = _settled;
        winningOutcome = _winner;
    }

    function getRedemptionValue(uint8 outcome) external view returns (uint256) {
        if (!isSettled) return 0;
        if (winningOutcome == 2) return 0.5e18; // INVALID
        return outcome == winningOutcome ? 1e18 : 0;
    }
}

contract TickBookV2Test is Test {
    TickBookV2 public tickBook;
    TickBookVault public vault;
    MockTruthMarket public market;
    MockUSDC public usdc;

    address public owner = address(this);
    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public charlie = address(0xC);

    // Mock token addresses (not real contracts, just for registration)
    address public yesToken = address(0x1111111111111111111111111111111111111111);
    address public noToken = address(0x2222222222222222222222222222222222222222);

    bytes32 public marketKey;

    uint256 constant WAD = 1e18;

    function setUp() public {
        // Deploy USDC
        usdc = new MockUSDC("Mock USDC", "USDC");

        // Deploy vault
        vault = new TickBookVault(address(usdc), owner);

        // Deploy TickBookV2
        tickBook = new TickBookV2(address(vault));

        // Set tickBook in vault
        vault.setTickBook(address(tickBook));

        // Deploy mock market
        market = new MockTruthMarket();

        // Register market at 50% probability
        marketKey = tickBook.registerMarket(address(market), yesToken, noToken, 0.5e18);

        // Fund users (TickBookV2 collateral now scales with range width, so tests need more headroom)
        usdc.mint(alice, 100_000 * WAD);
        usdc.mint(bob, 100_000 * WAD);
        usdc.mint(charlie, 100_000 * WAD);

        // Users deposit to vault
        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(50_000 * WAD);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(50_000 * WAD);
        vm.stopPrank();

        vm.startPrank(charlie);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(50_000 * WAD);
        vm.stopPrank();
    }

    // ============================================
    // Basic Tests
    // ============================================

    function test_RegisterMarket() public view {
        (address m, address yes, address no, bool active) = tickBook.getMarketInfo(marketKey);
        assertEq(m, address(market));
        assertEq(yes, yesToken);
        assertEq(no, noToken);
        assertTrue(active);
    }

    function test_InitialState() public view {
        (uint16 currentTick, uint128 activeLiqNo, uint128 activeLiqYes, uint256 prob) = tickBook.getMarketState(marketKey);
        assertEq(currentTick, 500); // 50%
        assertEq(activeLiqNo, 0);
        assertEq(activeLiqYes, 0);
        assertEq(prob, 500 * WAD / 1000); // 0.5 WAD
    }

    // ============================================
    // Range Order Placement
    // ============================================

    function test_PlaceRangeOrder_SingleTick() public {
        vm.prank(alice);
        (uint256 orderId,,) = tickBook.placeRangeOrder(marketKey, 0, 400, 400, 1000 * WAD);

        assertEq(orderId, 1);

        TickBookV2.RangeOrder memory order = tickBook.getOrder(marketKey, orderId);
        assertEq(order.owner, alice);
        assertEq(order.outcome, 0);
        assertEq(order.tickLower, 400);
        assertEq(order.tickUpper, 400);
        assertEq(order.liquidity, 1000 * WAD);
        assertTrue(order.active);
    }

    function test_PlaceRangeOrder_WideRange() public {
        // Place order from tick 300 to 600 (30% to 60%)
        vm.prank(alice);
        uint256 sharesTotal = 5_000 * WAD;
        (uint256 orderId,,) = tickBook.placeRangeOrder(marketKey, 0, 300, 600, sharesTotal);

        TickBookV2.RangeOrder memory order = tickBook.getOrder(marketKey, orderId);
        assertEq(order.tickLower, 300);
        assertEq(order.tickUpper, 600);
        assertEq(order.sharesTotal, sharesTotal);
        uint256 ticksInRange = uint256(order.tickUpper) - uint256(order.tickLower) + 1;
        uint256 expectedDensity = sharesTotal / ticksInRange;
        assertEq(order.liquidity, expectedDensity);

        // Check that active liquidity is updated (current tick 500 is within 300-600)
        (, uint128 activeLiqNo,,) = tickBook.getMarketState(marketKey);
        assertEq(activeLiqNo, uint128(expectedDensity));
    }

    function test_PlaceRangeOrder_OutsideCurrentTick() public {
        // Place order from tick 600 to 800 (60% to 80%)
        // Current tick is 500, so this shouldn't add to active liquidity yet
        vm.prank(alice);
        tickBook.placeRangeOrder(marketKey, 0, 600, 800, 1_000 * WAD);

        (, uint128 activeLiqNo,,) = tickBook.getMarketState(marketKey);
        assertEq(activeLiqNo, 0); // Not active yet
    }

    function test_PlaceRangeOrder_GasEfficiency() public {
        // This should be O(1) regardless of range width
        vm.prank(alice);
        uint256 gasBefore = gasleft();
        tickBook.placeRangeOrder(marketKey, 0, 100, 900, 1_000 * WAD); // 800 tick range (total shares)
        uint256 gasUsed = gasBefore - gasleft();

        console2.log("Gas for 800-tick range order:", gasUsed);
        // Should be under 400k gas (old model would be ~5M+)
        // ~347k observed — that's 14x improvement over old design
        assertLt(gasUsed, 400_000);
    }

    // ============================================
    // Cancel Orders
    // ============================================

    function test_CancelOrder() public {
        vm.startPrank(alice);
        (uint256 orderId,,) = tickBook.placeRangeOrder(marketKey, 0, 400, 600, 1_000 * WAD);

        uint256 balanceBefore = vault.availableUsdcWad(alice);
        (uint256 collateralReleased,) = tickBook.cancelOrder(marketKey, orderId);
        uint256 balanceAfter = vault.availableUsdcWad(alice);
        vm.stopPrank();

        assertGt(collateralReleased, 0);
        assertEq(balanceAfter, balanceBefore + collateralReleased);

        TickBookV2.RangeOrder memory order = tickBook.getOrder(marketKey, orderId);
        assertFalse(order.active);
    }

    function test_CancelOrder_RevertNotOwner() public {
        vm.prank(alice);
        (uint256 orderId,,) = tickBook.placeRangeOrder(marketKey, 0, 400, 600, 1_000 * WAD);

        vm.prank(bob);
        vm.expectRevert(bytes("!own"));
        tickBook.cancelOrder(marketKey, orderId);
    }

    // ============================================
    // Market Orders
    // ============================================

    function test_ExecuteMarketOrder_BuyYes() public {
        // Alice provides NO liquidity at 40-60%
        vm.prank(alice);
        tickBook.placeRangeOrder(marketKey, 0, 400, 600, 10_000 * WAD); // total shares

        // Bob buys YES
        vm.prank(bob);
        (uint256 filled, uint256 cost,) = tickBook.executeMarketOrder(marketKey, 1, 100 * WAD, 100 * WAD);

        assertGt(filled, 0);
        assertGt(cost, 0);
        console2.log("Filled:", filled / WAD);
        console2.log("Cost:", cost / WAD);

        // Price should have moved up
        (uint16 newTick,,,) = tickBook.getMarketState(marketKey);
        assertGt(newTick, 500);
    }

    function test_ExecuteMarketOrder_BuyNo() public {
        // Alice provides YES liquidity at 40-60%
        vm.prank(alice);
        tickBook.placeRangeOrder(marketKey, 1, 400, 600, 10_000 * WAD); // total shares

        // Bob buys NO
        vm.prank(bob);
        (uint256 filled, uint256 cost,) = tickBook.executeMarketOrder(marketKey, 0, 100 * WAD, 100 * WAD);

        assertGt(filled, 0);
        assertGt(cost, 0);

        // Price should have moved down
        (uint16 newTick,,,) = tickBook.getMarketState(marketKey);
        assertLt(newTick, 500);
    }

    function test_ExecuteMarketOrder_SlippageProtection() public {
        // Provide enough liquidity to fill the order
        vm.prank(alice);
        tickBook.placeRangeOrder(marketKey, 0, 400, 900, 20_000 * WAD);

        // Try to buy with very low maxCost (should fail on slippage, not liquidity)
        vm.prank(bob);
        vm.expectRevert(bytes("slip"));
        tickBook.executeMarketOrder(marketKey, 1, 100 * WAD, 1 * WAD);
    }

    function test_ExecuteMarketOrder_NoLiquidity() public {
        // No orders placed
        vm.prank(bob);
        vm.expectRevert(bytes("!liq"));
        tickBook.executeMarketOrder(marketKey, 1, 100 * WAD, 100 * WAD);
    }

    // ============================================
    // Fill Attribution
    // ============================================

    function test_ClaimFills() public {
        // Alice provides liquidity
        vm.prank(alice);
        (uint256 orderId,,) = tickBook.placeRangeOrder(marketKey, 0, 400, 600, 10_000 * WAD);

        // Bob trades against it
        vm.prank(bob);
        tickBook.executeMarketOrder(marketKey, 1, 500 * WAD, 500 * WAD);

        // Alice claims fills
        vm.prank(alice);
        (uint256 filledShares, uint256 proceeds) = tickBook.claimFills(marketKey, orderId);

        assertGt(filledShares, 0);
        console2.log("Alice filled shares:", filledShares / WAD);
        console2.log("Alice proceeds:", proceeds / WAD);
    }

    function test_ProRataFills_TwoMakers() public {
        // Alice and Bob both provide equal liquidity
        vm.prank(alice);
        (uint256 aliceOrder,,) = tickBook.placeRangeOrder(marketKey, 0, 400, 600, 10_000 * WAD);

        vm.prank(bob);
        (uint256 bobOrder,,) = tickBook.placeRangeOrder(marketKey, 0, 400, 600, 10_000 * WAD);

        // Charlie trades
        vm.prank(charlie);
        tickBook.executeMarketOrder(marketKey, 1, 1000 * WAD, 1000 * WAD);

        // Both claim
        vm.prank(alice);
        (uint256 aliceFills,) = tickBook.claimFills(marketKey, aliceOrder);

        vm.prank(bob);
        (uint256 bobFills,) = tickBook.claimFills(marketKey, bobOrder);

        // Should be roughly equal (pro-rata)
        console2.log("Alice fills:", aliceFills / WAD);
        console2.log("Bob fills:", bobFills / WAD);
        
        // Allow 1% tolerance for rounding
        assertApproxEqRel(aliceFills, bobFills, 0.01e18);
    }

    // ============================================
    // Quote
    // ============================================

    function test_GetQuote() public {
        vm.prank(alice);
        tickBook.placeRangeOrder(marketKey, 0, 400, 600, 10_000 * WAD);

        (uint256 fillable, uint256 cost, uint16 finalTick) = tickBook.getQuote(marketKey, 1, 500 * WAD);

        assertGt(fillable, 0);
        assertGt(cost, 0);
        assertGt(finalTick, 500);

        console2.log("Quote - Fillable:", fillable / WAD);
        console2.log("Quote - Cost:", cost / WAD);
        console2.log("Quote - Final Tick:", finalTick);
    }

    // ============================================
    // Edge Cases
    // ============================================

    function test_MultipleCrossingRanges() public {
        // Create liquidity at different price levels
        vm.startPrank(alice);
        tickBook.placeRangeOrder(marketKey, 0, 400, 500, 5_000 * WAD);
        tickBook.placeRangeOrder(marketKey, 0, 500, 600, 7_500 * WAD);
        tickBook.placeRangeOrder(marketKey, 0, 600, 700, 2_500 * WAD);
        vm.stopPrank();

        // Large order that crosses multiple ranges
        vm.prank(bob);
        (uint256 filled, uint256 cost,) = tickBook.executeMarketOrder(marketKey, 1, 2000 * WAD, 2000 * WAD);

        assertGt(filled, 0);
        console2.log("Cross-range fill:", filled / WAD);
        console2.log("Cross-range cost:", cost / WAD);

        (uint16 finalTick,,,) = tickBook.getMarketState(marketKey);
        console2.log("Final tick after cross-range:", finalTick);
    }

    function test_MarketNotLive_RevertOnTrade() public {
        vm.prank(alice);
        tickBook.placeRangeOrder(marketKey, 0, 400, 600, 1_000 * WAD);

        // Settle the market
        market.setLive(false);

        vm.prank(bob);
        vm.expectRevert(bytes("!live"));
        tickBook.executeMarketOrder(marketKey, 1, 100 * WAD, 100 * WAD);
    }

    function test_BoundarySafety_TickUpperMax_CancelDoesNotRevert() public {
        // Place an order that ends at MAX_TICK (999). This exercises the tickUpper+1 boundary path.
        vm.startPrank(alice);
        (uint256 orderId,,) = tickBook.placeRangeOrder(marketKey, 0, 900, 999, 1_000 * WAD);
        tickBook.cancelOrder(marketKey, orderId);
        vm.stopPrank();
    }

    function test_Attribution_NotDilutedByLateLiquidity() public {
        // Maker A adds liquidity
        vm.prank(alice);
        (uint256 aOrder,,) = tickBook.placeRangeOrder(marketKey, 0, 400, 600, 10_000 * WAD);

        // Trade 1 (only A active)
        vm.prank(charlie);
        tickBook.executeMarketOrder(marketKey, 1, 500 * WAD, 500 * WAD);

        // Maker B adds liquidity later
        vm.prank(bob);
        (uint256 bOrder,,) = tickBook.placeRangeOrder(marketKey, 0, 400, 600, 10_000 * WAD);

        // Trade 2 (A and B both active)
        vm.prank(charlie);
        tickBook.executeMarketOrder(marketKey, 1, 500 * WAD, 500 * WAD);

        // Claims
        vm.prank(alice);
        (uint256 aFills,) = tickBook.claimFills(marketKey, aOrder);

        vm.prank(bob);
        (uint256 bFills,) = tickBook.claimFills(marketKey, bOrder);

        // A should have at least as many fills as B (A participated in both periods).
        assertGt(aFills, bFills);
    }

    // ============================================
    // Spot Sell Tests
    // ============================================

    function test_ExecuteSpotSell_SellYes() public {
        // First: Alice provides liquidity (NO side) so there's something to match against
        vm.prank(alice);
        tickBook.placeRangeOrder(marketKey, 0, 400, 600, 10_000 * WAD);

        // Bob buys YES to get internal shares
        vm.prank(bob);
        tickBook.executeMarketOrder(marketKey, 1, 100 * WAD, 100 * WAD);

        // Verify Bob has YES shares
        (uint256 yesShares, uint256 noShares) = vault.getInternalOutcomes(address(market), bob);
        assertEq(yesShares, 100 * WAD, "Bob should have YES shares");
        assertEq(noShares, 0, "Bob should have no NO shares");

        // Bob sells his YES shares
        uint256 bobUsdcBefore = vault.availableUsdcWad(bob);
        
        vm.prank(bob);
        (uint256 sold, uint256 proceeds) = tickBook.executeSpotSell(marketKey, 1, 50 * WAD, 0);

        console2.log("Spot sold:", sold);
        console2.log("Proceeds:", proceeds);

        // Verify
        assertEq(sold, 50 * WAD, "Should sell 50 shares");
        assertGt(proceeds, 0, "Should receive proceeds");

        // Bob's YES balance should be reduced
        (uint256 yesAfter,) = vault.getInternalOutcomes(address(market), bob);
        assertEq(yesAfter, 50 * WAD, "Bob should have 50 YES remaining");

        // Bob's USDC should increase
        uint256 bobUsdcAfter = vault.availableUsdcWad(bob);
        assertEq(bobUsdcAfter - bobUsdcBefore, proceeds, "Bob should receive proceeds");
    }

    function test_ExecuteSpotSell_SellNo() public {
        // First: Charlie provides liquidity (YES side) so there's something to match against
        vm.prank(charlie);
        tickBook.placeRangeOrder(marketKey, 1, 400, 600, 10_000 * WAD);

        // Bob buys NO to get internal shares
        vm.prank(bob);
        tickBook.executeMarketOrder(marketKey, 0, 100 * WAD, 100 * WAD);

        // Verify Bob has NO shares
        (uint256 yesShares, uint256 noShares) = vault.getInternalOutcomes(address(market), bob);
        assertEq(yesShares, 0, "Bob should have no YES shares");
        assertEq(noShares, 100 * WAD, "Bob should have NO shares");

        // Bob sells his NO shares
        vm.prank(bob);
        (uint256 sold, uint256 proceeds) = tickBook.executeSpotSell(marketKey, 0, 50 * WAD, 0);

        console2.log("Spot sold NO:", sold);
        console2.log("Proceeds:", proceeds);

        assertEq(sold, 50 * WAD, "Should sell 50 NO shares");
        assertGt(proceeds, 0, "Should receive proceeds");

        // Bob's NO balance should be reduced
        (, uint256 noAfter) = vault.getInternalOutcomes(address(market), bob);
        assertEq(noAfter, 50 * WAD, "Bob should have 50 NO remaining");
    }

    function test_GetSpotSellQuote() public {
        // Setup: Alice provides liquidity
        vm.prank(alice);
        tickBook.placeRangeOrder(marketKey, 0, 400, 600, 10_000 * WAD);

        // Get quote for selling YES
        (uint256 sellable, uint256 proceeds, uint16 finalTick) = tickBook.getSpotSellQuote(marketKey, 1, 100 * WAD);

        console2.log("Spot sell quote - Sellable:", sellable);
        console2.log("Spot sell quote - Proceeds:", proceeds);
        console2.log("Spot sell quote - Final Tick:", finalTick);

        assertGt(sellable, 0, "Should be able to sell some");
        assertGt(proceeds, 0, "Should receive proceeds");
    }

    function test_PlaceSpotSellOrder() public {
        // First: Bob gets some YES shares
        vm.prank(alice);
        tickBook.placeRangeOrder(marketKey, 0, 400, 600, 10_000 * WAD);

        vm.prank(bob);
        tickBook.executeMarketOrder(marketKey, 1, 100 * WAD, 100 * WAD);

        // Bob places a spot sell limit order
        vm.prank(bob);
        uint256 orderId = tickBook.placeSpotSellOrder(marketKey, 1, 500, 600, 50 * WAD);

        console2.log("Spot sell order ID:", orderId);

        // Verify order was created
        assertGt(orderId, 1_000_000_000, "Order ID should be in spot order range");

        // Verify Bob's shares are locked
        (uint256 yesRemaining,) = vault.getInternalOutcomes(address(market), bob);
        assertEq(yesRemaining, 50 * WAD, "50 YES should remain unlocked");

        uint256 lockedYes = vault.getLockedOutcome(address(market), bob, 1);
        assertEq(lockedYes, 50 * WAD, "50 YES should be locked");
    }

    function test_CancelSpotSellOrder() public {
        // Setup: Bob gets shares and places sell order
        vm.prank(alice);
        tickBook.placeRangeOrder(marketKey, 0, 400, 600, 10_000 * WAD);

        vm.prank(bob);
        tickBook.executeMarketOrder(marketKey, 1, 100 * WAD, 100 * WAD);

        vm.prank(bob);
        uint256 orderId = tickBook.placeSpotSellOrder(marketKey, 1, 500, 600, 50 * WAD);

        // Cancel the order
        vm.prank(bob);
        (uint256 sharesReturned,) = tickBook.cancelSpotSellOrder(marketKey, orderId);

        assertEq(sharesReturned, 50 * WAD, "50 YES should be returned");

        // Verify shares are unlocked
        (uint256 yesBalance,) = vault.getInternalOutcomes(address(market), bob);
        assertEq(yesBalance, 100 * WAD, "All YES should be available again");

        uint256 lockedYes = vault.getLockedOutcome(address(market), bob, 1);
        assertEq(lockedYes, 0, "No YES should be locked");
    }

    function test_ExecuteSpotSell_SlippageProtection() public {
        // Setup
        vm.prank(alice);
        tickBook.placeRangeOrder(marketKey, 0, 400, 600, 10_000 * WAD);

        vm.prank(bob);
        tickBook.executeMarketOrder(marketKey, 1, 100 * WAD, 100 * WAD);

        // Try to sell with unreasonable minProceeds
        vm.prank(bob);
        vm.expectRevert(bytes("slip"));
        tickBook.executeSpotSell(marketKey, 1, 50 * WAD, 100 * WAD); // Want 100 USDC for 50 shares at ~50% price
    }

    function test_ExecuteSpotSell_NoLiquidity() public {
        // Bob has shares but no liquidity on opposite side
        // First get shares via direct credit (simulate)
        // For this test, we need to set up a market order first
        vm.prank(alice);
        tickBook.placeRangeOrder(marketKey, 0, 400, 600, 10_000 * WAD);

        vm.prank(bob);
        tickBook.executeMarketOrder(marketKey, 1, 100 * WAD, 100 * WAD);

        // Now cancel Alice's liquidity
        vm.startPrank(alice);
        uint256[] memory orders = tickBook.getUserOrders(marketKey, alice);
        for (uint i = 0; i < orders.length; i++) {
            tickBook.cancelOrder(marketKey, orders[i]);
        }
        vm.stopPrank();

        // Try to spot sell with no liquidity
        vm.prank(bob);
        vm.expectRevert(bytes("!buy"));
        tickBook.executeSpotSell(marketKey, 1, 50 * WAD, 0);
    }

    // ════════════════════════════════════════════════════════════════════════
    // Limit Order Crossing Tests
    // ════════════════════════════════════════════════════════════════════════

    function test_LimitOrderCrossing_BasicMatch() public {
        // CORRECT SEMANTICS:
        // - outcome=0: You receive NO tokens when matched (provide liquidity for YES buyers)
        // - outcome=1: You receive YES tokens when matched (provide liquidity for NO buyers)
        
        // Alice places outcome=0 order (she will receive NO tokens when crossed)
        vm.prank(alice);
        (uint256 aliceOrderId, uint256 aliceCrossFilled,) = 
            tickBook.placeRangeOrder(marketKey, 0, 400, 600, 1_000 * WAD);

        // No crossing yet - no opposite liquidity
        assertEq(aliceCrossFilled, 0, "Alice should have no crossing fill (no opposite liquidity)");

        // Bob places outcome=1 order (he will receive YES tokens when crossed)
        // This should cross with Alice's order at the current tick (500 = 50%)
        vm.prank(bob);
        (, uint256 bobCrossFilled,) = 
            tickBook.placeRangeOrder(marketKey, 1, 400, 600, 1_000 * WAD);

        // Bob's order should have crossed with Alice's
        console2.log("Bob cross filled:", bobCrossFilled);
        assertTrue(bobCrossFilled > 0, "Bob should have some crossing fill");

        // Bob (new order) gets YES immediately via direct credit
        (uint256 bobYes,) = vault.getInternalOutcomes(address(market), bob);
        console2.log("Bob YES balance (immediate):", bobYes);
        assertTrue(bobYes > 0, "Bob should have received YES tokens immediately from cross");

        // Alice needs to claim her fills to get NO tokens (via global fill growth)
        vm.prank(alice);
        tickBook.claimFills(marketKey, aliceOrderId);

        (, uint256 aliceNo) = vault.getInternalOutcomes(address(market), alice);
        console2.log("Alice NO balance (after claim):", aliceNo);
        assertTrue(aliceNo > 0, "Alice should have received NO tokens after claiming");
    }

    function test_LimitOrderCrossing_OverlappingRanges() public {
        // User places wide range order on both sides - should cross with self
        // CORRECT SEMANTICS:
        // - outcome=0: receive NO tokens
        // - outcome=1: receive YES tokens

        // Alice places outcome=0 spanning almost full range (will receive NO when crossed)
        vm.prank(alice);
        (uint256 firstOrderId, uint256 firstCrossFilled,) = 
            tickBook.placeRangeOrder(marketKey, 0, 1, 999, 10_000 * WAD);

        assertEq(firstCrossFilled, 0, "First order should have no cross");

        // Alice places outcome=1 spanning almost full range (will receive YES when crossed)
        // This should cross with her own outcome=0 order
        vm.prank(alice);
        (, uint256 secondCrossFilled,) = 
            tickBook.placeRangeOrder(marketKey, 1, 1, 999, 10_000 * WAD);

        console2.log("Second order cross filled:", secondCrossFilled);
        assertTrue(secondCrossFilled > 0, "Overlapping orders should cross");

        // Alice gets YES immediately from the second order (outcome=1)
        (uint256 aliceYes,) = vault.getInternalOutcomes(address(market), alice);
        console2.log("Alice YES (immediate):", aliceYes);
        assertTrue(aliceYes > 0, "Alice should have YES from second order cross");

        // Alice claims fills on her first order to get NO (outcome=0)
        vm.prank(alice);
        tickBook.claimFills(marketKey, firstOrderId);

        (, uint256 aliceNo) = vault.getInternalOutcomes(address(market), alice);
        console2.log("Alice NO (after claim):", aliceNo);
        assertTrue(aliceNo > 0, "Alice should have NO after claiming first order");
    }

    function test_LimitOrderCrossing_NoCrossIfOutsideRange() public {
        // Alice places BUY YES order ABOVE current tick (won't include current tick)
        vm.prank(alice);
        (,uint256 yesCrossFilled,) = tickBook.placeRangeOrder(marketKey, 0, 600, 800, 1_000 * WAD);
        assertEq(yesCrossFilled, 0, "Order above current tick has no cross");

        // Bob places BUY NO order BELOW current tick
        vm.prank(bob);
        (,uint256 noCrossFilled,) = tickBook.placeRangeOrder(marketKey, 1, 200, 400, 1_000 * WAD);
        assertEq(noCrossFilled, 0, "Order below current tick has no cross");

        // Neither should have tokens (no cross happened)
        (uint256 aliceYes,) = vault.getInternalOutcomes(address(market), alice);
        (, uint256 bobNo) = vault.getInternalOutcomes(address(market), bob);

        assertEq(aliceYes, 0, "Alice should have no YES (order outside current tick)");
        assertEq(bobNo, 0, "Bob should have no NO (order outside current tick)");
    }
}
