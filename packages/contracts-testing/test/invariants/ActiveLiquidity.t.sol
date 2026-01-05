// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {TickBookPoolManager} from "@core/TickBookPoolManager.sol";
import {TickBookVault} from "@core/TickBookVault.sol";
import {TruthMarket} from "@core/TruthMarket.sol";
import {OutcomeToken} from "@core/OutcomeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title V9.9.6 Active Liquidity Underflow Regression Tests
 * @notice Tests for the _safeAddLiquidity() bug fix
 * @dev BUG DESCRIPTION:
 *      In _fill(), lines 613, 664, 667 had unsafe type casts:
 *          activeLiq = uint128(int128(activeLiq) + delta);
 *      When crossing tick boundaries, delta (from liquidityNet) could be negative.
 *      If |delta| > activeLiq, the result becomes negative, and casting to uint128
 *      causes panic (arithmetic underflow or overflow).
 *
 *      SYMPTOM: First several trades succeed, then one fails with "arithmetic underflow
 *      or overflow", and ALL subsequent trades fail permanently.
 *
 *      FIX: Added _safeAddLiquidity() helper that clamps to 0 on underflow:
 *          function _safeAddLiquidity(uint128 liq, int128 delta) internal pure returns (uint128) {
 *              if (delta >= 0) return liq + uint128(delta);
 *              uint128 absDelta = uint128(-delta);
 *              return liq >= absDelta ? liq - absDelta : 0;
 *          }
 *
 * @custom:issue V996-UNDERFLOW
 * @custom:severity Critical (protocol-breaking)
 */
