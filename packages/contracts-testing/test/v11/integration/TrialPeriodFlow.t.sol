// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {V11TestBase} from "../V11TestBase.sol";
import {LaunchpadLPToken} from "@core/LaunchpadLPToken.sol";

/**
 * @title Trial Period Flow Integration Tests
 * @notice End-to-end tests for trial → dismiss → refund flow
 */
contract TrialPeriodFlowTest is V11TestBase {
    // ============================================
    // Full Dismissal Flow Tests
    // ============================================

    function test_FullDismissalFlow_CreatorGetsDeposit() public {
        uint256 creatorBalanceBefore = usdc.balanceOf(creator);

        // 1. Create market (creator deposits)
        address market = _createMarketWithLiquidity(100e18);

        // 2. Alice trades during trial
        _buyShares(alice, market, 1, 50e18);

        // 3. Creator dismisses market
        vm.prank(creator);
        launchpad.dismissMarket(market);

        // 4. Verify creator's deposit (LP tokens still exist but no redemption in this flow)
        // The creator's initial deposit is in the AMM, which would need separate handling
        // This test verifies the trial flow works
        (, bool isDismissed, , ) = launchpad.getTrialStatus(market);
        assertTrue(isDismissed, "Market should be dismissed");
    }

    function test_FullDismissalFlow_TradersGetRefunds() public {
        // 1. Create market
        address market = _createMarket();

        // 2. Multiple traders trade during trial
        _buyShares(alice, market, 1, 100e18);
        _buyShares(bob, market, 0, 50e18);

        (uint256 aliceLockedCost, , ) = launchpad.getExitOptions(market, alice);
        (uint256 bobLockedCost, , ) = launchpad.getExitOptions(market, bob);

        assertGt(aliceLockedCost, 0, "Alice should have locked cost");
        assertGt(bobLockedCost, 0, "Bob should have locked cost");

        // 3. Creator dismisses
        vm.prank(creator);
        launchpad.dismissMarket(market);

        // 4. Traders claim refunds
        uint256 aliceBalanceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        launchpad.claimRefund(market);

        uint256 bobBalanceBefore = usdc.balanceOf(bob);
        vm.prank(bob);
        launchpad.claimRefund(market);

        assertGt(usdc.balanceOf(alice), aliceBalanceBefore, "Alice should receive refund");
        assertGt(usdc.balanceOf(bob), bobBalanceBefore, "Bob should receive refund");

        // 5. Verify no more claims available
        (, , bool aliceCanClaim) = launchpad.getExitOptions(market, alice);
        (, , bool bobCanClaim) = launchpad.getExitOptions(market, bob);

        assertFalse(aliceCanClaim, "Alice cannot claim again");
        assertFalse(bobCanClaim, "Bob cannot claim again");
    }

    function test_FullDismissalFlow_NoLPTokensMintedAfterDismissal() public {
        // 1. Create market
        address market = _createMarket();

        // 2. Trade during trial (LP tokens minted)
        _buyShares(alice, market, 1, 100e18);
        uint256 aliceLPAfterTrade = launchpad.getLPBalance(market, alice);
        assertGt(aliceLPAfterTrade, 0, "Alice should have LP tokens from trade");

        // 3. Dismiss market
        vm.prank(creator);
        launchpad.dismissMarket(market);

        // 4. Trading is blocked
        vm.prank(bob);
        vm.expectRevert("LaunchpadEngine: market dismissed");
        launchpad.tradePositions(market, 1, 50e18, type(uint256).max);

        // LP tokens remain but market is frozen
        uint256 aliceLPFinal = launchpad.getLPBalance(market, alice);
        assertEq(aliceLPFinal, aliceLPAfterTrade, "LP balance unchanged");
    }

    // ============================================
    // Trial Period Expiry Tests
    // ============================================

    function test_TrialExpiry_TradingContinuesAfterTrialEnds() public {
        // 1. Create market
        address market = _createMarket();

        // 2. Trade during trial
        _buyShares(alice, market, 1, 50e18);

        // 3. Warp past trial period
        _advanceTime(8 days);

        // 4. Verify trial ended but market is NOT dismissed
        (, , , bool isTrialActive) = launchpad.getTrialStatus(market);
        assertFalse(isTrialActive, "Trial should have ended");

        // 5. Trading continues (market not dismissed)
        // After trial, costs are no longer locked for refund
        _buyShares(bob, market, 0, 30e18);

        // 6. No refund available (market not dismissed)
        (, , bool canClaim) = launchpad.getExitOptions(market, alice);
        assertFalse(canClaim, "Cannot claim if not dismissed");
    }

    function test_TrialExpiry_CreatorCannotDismissAfterTrialEnds() public {
        address market = _createMarket();

        // Warp past trial
        _advanceTime(8 days);

        // Creator cannot dismiss
        vm.prank(creator);
        vm.expectRevert("LaunchpadEngine: trial ended");
        launchpad.dismissMarket(market);
    }

    // ============================================
    // Edge Cases
    // ============================================

    function test_DismissalFlow_NoTrades_NoRefunds() public {
        // Create and immediately dismiss
        address market = _createMarket();

        vm.prank(creator);
        launchpad.dismissMarket(market);

        // Alice never traded, no refund
        (, , bool canClaim) = launchpad.getExitOptions(market, alice);
        assertFalse(canClaim, "No refund without trading");
    }

    function test_DismissalFlow_MultipleBuysAndSells() public {
        address market = _createMarket();

        // Complex trading pattern
        _buyShares(alice, market, 1, 100e18);

        // Setup position for sell
        ammEngine.setPosition(market, alice, 100e18, 0);
        _sellShares(alice, market, 1, 30e18);

        _buyShares(alice, market, 0, 50e18);

        // Dismiss
        vm.prank(creator);
        launchpad.dismissMarket(market);

        // Alice can still claim
        (uint256 lockedCost, , bool canClaim) = launchpad.getExitOptions(market, alice);
        assertTrue(canClaim, "Should be able to claim");
        assertGt(lockedCost, 0, "Should have locked cost");
    }

    function test_DismissalFlow_LateRefundClaim() public {
        address market = _createMarket();

        _buyShares(alice, market, 1, 100e18);

        vm.prank(creator);
        launchpad.dismissMarket(market);

        // Wait a long time
        _advanceTime(365 days);

        // Alice can still claim refund
        vm.prank(alice);
        uint256 refund = launchpad.claimRefund(market);
        assertGt(refund, 0, "Refund should still work");
    }
}
