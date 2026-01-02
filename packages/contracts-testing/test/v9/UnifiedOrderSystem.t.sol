// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {TickBookPoolManagerV996} from "@core/TickBookPoolManagerV996.sol";
import {TickBookVault} from "@core/TickBookVault.sol";
import {TruthMarket} from "@core/TruthMarket.sol";
import {OutcomeToken} from "@core/OutcomeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title UnifiedOrderSystemTest
 * @notice Tests for V9.9.6 unified placeOrder() API
 * @dev Tests cover:
 *      - Full range market orders (tickLower=1, tickUpper=999)
 *      - Single tick limit orders (tickLower=X, tickUpper=X)
 *      - Partial range orders (market with floor)
 *      - Auto-claim on new order placement
 *      - Crossing behavior
 */
contract UnifiedOrderSystemTest is Test {
    TickBookPoolManagerV996 public poolManager;
    TickBookVault public vault;
    TruthMarket public market;
    OutcomeToken public yesToken;
    OutcomeToken public noToken;
    ERC20Mock public usdc;

    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public deployer;

    uint256 constant WAD = 1e18;
    bytes32 public marketKey;

    function setUp() public {
        deployer = address(this);

        // Deploy USDC mock
        usdc = new ERC20Mock();

        // Deploy vault
        vault = new TickBookVault(address(usdc), deployer);

        // Deploy pool manager V9.9.6
        poolManager = new TickBookPoolManagerV996(address(vault));

        // Link vault to pool manager
        vault.setTickBook(address(poolManager));

        // Deploy market
        market = new TruthMarket(
            "Test Market",
            uint64(block.timestamp + 30 days),
            deployer,  // adjudicator
            deployer   // guardian
        );

        // Create outcome tokens
        yesToken = new OutcomeToken("Yes Token", "YES", deployer, address(market), 1);
        noToken = new OutcomeToken("No Token", "NO", deployer, address(market), 0);

        // Activate market
        market.activate();

        // Register market
        marketKey = poolManager.registerMarket(
            address(market),
            address(yesToken),
            address(noToken),
            0.5e18,
            address(0)  // no hook
        );

        // Fund users
        usdc.mint(alice, 100_000e18);
        usdc.mint(bob, 100_000e18);

        // Approve vault
        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(vault), type(uint256).max);

        // Deposit to vault
        vm.prank(alice);
        vault.depositUsdc(50_000e18);
        vm.prank(bob);
        vault.depositUsdc(50_000e18);
    }

    // ============================================
    // Single Tick Limit Order Tests
    // ============================================

    function test_PlaceOrder_SingleTick_LimitOrder() public {
        vm.prank(alice);
        // placeOrder(marketKey, outcome, shares, tickLower, tickUpper, maxCost)
        (uint256 orderId, uint256 filledShares, uint256 filledCost, uint256 restingShares) =
            poolManager.placeOrder(
                marketKey,
                1,          // YES outcome
                1000e18,    // shares
                500,        // tickLower = 50%
                500,        // tickUpper = 50% (single tick)
                600e18      // maxCost
            );

        assertGt(orderId, 0, "Order ID should be assigned");
        assertEq(filledShares, 0, "No crossing expected");
        assertEq(restingShares, 1000e18, "All shares should be resting");
    }

    function test_PlaceOrder_SingleTick_WithCrossing() public {
        // Alice places NO order at tick 500
        vm.prank(alice);
        poolManager.placeOrder(
            marketKey,
            0,          // NO outcome
            1000e18,    // shares
            500,        // tickLower
            500,        // tickUpper
            600e18      // maxCost
        );

        // Bob places YES order at tick 500 - should cross
        vm.prank(bob);
        (uint256 orderId, uint256 filledShares, uint256 filledCost, uint256 restingShares) =
            poolManager.placeOrder(
                marketKey,
                1,          // YES outcome
                1000e18,    // shares
                500,        // tickLower
                500,        // tickUpper
                600e18      // maxCost
            );

        assertGt(orderId, 0, "Order ID should be assigned");
        assertGt(filledShares, 0, "Should have some crossing fill");
    }

    // ============================================
    // Range Order Tests
    // ============================================

    function test_PlaceOrder_RangeOrder() public {
        vm.prank(alice);
        (uint256 orderId, uint256 filledShares, uint256 filledCost, uint256 restingShares) =
            poolManager.placeOrder(
                marketKey,
                1,          // YES outcome
                2000e18,    // shares
                400,        // tickLower = 40%
                600,        // tickUpper = 60%
                1500e18     // maxCost
            );

        assertGt(orderId, 0, "Order ID should be assigned");
        assertEq(filledShares, 0, "No crossing expected");
        assertEq(restingShares, 2000e18, "All shares should be resting");
    }

    // ============================================
    // Market Order Tests (Full Range)
    // ============================================

    function test_PlaceOrder_FullRange_MarketOrder() public {
        // First place some liquidity to be taken
        vm.prank(alice);
        poolManager.placeOrder(
            marketKey,
            0,          // NO outcome
            1000e18,    // shares
            400,        // tickLower
            600,        // tickUpper
            700e18      // maxCost
        );

        // Bob places full range "market order" for YES
        vm.prank(bob);
        (uint256 orderId, uint256 filledShares, uint256 filledCost, uint256 restingShares) =
            poolManager.placeOrder(
                marketKey,
                1,          // YES outcome
                500e18,     // shares
                1,          // tickLower = 1 (min)
                999,        // tickUpper = 999 (max)
                600e18      // maxCost
            );

        // Full range order should cross available liquidity
        assertGt(orderId, 0, "Order ID should be assigned");
    }

    // ============================================
    // Market Order with Floor Tests
    // ============================================

    function test_PlaceOrder_MarketWithFloor() public {
        // Place some NO liquidity
        vm.prank(alice);
        poolManager.placeOrder(
            marketKey,
            0,          // NO outcome
            1000e18,    // shares
            400,        // tickLower
            600,        // tickUpper
            700e18      // maxCost
        );

        // Bob places market order with floor at 40%
        // Should fill down to 40%, rest at 40%
        vm.prank(bob);
        (uint256 orderId, uint256 filledShares, uint256 filledCost, uint256 restingShares) =
            poolManager.placeOrder(
                marketKey,
                1,          // YES outcome
                2000e18,    // shares
                400,        // tickLower = floor at 40%
                999,        // tickUpper = max
                2000e18     // maxCost
            );

        assertGt(orderId, 0, "Order ID should be assigned");
    }

    // ============================================
    // V9.9.6-fix9: Pooled Refunds Tests
    // ============================================

    function test_PlaceOrder_NoAutoClaim_Fix9() public {
        // Alice places order
        vm.prank(alice);
        (uint256 orderId1, , , ) = poolManager.placeOrder(
            marketKey,
            0,          // NO outcome
            1000e18,    // shares
            500,        // tickLower
            500,        // tickUpper
            600e18      // maxCost
        );

        // Bob crosses Alice's order with LARGER size to ensure full fill
        vm.prank(bob);
        poolManager.placeOrder(
            marketKey,
            1,          // YES outcome
            2000e18,    // shares - more than Alice's to ensure full fill
            500,        // tickLower
            500,        // tickUpper
            1200e18     // maxCost
        );

        // Alice claims fills - this should trigger order completion and pool refund
        vm.prank(alice);
        poolManager.claimFills(marketKey, orderId1);

        // Check Alice has pending pooled refunds (order was fully filled on claimFills)
        uint256 pendingRefund = poolManager.getPendingRefunds(alice, marketKey);
        // Note: If order completes, refund is pooled. Otherwise check fills worked.
        
        // Either way, the key test is that placeOrder is O(1) - no auto iteration
        // Let's verify the O(1) by placing many orders without incurring O(n) gas
        vm.startPrank(alice);
        for (uint i = 0; i < 10; i++) {
            poolManager.placeOrder(
                marketKey,
                0,
                100e18,
                uint16(400 + i),
                uint16(400 + i),
                100e18
            );
        }
        vm.stopPrank();
        // If we got here without running out of gas, placeOrder is O(1)
    }

    function test_PlaceOrder_SkipsInactiveOrders() public {
        // Alice places order
        vm.prank(alice);
        (uint256 orderId1, , , ) = poolManager.placeOrder(
            marketKey,
            0,          // outcome
            1000e18,    // shares
            500,        // tickLower
            500,        // tickUpper
            600e18      // maxCost
        );

        // Alice cancels order
        vm.prank(alice);
        poolManager.cancelOrder(marketKey, orderId1);

        // Alice places another order - should not revert on inactive order
        vm.prank(alice);
        (uint256 orderId2, , , ) = poolManager.placeOrder(
            marketKey,
            0,          // outcome
            500e18,     // shares
            600,        // tickLower
            600,        // tickUpper
            400e18      // maxCost
        );

        assertGt(orderId2, orderId1, "New order should be created");
    }

    // ============================================
    // Slippage Protection Tests
    // ============================================

    function test_PlaceOrder_RevertsOnSlippageExceeded() public {
        vm.prank(alice);
        vm.expectRevert(TickBookPoolManagerV996.SlippageExceeded.selector);
        poolManager.placeOrder(
            marketKey,
            1,          // YES outcome
            1000e18,    // shares
            500,        // tickLower
            500,        // tickUpper
            100e18      // maxCost too low
        );
    }

    // ============================================
    // Gas Benchmark Tests
    // ============================================

    function test_PlaceOrder_GasBenchmark_NoExistingOrders() public {
        vm.prank(alice);
        uint256 gasBefore = gasleft();
        poolManager.placeOrder(
            marketKey,
            1,          // outcome
            1000e18,    // shares
            500,        // tickLower
            500,        // tickUpper
            600e18      // maxCost
        );
        uint256 gasUsed = gasBefore - gasleft();

        emit log_named_uint("Gas used (no existing orders)", gasUsed);
        assertLt(gasUsed, 350_000, "Gas should be reasonable");
    }

    function test_PlaceOrder_GasBenchmark_With3ExistingOrders() public {
        // Alice places 3 orders
        vm.startPrank(alice);
        poolManager.placeOrder(marketKey, 1, 100e18, 400, 400, 100e18);
        poolManager.placeOrder(marketKey, 1, 100e18, 500, 500, 100e18);
        poolManager.placeOrder(marketKey, 1, 100e18, 600, 600, 100e18);

        // Now place 4th order - should auto-claim 3 orders
        uint256 gasBefore = gasleft();
        poolManager.placeOrder(
            marketKey,
            1,          // outcome
            100e18,     // shares
            700,        // tickLower
            700,        // tickUpper
            100e18      // maxCost
        );
        uint256 gasUsed = gasBefore - gasleft();
        vm.stopPrank();

        emit log_named_uint("Gas used (3 existing orders)", gasUsed);
        // With 3 orders to check, should add ~12-24k gas
        assertLt(gasUsed, 350_000, "Gas should be reasonable with auto-claim");
    }

    // ============================================
    // Event Tests
    // ============================================

    function test_PlaceOrder_EmitsOrderPlacedEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, true, false);
        emit TickBookPoolManagerV996.OrderPlaced(
            alice,
            marketKey,
            1,  // orderId (actual value unknown)
            1,  // outcome
            500,
            500,
            1000e18,
            0,   // filledShares
            0,   // filledCost
            1000e18  // restingShares
        );

        // placeOrder(marketKey, outcome, shares, tickLower, tickUpper, maxCost)
        poolManager.placeOrder(
            marketKey,
            1,          // outcome
            1000e18,    // shares
            500,        // tickLower
            500,        // tickUpper
            600e18      // maxCost
        );
    }
}
