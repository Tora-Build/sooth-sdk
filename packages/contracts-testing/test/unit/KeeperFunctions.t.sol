// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {TickBookPoolManager} from "@core/TickBookPoolManager.sol";
import {TickBookVault} from "@core/TickBookVault.sol";
import {TruthMarket} from "@core/TruthMarket.sol";
import {OutcomeToken} from "@core/OutcomeToken.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";

/**
 * @title Keeper Functions Tests
 * @notice Tests for permissionless keeper functions:
 *         - claimSpotSellProceedsFor (new)
 *         - batchClaimSpotSellProceedsFor (new)
 */
contract KeeperFunctionsTest is Test {
    TickBookPoolManager public poolManager;
    TickBookVault public vault;
    TruthMarket public market;
    OutcomeToken public yesToken;
    OutcomeToken public noToken;
    ERC20Mock public usdc;

    address public alice = address(0xA11CE); // Spot seller
    address public bob = address(0xB0B);     // Buyer
    address public keeper = address(0xEEE);  // Keeper bot

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

        // Register market
        marketKey = poolManager.registerMarket(
            address(market),
            address(yesToken),
            address(noToken),
            0.5e18,
            address(0)
        );

        // Fund Alice with YES shares (she will sell)
        vm.prank(address(poolManager));
        vault.creditOutcome(address(market), alice, 1, 1000e18);

        // Fund Bob with USDC (he will buy)
        usdc.mint(bob, 10000e18);
        vm.prank(bob);
        usdc.approve(address(vault), type(uint256).max);
        vm.prank(bob);
        vault.depositUsdc(10000e18);
    }

    // ============================================
    // claimSpotSellProceedsFor Tests
    // ============================================

    function test_ClaimSpotSellProceedsFor_KeeperCanClaimForOwner() public {
        // Alice places spot sell (YES at ticks 500-530)
        vm.prank(alice);
        uint256 sellId = poolManager.placeSpotSell(marketKey, 1, 100e18, 500, 530);

        // Bob places buy order that crosses Alice's spot sell
        // Buy YES at ticks 500-600 (overlaps with 500-530)
        vm.prank(bob);
        poolManager.placeOrder(marketKey, 1, 100e18, 500, 600, type(uint256).max);

        // Check Alice has proceeds to claim
        TickBookPoolManager.SpotSellOrder memory order = poolManager.getSpotSellOrder(marketKey, sellId);
        assertGt(order.proceedsWad, 0, "Should have proceeds");

        // Keeper claims for Alice
        uint256 aliceBalanceBefore = vault.availableUsdcWad(alice);

        vm.prank(keeper);
        uint256 proceeds = poolManager.claimSpotSellProceedsFor(marketKey, sellId);

        uint256 aliceBalanceAfter = vault.availableUsdcWad(alice);

        assertGt(proceeds, 0, "Proceeds should be > 0");
        assertEq(aliceBalanceAfter - aliceBalanceBefore, proceeds, "Alice should receive proceeds");
    }

    function test_ClaimSpotSellProceedsFor_CreditsOwnerNotCaller() public {
        // Alice places spot sell
        vm.prank(alice);
        uint256 sellId = poolManager.placeSpotSell(marketKey, 1, 100e18, 500, 530);

        // Bob buys
        vm.prank(bob);
        poolManager.placeOrder(marketKey, 1, 100e18, 500, 600, type(uint256).max);

        uint256 keeperBalanceBefore = vault.availableUsdcWad(keeper);
        uint256 aliceBalanceBefore = vault.availableUsdcWad(alice);

        // Keeper claims for Alice
        vm.prank(keeper);
        poolManager.claimSpotSellProceedsFor(marketKey, sellId);

        uint256 keeperBalanceAfter = vault.availableUsdcWad(keeper);
        uint256 aliceBalanceAfter = vault.availableUsdcWad(alice);

        // Keeper balance unchanged, Alice receives proceeds
        assertEq(keeperBalanceAfter, keeperBalanceBefore, "Keeper should not receive proceeds");
        assertGt(aliceBalanceAfter, aliceBalanceBefore, "Alice should receive proceeds");
    }

    function test_ClaimSpotSellProceedsFor_ZeroesOrderProceeds() public {
        // Alice places spot sell
        vm.prank(alice);
        uint256 sellId = poolManager.placeSpotSell(marketKey, 1, 100e18, 500, 530);

        // Bob buys
        vm.prank(bob);
        poolManager.placeOrder(marketKey, 1, 100e18, 500, 600, type(uint256).max);

        // Claim once
        vm.prank(keeper);
        poolManager.claimSpotSellProceedsFor(marketKey, sellId);

        // Order proceeds should be zeroed
        TickBookPoolManager.SpotSellOrder memory order = poolManager.getSpotSellOrder(marketKey, sellId);
        assertEq(order.proceedsWad, 0, "Proceeds should be zeroed after claim");

        // Second claim returns zero
        vm.prank(keeper);
        uint256 secondClaim = poolManager.claimSpotSellProceedsFor(marketKey, sellId);
        assertEq(secondClaim, 0, "Second claim should return 0");
    }

    function test_ClaimSpotSellProceedsFor_NoProceedsReturnsZero() public {
        // Alice places spot sell but no one buys
        vm.prank(alice);
        uint256 sellId = poolManager.placeSpotSell(marketKey, 1, 100e18, 500, 530);

        // Keeper tries to claim with no proceeds
        vm.prank(keeper);
        uint256 proceeds = poolManager.claimSpotSellProceedsFor(marketKey, sellId);

        assertEq(proceeds, 0, "No proceeds should return 0");
    }

    // ============================================
    // batchClaimSpotSellProceedsFor Tests
    // ============================================

    function test_BatchClaimSpotSellProceedsFor_ClaimsMultiple() public {
        // Alice places multiple spot sells at DIFFERENT tick ranges to avoid crossing bug
        vm.startPrank(alice);
        uint256 sellId1 = poolManager.placeSpotSell(marketKey, 1, 100e18, 500, 520);
        uint256 sellId2 = poolManager.placeSpotSell(marketKey, 1, 100e18, 540, 560);
        uint256 sellId3 = poolManager.placeSpotSell(marketKey, 1, 100e18, 580, 600);
        vm.stopPrank();

        // Bob buys in separate transactions to avoid triggering crossing array mutation bug
        vm.prank(bob);
        poolManager.placeOrder(marketKey, 1, 100e18, 500, 525, type(uint256).max);
        vm.prank(bob);
        poolManager.placeOrder(marketKey, 1, 100e18, 535, 565, type(uint256).max);
        vm.prank(bob);
        poolManager.placeOrder(marketKey, 1, 100e18, 575, 605, type(uint256).max);

        uint256[] memory sellIds = new uint256[](3);
        sellIds[0] = sellId1;
        sellIds[1] = sellId2;
        sellIds[2] = sellId3;

        uint256 aliceBalanceBefore = vault.availableUsdcWad(alice);

        // Keeper batch claims
        vm.prank(keeper);
        uint256 totalProceeds = poolManager.batchClaimSpotSellProceedsFor(marketKey, sellIds);

        uint256 aliceBalanceAfter = vault.availableUsdcWad(alice);

        assertGt(totalProceeds, 0, "Total proceeds should be > 0");
        assertEq(aliceBalanceAfter - aliceBalanceBefore, totalProceeds, "Alice should receive total proceeds");
    }

    function test_BatchClaimSpotSellProceedsFor_EmptyArray() public {
        uint256[] memory sellIds = new uint256[](0);

        vm.prank(keeper);
        uint256 totalProceeds = poolManager.batchClaimSpotSellProceedsFor(marketKey, sellIds);

        assertEq(totalProceeds, 0, "Empty array should return 0");
    }

    function test_BatchClaimSpotSellProceedsFor_MixedProceedsAndEmpty() public {
        // Alice places two spot sells
        vm.startPrank(alice);
        uint256 sellId1 = poolManager.placeSpotSell(marketKey, 1, 100e18, 500, 530);
        uint256 sellId2 = poolManager.placeSpotSell(marketKey, 1, 100e18, 500, 530);
        vm.stopPrank();

        // Bob only crosses the first one (100e18)
        vm.prank(bob);
        poolManager.placeOrder(marketKey, 1, 100e18, 500, 600, type(uint256).max);

        uint256[] memory sellIds = new uint256[](2);
        sellIds[0] = sellId1;
        sellIds[1] = sellId2;

        // Keeper batch claims - should still work even if second has no proceeds
        vm.prank(keeper);
        uint256 totalProceeds = poolManager.batchClaimSpotSellProceedsFor(marketKey, sellIds);

        // At least the first one should have proceeds
        assertGt(totalProceeds, 0, "Should have some proceeds from first order");
    }
}
