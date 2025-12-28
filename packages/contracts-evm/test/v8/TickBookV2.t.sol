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

        // Register market
        marketKey = tickBook.registerMarket(address(market), yesToken, noToken);

        // Fund users
        usdc.mint(alice, 10_000 * WAD);
        usdc.mint(bob, 10_000 * WAD);
        usdc.mint(charlie, 10_000 * WAD);

        // Users deposit to vault
        vm.startPrank(alice);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(5_000 * WAD);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(5_000 * WAD);
        vm.stopPrank();

        vm.startPrank(charlie);
        usdc.approve(address(vault), type(uint256).max);
        vault.depositUsdc(5_000 * WAD);
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
        uint256 orderId = tickBook.placeRangeOrder(marketKey, 0, 400, 400, 1000 * WAD);

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
        uint256 orderId = tickBook.placeRangeOrder(marketKey, 0, 300, 600, 5000 * WAD);

        TickBookV2.RangeOrder memory order = tickBook.getOrder(marketKey, orderId);
        assertEq(order.tickLower, 300);
        assertEq(order.tickUpper, 600);
        assertEq(order.liquidity, 5000 * WAD);

        // Check that active liquidity is updated (current tick 500 is within 300-600)
        (, uint128 activeLiqNo,,) = tickBook.getMarketState(marketKey);
        assertEq(activeLiqNo, 5000 * WAD);
    }

    function test_PlaceRangeOrder_OutsideCurrentTick() public {
        // Place order from tick 600 to 800 (60% to 80%)
        // Current tick is 500, so this shouldn't add to active liquidity yet
        vm.prank(alice);
        tickBook.placeRangeOrder(marketKey, 0, 600, 800, 1000 * WAD);

        (, uint128 activeLiqNo,,) = tickBook.getMarketState(marketKey);
        assertEq(activeLiqNo, 0); // Not active yet
    }

    function test_PlaceRangeOrder_GasEfficiency() public {
        // This should be O(1) regardless of range width
        vm.prank(alice);
        uint256 gasBefore = gasleft();
        tickBook.placeRangeOrder(marketKey, 0, 100, 900, 1000 * WAD); // 800 tick range
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
        uint256 orderId = tickBook.placeRangeOrder(marketKey, 0, 400, 600, 1000 * WAD);

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
        uint256 orderId = tickBook.placeRangeOrder(marketKey, 0, 400, 600, 1000 * WAD);

        vm.prank(bob);
        vm.expectRevert("TickBookV2: not owner");
        tickBook.cancelOrder(marketKey, orderId);
    }

    // ============================================
    // Market Orders
    // ============================================

    function test_ExecuteMarketOrder_BuyYes() public {
        // Alice provides NO liquidity at 40-60%
        vm.prank(alice);
        tickBook.placeRangeOrder(marketKey, 0, 400, 600, 10_000 * WAD);

        // Bob buys YES
        vm.prank(bob);
        (uint256 filled, uint256 cost) = tickBook.executeMarketOrder(marketKey, 1, 100 * WAD, 100 * WAD);

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
        tickBook.placeRangeOrder(marketKey, 1, 400, 600, 10_000 * WAD);

        // Bob buys NO
        vm.prank(bob);
        (uint256 filled, uint256 cost) = tickBook.executeMarketOrder(marketKey, 0, 100 * WAD, 100 * WAD);

        assertGt(filled, 0);
        assertGt(cost, 0);

        // Price should have moved down
        (uint16 newTick,,,) = tickBook.getMarketState(marketKey);
        assertLt(newTick, 500);
    }

    function test_ExecuteMarketOrder_SlippageProtection() public {
        // Provide enough liquidity to fill the order
        vm.prank(alice);
        tickBook.placeRangeOrder(marketKey, 0, 400, 900, 10_000 * WAD);

        // Try to buy with very low maxCost (should fail on slippage, not liquidity)
        vm.prank(bob);
        vm.expectRevert("TickBookV2: slippage exceeded");
        tickBook.executeMarketOrder(marketKey, 1, 100 * WAD, 1 * WAD);
    }

    function test_ExecuteMarketOrder_NoLiquidity() public {
        // No orders placed
        vm.prank(bob);
        vm.expectRevert("TickBookV2: no liquidity");
        tickBook.executeMarketOrder(marketKey, 1, 100 * WAD, 100 * WAD);
    }

    // ============================================
    // Fill Attribution
    // ============================================

    function test_ClaimFills() public {
        // Alice provides liquidity
        vm.prank(alice);
        uint256 orderId = tickBook.placeRangeOrder(marketKey, 0, 400, 600, 10_000 * WAD);

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
        uint256 aliceOrder = tickBook.placeRangeOrder(marketKey, 0, 400, 600, 5_000 * WAD);

        vm.prank(bob);
        uint256 bobOrder = tickBook.placeRangeOrder(marketKey, 0, 400, 600, 5_000 * WAD);

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
        tickBook.placeRangeOrder(marketKey, 0, 400, 500, 2_000 * WAD); // 40-50%
        tickBook.placeRangeOrder(marketKey, 0, 500, 600, 3_000 * WAD); // 50-60%
        tickBook.placeRangeOrder(marketKey, 0, 600, 700, 1_000 * WAD); // 60-70%
        vm.stopPrank();

        // Large order that crosses multiple ranges
        vm.prank(bob);
        (uint256 filled, uint256 cost) = tickBook.executeMarketOrder(marketKey, 1, 2000 * WAD, 2000 * WAD);

        assertGt(filled, 0);
        console2.log("Cross-range fill:", filled / WAD);
        console2.log("Cross-range cost:", cost / WAD);

        (uint16 finalTick,,,) = tickBook.getMarketState(marketKey);
        console2.log("Final tick after cross-range:", finalTick);
    }

    function test_MarketNotLive_RevertOnTrade() public {
        vm.prank(alice);
        tickBook.placeRangeOrder(marketKey, 0, 400, 600, 1000 * WAD);

        // Settle the market
        market.setLive(false);

        vm.prank(bob);
        vm.expectRevert("TickBookV2: not live");
        tickBook.executeMarketOrder(marketKey, 1, 100 * WAD, 100 * WAD);
    }
}
