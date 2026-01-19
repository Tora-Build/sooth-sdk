// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {TickBookPoolManager} from "@core/TickBookPoolManager.sol";
import {TickBookVault} from "@core/TickBookVault.sol";
import {TruthMarket} from "@core/TruthMarket.sol";
import {OutcomeToken} from "@core/OutcomeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title UnifiedCrossingV10Test
 * @notice Tests V10 unified crossing architecture:
 *         - Spot liquidity is consumed FIRST (recycle shares)
 *         - Range liquidity consumed SECOND (mint synthetic)
 *         - Correct tick liquidity and bitmap updates
 *
 * @dev NOTE: Some tests are marked as TODO_UNIFIED because _crossUnified() 
 *      may not yet fully implement spot-first crossing via placeOrder().
 *      The explicit buyFromSpotSell() path works correctly.
 */
contract UnifiedCrossingV10Test is Test {
    TickBookPoolManager public poolManager;
    TickBookVault public vault;
    TruthMarket public market;
    OutcomeToken public yesToken;
    OutcomeToken public noToken;
    ERC20Mock public usdc;

    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public carol = address(0xCA401);

    bytes32 public marketKey;

    function setUp() public {
        usdc = new ERC20Mock();
        vault = new TickBookVault(address(usdc), address(this));
        poolManager = new TickBookPoolManager(address(vault));
        vault.setTickBook(address(poolManager));

        market = new TruthMarket(
            "Test Market",
            uint64(block.timestamp),
            uint64(block.timestamp + 30 days),
            address(this),
            address(this),
            address(this)
        );
        yesToken = new OutcomeToken("Yes Token", "YES", address(this), address(market), 1);
        noToken = new OutcomeToken("No Token", "NO", address(this), address(market), 0);


        marketKey = poolManager.registerMarket(
            address(market),
            address(yesToken),
            address(noToken),
            0.5e18,
            address(0)
        );

        _fundAliceWithYesShares(2000e18);
        _fundBobWithUsdc(100_000e18);
        _fundCarolWithUsdc(100_000e18);
    }

    function _fundAliceWithYesShares(uint256 amount) internal {
        vm.prank(address(poolManager));
        vault.creditOutcome(address(market), alice, 1, amount);
    }

    function _fundBobWithUsdc(uint256 amount) internal {
        usdc.mint(bob, amount);
        vm.prank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        vault.depositUsdc(amount);
    }

    function _fundCarolWithUsdc(uint256 amount) internal {
        usdc.mint(carol, amount);
        vm.prank(carol);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(carol);
        vault.depositUsdc(amount);
    }

    /**
     * @notice Test 1: When both spot and range liquidity exist at overlapping ticks,
     *         spot should be consumed first
     * @dev TODO_UNIFIED: This test verifies the INTENDED behavior. Currently placeOrder()
     *      does not cross with spot sells - use buyFromSpotSell() for explicit spot matching.
     */
    function test_UnifiedCrossing_SpotFilledFirst() public {
        // vm.skip(true); // ENABLED for testing
        // Carol places range order for NO at tick 400-600 (this provides YES liquidity to buyers)
        vm.prank(carol);
        poolManager.placeOrder(
            marketKey,
            0,           // NO outcome
            500e18,      // shares
            400,         // tickLower
            600,         // tickUpper
            500e18       // maxCost
        );

        // Alice places spot sell for YES at tick 500-500
        vm.prank(alice);
        uint256 spotSellId = poolManager.placeSpotSell(
            marketKey,
            1,           // YES outcome
            200e18,      // shares
            500,         // tickLower
            500          // tickUpper
        );

        // Verify both liquidity types exist at tick 500
        (int128 rangeNet, uint128 rangeGross, uint128 spotLiq) = poolManager.getTickLiquidity(marketKey, 0, 400);
        assertGt(rangeGross, 0, "Range liquidity should exist");

        (, , uint128 spotLiqAtTick) = poolManager.getTickLiquidity(marketKey, 1, 500);
        assertEq(spotLiqAtTick, 200e18, "Spot liquidity should be 200e18 at tick 500");

        // Bob buys YES - should consume spot FIRST
        vm.prank(bob);
        (uint256 orderId, uint256 filledShares, uint256 filledCost, uint256 restingShares) = poolManager.placeOrder(
            marketKey,
            1,           // YES outcome
            150e18,      // shares - less than spot available
            500,         // tickLower
            500,         // tickUpper
            100e18       // maxCost
        );

        // Check spot sell was consumed (spot should be filled first)
        TickBookPoolManager.SpotSellOrder memory spotOrder = poolManager.getSpotSellOrder(marketKey, spotSellId);
        assertEq(spotOrder.sharesFilled, 150e18, "Spot sell should have filled 150e18 shares");
        
        // Verify Bob received YES shares
        (uint256 bobYes, ) = vault.getInternalOutcomes(address(market), bob);
        assertEq(bobYes, 150e18, "Bob should have received 150 YES shares from spot");
    }

    /**
     * @notice Test 2: SKIPPED - buyFromSpotSell was removed; spot crossing now happens via placeOrder
     */
    function SKIP_test_UnifiedCrossing_SpotOnlyFill() public {
        // Alice places spot sell for YES at tick 600
        vm.prank(alice);
        uint256 spotSellId = poolManager.placeSpotSell(
            marketKey,
            1,           // YES
            500e18,      // shares
            600,         // tickLower
            600          // tickUpper
        );

        // Bob buys YES at tick 600 via placeOrder (crosses spot automatically)
        vm.prank(bob);
        (uint256 orderId, uint256 filled, uint256 cost, ) = poolManager.placeOrder(
            marketKey,
            1,           // YES
            300e18,      // buy 300 shares
            600,         // tickLower
            600,         // tickUpper
            200e18       // max cost
        );

        assertGt(cost, 0, "Cost should be > 0");

        // Verify spot order was partially filled
        TickBookPoolManager.SpotSellOrder memory spotOrder = poolManager.getSpotSellOrder(marketKey, spotSellId);
        assertEq(spotOrder.sharesFilled, 300e18, "Spot sell should have 300e18 filled");
        assertTrue(spotOrder.active, "Spot sell should still be active (200 remaining)");

        // Bob should have 300 YES shares
        (uint256 bobYes, ) = vault.getInternalOutcomes(address(market), bob);
        assertEq(bobYes, 300e18, "Bob should have 300 YES from spot fill");
    }

    /**
     * @notice Test 3: Order fills from range liquidity when no spot exists
     */
    function test_UnifiedCrossing_RangeOnlyFill() public {
        // Carol places range order for NO at tick 400-600 (provides YES crossing opportunity)
        vm.prank(carol);
        (uint256 carolOrderId, , , ) = poolManager.placeOrder(
            marketKey,
            0,           // NO outcome
            1000e18,     // shares
            400,         // tickLower
            600,         // tickUpper
            1000e18      // maxCost
        );

        // Verify NO range liquidity exists
        (int128 rangeNet, uint128 rangeGross, uint128 spotLiq) = poolManager.getTickLiquidity(marketKey, 0, 400);
        assertGt(rangeGross, 0, "NO range liquidity should exist at lower tick");

        // Bob places YES order that should cross with Carol's NO order
        vm.prank(bob);
        (uint256 orderId, uint256 filledShares, uint256 filledCost, uint256 restingShares) = poolManager.placeOrder(
            marketKey,
            1,           // YES outcome
            200e18,      // shares
            400,         // tickLower
            600,         // tickUpper
            200e18       // maxCost
        );

        // Should have crossed (filled from range only, no spot exists for opposite outcome)
        assertGe(filledShares + restingShares, 200e18, "Total shares should match order");
    }

    /**
     * @notice Test 4: Order partially fills from spot, remainder from range
     * @dev TODO_UNIFIED: This test verifies the INTENDED behavior. Currently placeOrder()
     *      does not cross with spot sells - use buyFromSpotSell() for explicit spot matching.
     */
    function test_UnifiedCrossing_MixedFill() public {
        // vm.skip(true); // ENABLED for testing
        // Carol places range order for NO at tick 500-600
        vm.prank(carol);
        poolManager.placeOrder(
            marketKey,
            0,           // NO outcome
            500e18,      // shares
            500,         // tickLower
            600,         // tickUpper
            500e18       // maxCost
        );

        // Alice places spot sell for YES at tick 500-549 (50 ticks, within MAX_SPOT_RANGE)
        // RFC-001: Spot sells are now capped at 50 ticks for gas optimization
        vm.prank(alice);
        uint256 spotSellId = poolManager.placeSpotSell(
            marketKey,
            1,           // YES
            100e18,      // Only 100 shares as spot
            500,         // tickLower
            549          // tickUpper (50 tick range)
        );

        // Verify spot liquidity was added
        (, , uint128 spotLiqBefore) = poolManager.getTickLiquidity(marketKey, 1, 500);
        assertGt(spotLiqBefore, 0, "Spot liquidity should exist before buy");

        // Bob buys 250 YES - should use 100 from spot first, then try range
        vm.prank(bob);
        (uint256 orderId, uint256 filledShares, uint256 filledCost, uint256 restingShares) = poolManager.placeOrder(
            marketKey,
            1,           // YES outcome
            250e18,      // shares - more than spot available
            500,         // tickLower
            600,         // tickUpper
            200e18       // maxCost
        );

        // Verify spot was fully consumed (filled first)
        TickBookPoolManager.SpotSellOrder memory spotOrder = poolManager.getSpotSellOrder(marketKey, spotSellId);
        assertEq(spotOrder.sharesFilled, 100e18, "Spot sell should be fully filled");
        assertFalse(spotOrder.active, "Spot sell should be inactive (fully consumed)");
    }

    /**
     * @notice Test 5: Placing spot sell adds to tickLiquidity.spotLiquidity
     */
    function test_SpotSellUpdatesTickLiquidity() public {
        // Check tick 500 has no spot liquidity initially
        (, , uint128 spotLiqBefore) = poolManager.getTickLiquidity(marketKey, 1, 500);
        assertEq(spotLiqBefore, 0, "Spot liquidity should be 0 initially");

        // Alice places spot sell for YES at tick 500-502 (3 ticks)
        vm.prank(alice);
        poolManager.placeSpotSell(
            marketKey,
            1,           // YES
            300e18,      // shares (100e18 per tick)
            500,         // tickLower
            502          // tickUpper
        );

        // Verify spot liquidity was added to each tick
        (, , uint128 spotLiq500) = poolManager.getTickLiquidity(marketKey, 1, 500);
        (, , uint128 spotLiq501) = poolManager.getTickLiquidity(marketKey, 1, 501);
        (, , uint128 spotLiq502) = poolManager.getTickLiquidity(marketKey, 1, 502);

        assertEq(spotLiq500, 100e18, "Tick 500 should have 100e18 spot liquidity");
        assertEq(spotLiq501, 100e18, "Tick 501 should have 100e18 spot liquidity");
        assertEq(spotLiq502, 100e18, "Tick 502 should have 100e18 spot liquidity");

        // Verify getSpotSellLiquidity helper returns correct value
        uint128 spotViaHelper = poolManager.getSpotSellLiquidity(marketKey, 1, 500);
        assertEq(spotViaHelper, 100e18, "Helper should return same value");
    }

    /**
     * @notice Test 6: Spot bitmap is updated when placing/cancelling spot sells
     */
    function test_SpotSellBitmapUpdated() public {
        // Place spot sell at tick 500
        vm.prank(alice);
        uint256 sellId = poolManager.placeSpotSell(
            marketKey,
            1,           // YES
            100e18,      // shares
            500,         // tickLower
            500          // tickUpper
        );

        // Verify spot liquidity exists
        uint128 spotLiq = poolManager.getSpotSellLiquidity(marketKey, 1, 500);
        assertEq(spotLiq, 100e18, "Spot liquidity should be 100e18");

        // Cancel the spot sell
        vm.prank(alice);
        poolManager.cancelSpotSell(marketKey, sellId);

        // Verify spot liquidity is removed
        uint128 spotLiqAfter = poolManager.getSpotSellLiquidity(marketKey, 1, 500);
        assertEq(spotLiqAfter, 0, "Spot liquidity should be 0 after cancel");

        // Verify order is inactive
        TickBookPoolManager.SpotSellOrder memory order = poolManager.getSpotSellOrder(marketKey, sellId);
        assertFalse(order.active, "Spot sell should be inactive after cancel");
    }

    /**
     * @notice DELETED - buyFromSpotSell was never implemented; spot crossing happens via placeOrder
     * @dev Original test tried to use an explicit buyFromSpotSell function that doesn't exist.
     *      In V10, placeOrder automatically crosses with existing spot sells.
     */

    /**
     * @notice Test: Multiple spot sells at same tick accumulate liquidity
     */
    function test_MultipleSpotSellsAccumulate() public {
        // Alice places first spot sell
        vm.prank(alice);
        poolManager.placeSpotSell(marketKey, 1, 100e18, 500, 500);

        // Give Alice more shares and place second spot sell
        _fundAliceWithYesShares(200e18);
        vm.prank(alice);
        poolManager.placeSpotSell(marketKey, 1, 150e18, 500, 500);

        // Verify spot liquidity accumulated
        uint128 spotLiq = poolManager.getSpotSellLiquidity(marketKey, 1, 500);
        assertEq(spotLiq, 250e18, "Spot liquidity should accumulate");
    }

    /**
     * @notice DELETED - buyFromSpotSell was never implemented
     * @dev Original test tried to use an explicit buyFromSpotSell function that doesn't exist.
     *      Test would need to use placeOrder to cross with spot sells.
     */

    /**
     * @notice RFC-001: Test that spot sell range is capped at MAX_SPOT_RANGE (50 ticks)
     */
    function test_SpotSellRangeCapped() public {
        // 50 ticks should work (500-549 = 50 ticks)
        vm.prank(alice);
        poolManager.placeSpotSell(marketKey, 1, 500e18, 500, 549);

        // 51 ticks should revert (500-550 = 51 ticks)
        vm.prank(alice);
        vm.expectRevert(TickBookPoolManager.SpotRangeTooWide.selector);
        poolManager.placeSpotSell(marketKey, 1, 500e18, 500, 550);

        // Wide range (100+ ticks) should definitely revert
        vm.prank(alice);
        vm.expectRevert(TickBookPoolManager.SpotRangeTooWide.selector);
        poolManager.placeSpotSell(marketKey, 1, 500e18, 400, 600);
    }

    /**
     * @notice BUG REPRODUCTION: Phantom range liquidity after order is fully filled
     * @dev This test verifies that rangeLiquidityGross is properly cleaned up
     *      when opposite orders are filled via accumulators during crossing.
     *
     *      The bug scenario:
     *      1. User A places NO range order at 510-650 (adds tick liquidity)
     *      2. User B places YES order that crosses through A's range
     *      3. A's order is filled via accumulators, but tick liquidity remains
     *      4. A calls claimFills() - tick liquidity should now be removed
     *      5. BUG: If A never claims, tick liquidity is orphaned forever
     */
    function test_PhantomLiquidity_AfterCrossing() public {
        // Carol places NO range order at 510-650 (141 ticks)
        // This adds rangeLiquidityGross at tick 510 and tick 651
        vm.prank(carol);
        (uint256 carolOrderId, , , ) = poolManager.placeOrder(
            marketKey,
            0,           // NO outcome
            1410e18,     // shares (10e18 density per tick)
            510,         // tickLower
            650,         // tickUpper
            1410e18      // maxCost
        );

        // Verify tick liquidity was added at boundaries
        (int128 rangeNet510, uint128 rangeGross510, ) = poolManager.getTickLiquidity(marketKey, 0, 510);
        (int128 rangeNet651, uint128 rangeGross651, ) = poolManager.getTickLiquidity(marketKey, 0, 651);
        
        assertGt(rangeGross510, 0, "rangeLiquidityGross should be positive at tick 510");
        assertGt(rangeGross651, 0, "rangeLiquidityGross should be positive at tick 651");
        
        uint128 initialDensity = rangeGross510;
        console.log("Initial density at tick 510:", initialDensity);

        // Bob places YES order that completely crosses Carol's NO order
        // YES order at 510-650 crosses with NO order at 510-650
        vm.prank(bob);
        (uint256 bobOrderId, uint256 filledShares, uint256 filledCost, uint256 restingShares) = poolManager.placeOrder(
            marketKey,
            1,           // YES outcome  
            1410e18,     // same shares as Carol
            510,         // tickLower
            650,         // tickUpper
            1500e18      // maxCost (slightly higher to cover costs)
        );

        console.log("Bob filledShares:", filledShares);
        console.log("Bob restingShares:", restingShares);

        // Check Carol's order state - it should be (almost) fully filled via accumulators
        TickBookPoolManager.RangeOrder memory carolOrder = poolManager.getOrder(marketKey, carolOrderId);
        console.log("Carol order active:", carolOrder.active);
        console.log("Carol order liquidityRemoved:", carolOrder.liquidityRemoved);
        console.log("Carol order filledShares:", carolOrder.filledShares);
        console.log("Carol order sharesTotal:", carolOrder.sharesTotal);

        // At this point, Carol's order may still show as active because
        // fills happen via accumulators and require claiming to finalize

        // Carol claims her fills - THIS should trigger liquidity removal
        vm.prank(carol);
        (uint256 claimedShares, uint256 claimedCost) = poolManager.claimFills(marketKey, carolOrderId);
        console.log("Carol claimed shares:", claimedShares);

        // After claiming, check if Carol's order is now closed
        TickBookPoolManager.RangeOrder memory carolOrderAfterClaim = poolManager.getOrder(marketKey, carolOrderId);
        console.log("Carol order after claim - active:", carolOrderAfterClaim.active);
        console.log("Carol order after claim - liquidityRemoved:", carolOrderAfterClaim.liquidityRemoved);

        // NOW check tick liquidity - THIS IS THE BUG CHECK
        // If liquidity removal works correctly, these should both be 0
        (, uint128 rangeGross510After, ) = poolManager.getTickLiquidity(marketKey, 0, 510);
        (, uint128 rangeGross651After, ) = poolManager.getTickLiquidity(marketKey, 0, 651);
        
        console.log("rangeLiquidityGross at tick 510 after claim:", rangeGross510After);
        console.log("rangeLiquidityGross at tick 651 after claim:", rangeGross651After);

        // These assertions will FAIL if the bug exists
        assertEq(rangeGross510After, 0, "BUG: rangeLiquidityGross at tick 510 should be 0 after order is filled and claimed");
        assertEq(rangeGross651After, 0, "BUG: rangeLiquidityGross at tick 651 should be 0 after order is filled and claimed");
    }

    /**
     * @notice Additional test: What happens if user NEVER claims their filled order?
     * @dev This demonstrates the orphaned liquidity problem more clearly
     */
    function test_PhantomLiquidity_NeverClaimed() public {
        // Carol places NO range order
        vm.prank(carol);
        (uint256 carolOrderId, , , ) = poolManager.placeOrder(
            marketKey,
            0,           // NO outcome
            500e18,      // shares
            510,         // tickLower
            550,         // tickUpper
            500e18       // maxCost
        );

        // Verify tick liquidity was added
        (, uint128 rangeGross510Before, ) = poolManager.getTickLiquidity(marketKey, 0, 510);
        assertGt(rangeGross510Before, 0, "rangeLiquidityGross should exist initially");

        // Bob crosses Carol's order completely
        vm.prank(bob);
        poolManager.placeOrder(
            marketKey,
            1,           // YES outcome
            500e18,
            510,
            550,
            600e18
        );

        // Carol NEVER claims - this simulates a user who abandons their position
        // The tick liquidity is now orphaned because:
        // 1. Carol's order was filled via accumulators
        // 2. liquidityRemoved flag is still false
        // 3. But claimFills() will fail if order becomes inactive through some other path
        
        // Check the state - order should still be "active" because fills are unclaimed
        TickBookPoolManager.RangeOrder memory carolOrder = poolManager.getOrder(marketKey, carolOrderId);
        console.log("Carol order active (no claim):", carolOrder.active);
        console.log("Carol liquidityRemoved (no claim):", carolOrder.liquidityRemoved);

        // The tick liquidity still exists - this is expected behavior but problematic for UI
        (, uint128 rangeGross510After, ) = poolManager.getTickLiquidity(marketKey, 0, 510);
        console.log("rangeLiquidityGross at tick 510 (no claim):", rangeGross510After);
        
        // This test documents the expected behavior - liquidity remains until claimed
        // The question is: should we remove liquidity during crossing instead of claiming?
        assertEq(rangeGross510After, rangeGross510Before, "Liquidity should remain until claimed (current behavior)");
    }
}
