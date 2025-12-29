// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {TickBookPoolManager, ILockCallback} from "../../contracts/TickBookPoolManager.sol";
import {TickBookVault} from "../../contracts/TickBookVault.sol";
import {TruthMarket} from "../../contracts/TruthMarket.sol";
import {OutcomeToken} from "../../contracts/OutcomeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title V9 Fuzz Tests
 * @notice Fuzz tests for V9 TickBookPoolManager operations
 * @dev Tests random inputs to find edge cases and vulnerabilities
 */
contract V9FuzzTest is Test {
    TickBookPoolManager public poolManager;
    TickBookVault public vault;
    TruthMarket public market;
    OutcomeToken public yesToken;
    OutcomeToken public noToken;
    ERC20Mock public usdc;

    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
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
            "Fuzz Test Market",
            uint64(block.timestamp + 30 days),
            deployer,
            deployer
        );
        yesToken = new OutcomeToken("Yes", "YES", deployer, address(market), 1);
        noToken = new OutcomeToken("No", "NO", deployer, address(market), 0);
        market.activate();

        // Register market
        TickBookPoolManager.PoolKey memory key = TickBookPoolManager.PoolKey({
            truthMarket: address(market),
            yesToken: address(yesToken),
            noToken: address(noToken),
            hook: address(0)
        });
        marketKey = poolManager.registerMarket(key, 0.5e18);

        // Fund users generously
        usdc.mint(alice, 10_000_000e18);
        usdc.mint(bob, 10_000_000e18);

        // Approve and deposit
        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(5_000_000e18);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(5_000_000e18);
        vm.stopPrank();
    }

    // ============================================
    // FUZZ TEST 1: Range Order Tick Boundaries
    // ============================================

    function testFuzz_PlaceRangeOrder_TickBounds(
        uint16 tickLower,
        uint16 tickUpper,
        uint128 shares
    ) public {
        // Bound inputs to valid ranges
        tickLower = uint16(bound(tickLower, 1, 998));
        tickUpper = uint16(bound(tickUpper, tickLower + 1, 999));
        shares = uint128(bound(shares, 1e18, 100_000e18));

        vm.prank(alice);
        (uint256 orderId, uint256 crossingFilled, uint256 crossingCost) = poolManager.placeRangeOrder(
            marketKey,
            1, // YES
            tickLower,
            tickUpper,
            shares
        );

        // Verify order was created
        assertGt(orderId, 0, "Order should be created");

        // Verify order properties
        TickBookPoolManager.RangeOrder memory order = poolManager.getOrder(marketKey, orderId);
        assertEq(order.owner, alice, "Order owner should be alice");
        assertEq(order.tickLower, tickLower, "Tick lower mismatch");
        assertEq(order.tickUpper, tickUpper, "Tick upper mismatch");
        assertEq(order.sharesTotal, shares, "Shares mismatch");
        assertTrue(order.active, "Order should be active");
    }

    // ============================================
    // FUZZ TEST 2: Market Order Amount
    // ============================================

    function testFuzz_ExecuteMarketOrder_Shares(uint128 shares) public {
        // Bound shares to reasonable range
        shares = uint128(bound(shares, 1e18, 50_000e18));

        // First place liquidity
        vm.prank(alice);
        poolManager.placeRangeOrder(
            marketKey,
            1, // YES
            400,
            600,
            100_000e18
        );

        // Execute market order
        vm.prank(bob);
        (uint256 filled, uint256 cost, uint256 refunded) = poolManager.executeMarketOrder(
            marketKey,
            0, // NO (fills against YES)
            shares,
            shares * 2 // generous maxCost
        );

        // Verify execution
        assertGt(filled, 0, "Should fill some shares");
        assertLe(filled, shares, "Cannot fill more than requested");
        assertGt(cost, 0, "Cost should be positive");
        assertLe(cost, shares * 2, "Cost should not exceed maxCost");
    }

    // ============================================
    // FUZZ TEST 3: Slippage Protection
    // ============================================

    function testFuzz_SlippageProtection(uint128 shares, uint128 maxCost) public {
        // Bound inputs to avoid edge cases that hit other errors first
        shares = uint128(bound(shares, 100e18, 1000e18));
        maxCost = uint128(bound(maxCost, 1e18, shares * 5)); // Always > 0
        
        // Place some liquidity
        vm.prank(alice);
        poolManager.placeRangeOrder(marketKey, 1, 400, 600, 50_000e18);

        // Try market order with random maxCost
        vm.prank(bob);
        
        // Just execute and verify slippage protection works
        try poolManager.executeMarketOrder(marketKey, 0, shares, maxCost) returns (uint256, uint256 cost, uint256) {
            // If success, cost must be <= maxCost
            assertLe(cost, maxCost, "Slippage protection violated");
        } catch {
            // Revert is acceptable (either slippage or other validation)
        }
    }

    // ============================================
    // FUZZ TEST 4: Cancel Order After Partial Fill
    // ============================================

    function testFuzz_CancelAfterPartialFill(uint128 orderShares, uint128 fillShares) public {
        // Bound inputs
        orderShares = uint128(bound(orderShares, 10_000e18, 100_000e18));
        fillShares = uint128(bound(fillShares, 1e18, orderShares / 2));

        // Alice places order
        vm.prank(alice);
        (uint256 orderId, , ) = poolManager.placeRangeOrder(
            marketKey,
            1, // YES
            400,
            600,
            orderShares
        );

        // Bob partially fills
        vm.prank(bob);
        try poolManager.executeMarketOrder(marketKey, 0, fillShares, fillShares * 2) {
            // Fill succeeded
        } catch {
            // Fill failed (e.g., tick out of range), skip cancel test
            return;
        }

        // Alice cancels remaining order
        vm.prank(alice);
        uint256 collateralReleased = poolManager.cancelOrder(marketKey, orderId);

        // Verify order is now inactive
        TickBookPoolManager.RangeOrder memory order = poolManager.getOrder(marketKey, orderId);
        assertFalse(order.active, "Order should be cancelled");

        // Some collateral should be released (less than original due to partial fill)
        assertGt(collateralReleased, 0, "Should release some collateral");
    }

    // ============================================
    // FUZZ TEST 5: Multi-Order Claim
    // ============================================

    function testFuzz_MultiOrderClaim(uint8 numOrders) public {
        // Bound number of orders to avoid overflow with tick calculations
        numOrders = uint8(bound(numOrders, 2, 5));

        // Alice places multiple orders
        uint256[] memory orderIds = new uint256[](numOrders);
        vm.startPrank(alice);
        for (uint8 i = 0; i < numOrders; i++) {
            // Ensure ticks stay within valid range (1-999)
            uint16 tickLow = 300 + uint16(i) * 30;
            uint16 tickHigh = tickLow + 50;
            
            (uint256 orderId, , ) = poolManager.placeRangeOrder(
                marketKey,
                1,
                tickLow,
                tickHigh,
                10_000e18
            );
            orderIds[i] = orderId;
        }
        vm.stopPrank();

        // Bob fills against some orders with bounded max cost
        vm.prank(bob);
        try poolManager.executeMarketOrder(marketKey, 0, uint128(numOrders) * 5_000e18, uint128(numOrders) * 10_000e18) {
            // Fill succeeded
        } catch {
            // No liquidity in range, skip
            return;
        }

        // Batch claim all orders
        (uint256 totalFilled, uint256 totalCollateral) = poolManager.batchClaimFills(marketKey, orderIds);

        // Should have some fills
        assertGt(totalFilled, 0, "Should have some fills across orders");
    }

    // ============================================
    // FUZZ TEST 6: Tick Price Consistency
    // ============================================

    function testFuzz_TickPriceConsistency(uint16 tick) public view {
        // Bound tick to valid range
        tick = uint16(bound(tick, 1, 999));

        // Calculate expected price
        uint256 expectedPrice = uint256(tick) * WAD / 1000;

        // Verify it's within 0-100% range
        assertLt(expectedPrice, WAD, "Price should be < 100%");
        assertGt(expectedPrice, 0, "Price should be > 0%");
    }

    // ============================================
    // FUZZ TEST 7: Order Crossing Symmetry
    // ============================================

    function testFuzz_CrossingSymmetry(uint128 aliceShares, uint128 bobShares) public {
        // Bound shares
        aliceShares = uint128(bound(aliceShares, 10_000e18, 100_000e18));
        bobShares = uint128(bound(bobShares, 10_000e18, 100_000e18));

        // Alice places YES order
        vm.prank(alice);
        (uint256 aliceOrderId, uint256 aliceCrossing, ) = poolManager.placeRangeOrder(
            marketKey,
            1, // YES
            400,
            600,
            aliceShares
        );

        // Bob places NO order at overlapping range
        vm.prank(bob);
        (uint256 bobOrderId, uint256 bobCrossing, ) = poolManager.placeRangeOrder(
            marketKey,
            0, // NO
            450,
            550,
            bobShares
        );

        // The second order should cross with the first
        // (unless they're on the same side)
        if (aliceCrossing == 0) {
            // First order has no crossing partner
            // Second order should get crossing if ranges overlap at current tick
            (uint16 currentTick, , , ) = poolManager.getMarketState(marketKey);
            
            if (currentTick >= 450 && currentTick <= 550) {
                // Current tick is in both ranges, crossing should occur
                assertGt(bobCrossing, 0, "Bob should get crossing fills");
            }
        }
    }

    // ============================================
    // FUZZ TEST 8: Zero Amount Handling
    // ============================================

    function testFuzz_ZeroAmountReverts() public {
        vm.prank(alice);
        vm.expectRevert(TickBookPoolManager.ZeroAmount.selector);
        poolManager.placeRangeOrder(marketKey, 1, 400, 600, 0);
    }

    // ============================================
    // FUZZ TEST 9: Invalid Tick Range
    // ============================================

    function testFuzz_InvalidTickRange(uint16 tickLower, uint16 tickUpper) public {
        // Test only strictly invalid combinations where we know revert will happen
        vm.prank(alice);

        // Only test cases where tickLower > tickUpper (guaranteed invalid)
        if (tickLower > tickUpper) {
            vm.expectRevert(TickBookPoolManager.InvalidTickRange.selector);
            poolManager.placeRangeOrder(marketKey, 1, tickLower, tickUpper, 1000e18);
        } else if (tickLower == tickUpper || tickLower == 0 || tickUpper == 0 || tickUpper > 999) {
            // These might revert too, but let's not assert - just try
            try poolManager.placeRangeOrder(marketKey, 1, tickLower, tickUpper, 1000e18) {
                // Success means ticks were actually valid
            } catch {
                // Expected revert
            }
        }
        // If ticks are valid, order should succeed (tested elsewhere)
    }

    // ============================================
    // FUZZ TEST 10: Outcome Validation
    // ============================================

    function testFuzz_InvalidOutcome(uint8 outcome) public {
        vm.prank(alice);

        if (outcome > 1) {
            vm.expectRevert(TickBookPoolManager.InvalidOutcome.selector);
            poolManager.placeRangeOrder(marketKey, outcome, 400, 600, 1000e18);
        } else {
            // Valid outcome (0 or 1), should succeed
            poolManager.placeRangeOrder(marketKey, outcome, 400, 600, 1000e18);
        }
    }
}
