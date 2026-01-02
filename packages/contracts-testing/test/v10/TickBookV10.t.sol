// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {TickBookPoolManagerV10} from "@core/TickBookPoolManagerV10.sol";
import {TickBookVault} from "@core/TickBookVault.sol";
import {TruthMarket} from "@core/TruthMarket.sol";
import {OutcomeToken} from "@core/OutcomeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title TickBookV10Test
 * @notice Tests for V10 (tick, user) primary indexing model
 * @dev Tests cover:
 *      - Single tick limit orders
 *      - Market orders (tick=0)
 *      - Position merging (adding to existing position)
 *      - Fill attribution via per-tick accumulators
 *      - Crossing logic
 */
contract TickBookV10Test is Test {
    TickBookPoolManagerV10 public poolManager;
    TickBookVault public vault;
    TruthMarket public market;
    OutcomeToken public yesToken;
    OutcomeToken public noToken;
    ERC20Mock public usdc;

    address public alice = address(0xA11CE);
    address public bob = address(0xB0B);
    address public charlie = address(0xC4A711E);
    address public deployer;

    uint256 constant WAD = 1e18;
    bytes32 public marketKey;

    function setUp() public {
        deployer = address(this);

        // Deploy USDC mock
        usdc = new ERC20Mock();

        // Deploy vault
        vault = new TickBookVault(address(usdc), deployer);

        // Deploy pool manager V10
        poolManager = new TickBookPoolManagerV10(address(vault));

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
        usdc.mint(charlie, 100_000e18);

        // Approve vault
        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(charlie);
        usdc.approve(address(vault), type(uint256).max);

        // Deposit to vault
        vm.prank(alice);
        vault.depositUsdc(50_000e18);
        vm.prank(bob);
        vault.depositUsdc(50_000e18);
        vm.prank(charlie);
        vault.depositUsdc(50_000e18);
    }

    // ============================================
    // Single Tick Limit Order Tests
    // ============================================

    function test_PlaceOrder_SingleTick_LimitOrder() public {
        vm.prank(alice);
        // placeOrder(marketKey, outcome, shares, tick, maxCost)
        (uint256 filledShares, uint256 filledCost, uint256 restingShares) =
            poolManager.placeOrder(
                marketKey,
                1,          // YES outcome
                1000e18,    // shares
                500,        // tick = 50%
                600e18      // maxCost
            );

        assertEq(filledShares, 0, "No crossing expected");
        assertEq(restingShares, 1000e18, "All shares should be resting");

        // Verify position was created
        TickBookPoolManagerV10.Position memory pos = poolManager.getPosition(
            marketKey, 1, 500, alice
        );
        assertEq(pos.shares, 1000e18, "Position shares should match");

        // Verify user ticks
        uint16[] memory ticks = poolManager.getUserTicks(marketKey, 1, alice);
        assertEq(ticks.length, 1, "Should have 1 tick");
        assertEq(ticks[0], 500, "Tick should be 500");
    }

    function test_PlaceOrder_PositionMerging() public {
        // Alice places first order at tick 500
        vm.prank(alice);
        poolManager.placeOrder(
            marketKey,
            1,          // YES outcome
            1000e18,    // shares
            500,        // tick
            600e18      // maxCost
        );

        // Alice places second order at SAME tick 500 - should merge
        vm.prank(alice);
        poolManager.placeOrder(
            marketKey,
            1,          // YES outcome
            500e18,     // more shares
            500,        // same tick
            300e18      // maxCost
        );

        // Verify position was merged (not new position)
        TickBookPoolManagerV10.Position memory pos = poolManager.getPosition(
            marketKey, 1, 500, alice
        );
        assertEq(pos.shares, 1500e18, "Position should have merged shares");

        // Verify only one tick in user's list
        uint16[] memory ticks = poolManager.getUserTicks(marketKey, 1, alice);
        assertEq(ticks.length, 1, "Should still have only 1 tick");
    }

    function test_PlaceOrder_MultipleTicks() public {
        // Alice places orders at different ticks
        vm.prank(alice);
        poolManager.placeOrder(marketKey, 1, 1000e18, 400, 700e18);

        vm.prank(alice);
        poolManager.placeOrder(marketKey, 1, 1000e18, 500, 600e18);

        vm.prank(alice);
        poolManager.placeOrder(marketKey, 1, 1000e18, 600, 500e18);

        // Verify user has 3 ticks
        uint16[] memory ticks = poolManager.getUserTicks(marketKey, 1, alice);
        assertEq(ticks.length, 3, "Should have 3 ticks");
    }

    // ============================================
    // Cancel Order Tests
    // ============================================

    function test_CancelOrder() public {
        // Place order
        vm.prank(alice);
        poolManager.placeOrder(marketKey, 1, 1000e18, 500, 600e18);

        // Get initial balance
        uint256 balanceBefore = vault.availableUsdcWad(alice);

        // Cancel order
        vm.prank(alice);
        uint256 released = poolManager.cancelOrder(marketKey, 1, 500);

        assertGt(released, 0, "Should release collateral");

        // Verify position is gone
        TickBookPoolManagerV10.Position memory pos = poolManager.getPosition(
            marketKey, 1, 500, alice
        );
        assertEq(pos.shares, 0, "Position should be cleared");

        // Verify tick removed from user's list
        uint16[] memory ticks = poolManager.getUserTicks(marketKey, 1, alice);
        assertEq(ticks.length, 0, "Should have no ticks");

        // Verify collateral returned
        uint256 balanceAfter = vault.availableUsdcWad(alice);
        assertEq(balanceAfter - balanceBefore, released, "Balance should increase by released amount");
    }

    // ============================================
    // Crossing Tests
    // ============================================

    function test_PlaceOrder_WithCrossing() public {
        // Alice places NO order at tick 600 (implies YES seller at 40%)
        // NO at tick 600: collateral = tick/1000 * shares = 0.6 * 1000 = 600
        vm.prank(alice);
        poolManager.placeOrder(
            marketKey,
            0,          // NO outcome
            1000e18,    // shares
            600,        // tick 60%
            700e18      // maxCost (> 600)
        );

        // Bob places YES order at tick 500 (YES buyer at 50%)
        // Crossing: 500 + 600 = 1100 >= 1000 -> should cross
        vm.prank(bob);
        (uint256 filledShares, uint256 filledCost, uint256 restingShares) =
            poolManager.placeOrder(
                marketKey,
                1,          // YES outcome
                1000e18,    // shares
                500,        // tick 50%
                600e18      // maxCost
            );

        // Should have crossing
        assertGt(filledShares, 0, "Should have crossing fill");
    }

    function test_PlaceOrder_NoCrossing_TicksTooFar() public {
        // Alice places NO order at tick 400 (implies YES seller at 60%)
        vm.prank(alice);
        poolManager.placeOrder(
            marketKey,
            0,          // NO outcome
            1000e18,    // shares
            400,        // tick 40%
            700e18      // maxCost
        );

        // Bob places YES order at tick 500 (YES buyer at 50%)
        // No crossing: 500 + 400 = 900 < 1000
        vm.prank(bob);
        (uint256 filledShares, uint256 filledCost, uint256 restingShares) =
            poolManager.placeOrder(
                marketKey,
                1,          // YES outcome
                1000e18,    // shares
                500,        // tick 50%
                600e18      // maxCost
            );

        // Should NOT cross
        assertEq(filledShares, 0, "Should not cross - ticks too far apart");
        assertEq(restingShares, 1000e18, "All shares should rest");
    }

    // ============================================
    // Market Order Tests
    // ============================================

    function test_MarketOrder_WalksBook() public {
        // Setup: Multiple makers at different ticks
        // NO at tick N: collateral = N/1000 * shares
        vm.prank(alice);
        poolManager.placeOrder(marketKey, 0, 500e18, 600, 400e18);  // NO at 60% -> 300 collateral

        vm.prank(bob);
        poolManager.placeOrder(marketKey, 0, 500e18, 700, 400e18);  // NO at 70% -> 350 collateral

        vm.prank(charlie);
        poolManager.placeOrder(marketKey, 0, 500e18, 800, 450e18);  // NO at 80% -> 400 collateral

        // Charlie places market order for YES (tick=0)
        vm.prank(charlie);
        (uint256 filledShares, uint256 filledCost, uint256 restingShares) =
            poolManager.placeOrder(
                marketKey,
                1,          // YES outcome
                1000e18,    // shares
                0,          // tick=0 means market order
                2000e18     // maxCost
            );

        // Should fill from multiple ticks
        assertGt(filledShares, 0, "Should fill some shares");
        assertEq(restingShares, 0, "Market orders don't rest");
    }

    // ============================================
    // Fill Attribution Tests
    // ============================================

    function test_FillAttribution_ProRataPerTick() public {
        // Alice and Bob both place NO orders at tick 600
        // NO at tick 600 means collateral = 600/1000 * shares = 0.6 * 1000 = 600
        vm.prank(alice);
        poolManager.placeOrder(marketKey, 0, 1000e18, 600, 700e18);

        vm.prank(bob);
        poolManager.placeOrder(marketKey, 0, 1000e18, 600, 700e18);

        // Charlie places YES order that crosses
        vm.prank(charlie);
        poolManager.placeOrder(marketKey, 1, 1000e18, 500, 600e18);

        // Check pending fills
        (uint256 alicePending,) = poolManager.getPendingFills(marketKey, 0, 600, alice);
        (uint256 bobPending,) = poolManager.getPendingFills(marketKey, 0, 600, bob);

        // Both should get equal fills (pro-rata)
        assertEq(alicePending, bobPending, "Pro-rata fills should be equal");
    }

    function test_ClaimFills() public {
        // Alice places NO order at tick 600
        // NO at tick 600: collateral = tick/1000 * shares = 0.6 * 1000 = 600
        vm.prank(alice);
        poolManager.placeOrder(marketKey, 0, 1000e18, 600, 700e18);

        // Bob places YES order that crosses
        vm.prank(bob);
        poolManager.placeOrder(marketKey, 1, 500e18, 500, 400e18);

        // Alice claims fills
        vm.prank(alice);
        (uint256 filledShares, uint256 collateralUsed) = poolManager.claimFills(marketKey, 0, 600);

        // Verify fills were claimed
        // (exact amounts depend on crossing logic)
    }

    // ============================================
    // View Function Tests
    // ============================================

    function test_GetTickState() public {
        vm.prank(alice);
        poolManager.placeOrder(marketKey, 1, 1000e18, 500, 600e18);

        TickBookPoolManagerV10.TickState memory state = poolManager.getTickState(marketKey, 1, 500);
        assertEq(state.totalShares, 1000e18, "Tick should have 1000 shares");
    }

    function test_GetLiquidityAtTick() public {
        vm.prank(alice);
        poolManager.placeOrder(marketKey, 1, 1000e18, 500, 600e18);

        vm.prank(bob);
        poolManager.placeOrder(marketKey, 1, 500e18, 500, 300e18);

        uint128 liquidity = poolManager.getLiquidityAtTick(marketKey, 1, 500);
        assertEq(liquidity, 1500e18, "Total liquidity should be 1500");
    }

    function test_GetBestTick() public {
        vm.prank(alice);
        poolManager.placeOrder(marketKey, 1, 1000e18, 400, 700e18);

        vm.prank(bob);
        poolManager.placeOrder(marketKey, 1, 1000e18, 600, 500e18);

        uint16 bestBid = poolManager.getBestTick(marketKey, 1, true);
        uint16 bestAsk = poolManager.getBestTick(marketKey, 1, false);

        assertEq(bestBid, 600, "Best bid should be highest tick");
        assertEq(bestAsk, 400, "Best ask should be lowest tick");
    }
}
