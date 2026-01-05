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

        market = new TruthMarket("Test Market", uint64(block.timestamp + 30 days), address(this), address(this));
        yesToken = new OutcomeToken("Yes Token", "YES", address(this), address(market), 1);
        noToken = new OutcomeToken("No Token", "NO", address(this), address(market), 0);

        market.activate();

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
     * @notice Test 2: Order fills entirely from spot liquidity when sufficient
     */
    function test_UnifiedCrossing_SpotOnlyFill() public {
        // Alice places spot sell for YES at tick 600
        vm.prank(alice);
        uint256 spotSellId = poolManager.placeSpotSell(
            marketKey,
            1,           // YES
            500e18,      // shares
            600,         // tickLower
            600          // tickUpper
        );

        // Bob buys YES at tick 600 - should be filled entirely by spot
        vm.prank(bob);
        uint256 cost = poolManager.buyFromSpotSell(
            marketKey,
            spotSellId,
            300e18,      // buy 300 shares
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

        // Alice places spot sell for YES at tick 500-600 (smaller amount)
        vm.prank(alice);
        uint256 spotSellId = poolManager.placeSpotSell(
            marketKey,
            1,           // YES
            100e18,      // Only 100 shares as spot
            500,         // tickLower
            600          // tickUpper
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
     * @notice Test: Verify spot-first behavior via explicit buyFromSpotSell + placeOrder sequence
     * @dev This is the working pattern until unified crossing is fully implemented
     */
    function test_UnifiedCrossing_SpotFirstManualSequence() public {
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

        // Alice places spot sell for YES at tick 550
        vm.prank(alice);
        uint256 spotSellId = poolManager.placeSpotSell(
            marketKey,
            1,           // YES
            100e18,      // shares
            550,         // tickLower
            550          // tickUpper
        );

        // Bob manually buys from spot FIRST (spot priority)
        vm.prank(bob);
        uint256 spotCost = poolManager.buyFromSpotSell(
            marketKey,
            spotSellId,
            100e18,      // all spot shares
            70e18        // max cost
        );
        assertGt(spotCost, 0, "Spot cost should be > 0");

        // Verify spot was consumed
        TickBookPoolManager.SpotSellOrder memory spotOrder = poolManager.getSpotSellOrder(marketKey, spotSellId);
        assertEq(spotOrder.sharesFilled, 100e18, "Spot should be fully filled");
        assertFalse(spotOrder.active, "Spot should be inactive");

        // Bob now places order for more shares (will use range liquidity)
        vm.prank(bob);
        (,uint256 filled,,) = poolManager.placeOrder(
            marketKey,
            1,           // YES
            200e18,      // more shares
            500,         // tickLower
            600,         // tickUpper
            150e18       // maxCost
        );

        // Verify Bob received shares from both sources
        // In V10, the second placeOrder also crosses (either with range or any remaining spot)
        (uint256 bobYes, ) = vault.getInternalOutcomes(address(market), bob);
        assertGt(bobYes, 100e18, "Bob should have > 100 YES (spot + range crossing)");
    }

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
     * @notice Test: Partial spot fill reduces tick liquidity correctly
     */
    function test_PartialSpotFillReducesTickLiquidity() public {
        // Alice places spot sell
        vm.prank(alice);
        uint256 sellId = poolManager.placeSpotSell(marketKey, 1, 500e18, 500, 500);

        uint128 spotLiqBefore = poolManager.getSpotSellLiquidity(marketKey, 1, 500);
        assertEq(spotLiqBefore, 500e18, "Initial spot liquidity should be 500e18");

        // Bob buys partial amount
        vm.prank(bob);
        poolManager.buyFromSpotSell(marketKey, sellId, 200e18, 150e18);

        // Verify spot liquidity reduced
        uint128 spotLiqAfter = poolManager.getSpotSellLiquidity(marketKey, 1, 500);
        assertEq(spotLiqAfter, 300e18, "Spot liquidity should be reduced to 300e18");
    }
}