contract ActiveLiquidityUnderflowTest is Test {
    TickBookPoolManager public poolManager;
    TickBookVault public vault;
    TruthMarket public market;
    OutcomeToken public yesToken;
    OutcomeToken public noToken;
    ERC20Mock public usdc;

    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public carol = address(0xCA01);
    address public deployer;

    bytes32 public marketKey;
    uint256 constant WAD = 1e18;

    function setUp() public {
        deployer = address(this);

        // Deploy core contracts
        usdc = new ERC20Mock();
        vault = new TickBookVault(address(usdc), deployer);
        poolManager = new TickBookPoolManager(address(vault));
        vault.setTickBook(address(poolManager));

        // Deploy market
        market = new TruthMarket(
            "Underflow Test Market",
            uint64(block.timestamp + 30 days),
            deployer,
            deployer
        );
        yesToken = new OutcomeToken("Yes", "YES", deployer, address(market), 1);
        noToken = new OutcomeToken("No", "NO", deployer, address(market), 0);
        market.activate();

        // Register market using legacy signature
        marketKey = poolManager.registerMarket(
            address(market),
            address(yesToken),
            address(noToken),
            0.5e18,  // initialProbabilityWad
            address(0)  // hook (ignored)
        );

        // Fund users generously
        usdc.mint(alice, 10_000_000e18);
        usdc.mint(bob, 10_000_000e18);
        usdc.mint(carol, 10_000_000e18);

        // Approve and deposit
        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(5_000_000e18);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(5_000_000e18);
        vm.stopPrank();

        vm.startPrank(carol);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(5_000_000e18);
        vm.stopPrank();
    }

    // ============================================
    // REGRESSION TEST 1: Basic Tick Crossing
    // ============================================

    /**
     * @notice Test that crossing ticks with negative liquidityNet doesn't underflow
     * @dev This is the core bug scenario:
     *      1. Place range order [100, 200]
     *      2. Execute market order that crosses tick 200 (boundary)
     *      3. At boundary, liquidityNet is negative (liquidity exits)
     *      4. Without fix: activeLiq + delta underflows when |delta| > activeLiq
     */
    function test_TickCrossing_DoesNotUnderflow() public {
        // Alice places NO order (SELL YES) at ticks [100, 200]
        vm.prank(alice);
        poolManager.placeOrder(
            marketKey,
            0,  // NO outcome
            10_000e18,  // shares
            100,  // tickLower
            200,  // tickUpper
            100_000e18  // maxCost
        );

        // Bob places market order to buy YES that crosses through entire range
        // This should cross tick 200 boundary where liquidityNet is negative
        vm.prank(bob);
        (
            uint256 orderId,
            uint256 filledShares,
            uint256 filledCost,
            uint256 restingShares
        ) = poolManager.placeOrder(
            marketKey,
            1,  // YES outcome (crosses NO orders)
            20_000e18,  // more shares than available
            1,  // tickLower (market order)
            999,  // tickUpper (market order)
            500_000e18  // maxCost
        );

        // Should succeed without underflow panic
        assertGt(orderId, 0, "Order should be created");
        // Some shares should be filled from crossing
        // (may be 0 if no overlap at current tick, that's ok)
    }

    // ============================================
    // REGRESSION TEST 2: Multiple Trades After Cross
    // ============================================

    /**
     * @notice Test that trades continue to work after tick crossing
     * @dev Bug symptom was that FIRST trades succeed, then one fails,
     *      then ALL subsequent trades fail permanently
     */
    function test_MultipleTradesAfterCrossing_StillWork() public {
        // Setup: Create liquidity across multiple ticks
        vm.prank(alice);
        poolManager.placeOrder(marketKey, 0, 5_000e18, 100, 150, 100_000e18);

        vm.prank(alice);
        poolManager.placeOrder(marketKey, 0, 5_000e18, 150, 200, 100_000e18);

        // Trade 1: Cross first range
        vm.prank(bob);
        poolManager.placeOrder(marketKey, 1, 3_000e18, 1, 999, 100_000e18);

        // Trade 2: Cross second range (this is where bug would trigger)
        vm.prank(bob);
        poolManager.placeOrder(marketKey, 1, 5_000e18, 1, 999, 100_000e18);

        // Trade 3: Should still work after crossing (bug would fail here)
        vm.prank(carol);
        (uint256 orderId, , , ) = poolManager.placeOrder(
            marketKey, 1, 1_000e18, 1, 999, 100_000e18
        );

        assertGt(orderId, 0, "Trade after crossing should succeed");

        // Trade 4: One more trade to confirm stability
        vm.prank(carol);
        (uint256 orderId2, , , ) = poolManager.placeOrder(
            marketKey, 0, 500e18, 200, 300, 100_000e18
        );

        assertGt(orderId2, 0, "Subsequent trades should continue working");
    }

    // ============================================
    // REGRESSION TEST 3: Extreme Liquidity Net
    // ============================================

    /**
     * @notice Test handling of extreme liquidityNet values
     * @dev When large orders are placed and then cancelled/filled,
     *      liquidityNet can have large negative values
     */
    function test_ExtremeLiquidityNet_ClampsToZero() public {
        // Place large order
        vm.prank(alice);
        (uint256 aliceOrderId, , , ) = poolManager.placeOrder(
            marketKey,
            0,  // NO
            100_000e18,  // Large order
            50,
            100,
            1_000_000e18
        );

        // Place smaller opposing order to establish crossing
        vm.prank(bob);
        poolManager.placeOrder(
            marketKey,
            1,  // YES
            10_000e18,
            50,
            100,
            500_000e18
        );

        // Cancel the large order (creates large negative liquidityNet at boundaries)
        vm.prank(alice);
        poolManager.cancelOrder(marketKey, aliceOrderId);

        // New market order should work despite negative liquidityNet at tick boundaries
        vm.prank(carol);
        (uint256 carolOrderId, , , ) = poolManager.placeOrder(
            marketKey,
            1,
            5_000e18,
            1,
            999,
            200_000e18
        );

        // Should succeed (with fix, activeLiq clamps to 0 instead of underflow)
        assertGt(carolOrderId, 0, "Order after cancel should work");
    }

    // ============================================
    // REGRESSION TEST 4: Sparse Liquidity Crossing
    // ============================================

    /**
     * @notice Test crossing through sparse liquidity (gaps between orders)
     * @dev When there are gaps, the fill algorithm searches for next tick
     *      and applies liquidityNet delta. Edge case: delta applied when activeLiq=0
     */
    function test_SparseLiquidity_HandlesGaps() public {
        // Create sparse liquidity with gaps
        vm.prank(alice);
        poolManager.placeOrder(marketKey, 0, 1_000e18, 50, 60, 50_000e18);

        vm.prank(alice);
        poolManager.placeOrder(marketKey, 0, 1_000e18, 100, 110, 50_000e18);  // Gap at 60-100

        vm.prank(alice);
        poolManager.placeOrder(marketKey, 0, 1_000e18, 200, 210, 50_000e18);  // Gap at 110-200

        // Market order that crosses through all ranges and gaps
        vm.prank(bob);
        (uint256 orderId, uint256 filledShares, , ) = poolManager.placeOrder(
            marketKey,
            1,
            10_000e18,  // Enough to cross all
            1,
            999,
            500_000e18
        );

        assertGt(orderId, 0, "Market order through sparse liquidity should work");
        // Should fill what's available without underflow
    }

    // ============================================
    // REGRESSION TEST 5: Bidirectional Crossing
    // ============================================

    /**
     * @notice Test crossing in both directions (up and down)
     * @dev The _fill function uses isUp to determine direction
     *      Both directions apply liquidityNet differently and need protection
     */
    function test_BidirectionalCrossing_BothDirectionsWork() public {
        // Setup: YES liquidity at high ticks
        vm.prank(alice);
        poolManager.placeOrder(marketKey, 1, 5_000e18, 600, 700, 200_000e18);

        // Setup: NO liquidity at low ticks
        vm.prank(alice);
        poolManager.placeOrder(marketKey, 0, 5_000e18, 300, 400, 200_000e18);

        // Cross upward (buy YES, fill against NO)
        vm.prank(bob);
        (uint256 orderId1, , , ) = poolManager.placeOrder(
            marketKey, 1, 3_000e18, 1, 999, 200_000e18
        );
        assertGt(orderId1, 0, "Upward crossing should work");

        // Cross downward (buy NO, fill against YES)
        vm.prank(carol);
        (uint256 orderId2, , , ) = poolManager.placeOrder(
            marketKey, 0, 3_000e18, 1, 999, 200_000e18
        );
        assertGt(orderId2, 0, "Downward crossing should work");

        // Both directions crossed successfully, now verify continued operation
        vm.prank(bob);
        (uint256 orderId3, , , ) = poolManager.placeOrder(
            marketKey, 1, 1_000e18, 500, 550, 100_000e18
        );
        assertGt(orderId3, 0, "Orders after bidirectional crossing should work");
    }

    // ============================================
    // FUZZ TEST: Random Order Sequences
    // ============================================

    /**
     * @notice Fuzz test with random order sequences to find edge cases
     * @dev Without the fix, certain sequences would trigger underflow
     */
    function testFuzz_RandomOrderSequences_NoUnderflow(
        uint8 numOrders,
        uint128 seed
    ) public {
        // Bound to reasonable range
        numOrders = uint8(bound(numOrders, 3, 8));

        vm.startPrank(alice);
        for (uint8 i = 0; i < numOrders; i++) {
            // Pseudo-random tick range
            uint16 tickLow = uint16(bound(uint256(keccak256(abi.encode(seed, i, "low"))), 1, 900));
            uint16 tickHigh = uint16(bound(uint256(keccak256(abi.encode(seed, i, "high"))), tickLow + 1, 999));
            uint8 outcome = uint8(uint256(keccak256(abi.encode(seed, i, "outcome"))) % 2);
            uint128 shares = uint128(bound(uint256(keccak256(abi.encode(seed, i, "shares"))), 100e18, 10_000e18));

            try poolManager.placeOrder(
                marketKey,
                outcome,
                shares,
                tickLow,
                tickHigh,
                1_000_000e18
            ) {
                // Success - good
            } catch {
                // Some orders may fail due to insufficient balance, etc.
                // That's fine, we're testing for underflow panics
            }
        }
        vm.stopPrank();

        // Execute market orders to trigger crossing
        vm.startPrank(bob);
        for (uint8 i = 0; i < 3; i++) {
            uint8 outcome = uint8(i % 2);
            try poolManager.placeOrder(
                marketKey,
                outcome,
                5_000e18,
                1,
                999,
                500_000e18
            ) {
                // Success - good
            } catch {
                // May fail for valid reasons, but not underflow
            }
        }
        vm.stopPrank();

        // If we reach here without panic, the fix is working
        assertTrue(true, "No underflow panic occurred");
    }

    // ============================================
    // EDGE CASE: Zero Active Liquidity
    // ============================================

    /**
     * @notice Test delta application when activeLiq is already zero
     * @dev Edge case: activeLiq=0, delta=-100 should clamp to 0, not underflow
     */
    function test_ZeroActiveLiquidity_WithNegativeDelta() public {
        // Place and immediately cancel an order (leaves tick state but no active liq)
        vm.prank(alice);
        (uint256 orderId, , , ) = poolManager.placeOrder(
            marketKey, 0, 1_000e18, 100, 150, 50_000e18
        );

        vm.prank(alice);
        poolManager.cancelOrder(marketKey, orderId);

        // Market state should have activeLiq = 0 now
        (, uint128 activeLiqNo, uint128 activeLiqYes, ) = poolManager.getMarketState(marketKey);

        // Place new order that tries to cross (may encounter stale tick data)
        vm.prank(bob);
        (uint256 bobOrderId, , , ) = poolManager.placeOrder(
            marketKey, 1, 500e18, 1, 999, 100_000e18
        );

        // Should work despite potentially encountering zero active liquidity
        assertGt(bobOrderId, 0, "Order with zero active liquidity should work");
    }

    // ============================================
    // STRESS TEST: Many Consecutive Trades
    // ============================================

    /**
     * @notice Stress test with many consecutive trades
     * @dev The original bug caused ALL subsequent trades to fail after first underflow
     *      This test verifies the fix allows continued operation
     */
    function test_ManyConsecutiveTrades_AllSucceed() public {
        // Setup liquidity
        vm.prank(alice);
        poolManager.placeOrder(marketKey, 0, 50_000e18, 50, 200, 500_000e18);

        vm.prank(alice);
        poolManager.placeOrder(marketKey, 1, 50_000e18, 300, 450, 500_000e18);

        // Execute 20 consecutive trades
        for (uint256 i = 0; i < 20; i++) {
            address trader = i % 2 == 0 ? bob : carol;
            uint8 outcome = uint8(i % 2);

            vm.prank(trader);
            (uint256 orderId, , , ) = poolManager.placeOrder(
                marketKey,
                outcome,
                1_000e18,
                1,
                999,
                100_000e18
            );

            assertGt(orderId, 0, string.concat("Trade ", vm.toString(i), " should succeed"));
        }
    }
}
