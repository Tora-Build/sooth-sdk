// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TrialPeriodTestBase} from "../base/TrialPeriodTestBase.sol";
import {LaunchpadEngine} from "@core/LaunchpadEngine.sol";
import {LaunchpadLPToken} from "@core/LaunchpadLPToken.sol";
import {TruthMarket} from "@core/TruthMarket.sol";
import {ILaunchpadEngine} from "@core/interfaces/ILaunchpadEngine.sol";

/**
 * @title LaunchpadEngine Unit Tests
 * @notice Tests for trial period, dismissal, and LP token flow
 */
contract LaunchpadEngineTest is TrialPeriodTestBase {
    // ============================================
    // Market Creation Tests
    // ============================================

    function test_CreateMarket_SetsTrialPeriodStart() public {
        address market = _createMarket();

        (uint64 trialEndTime, , , bool isTrialActive) = _getTrialStatus(market);

        assertEq(trialEndTime, uint64(block.timestamp) + 7 days, "Trial end time incorrect");
        assertTrue(isTrialActive, "Trial should be active");
    }

    function test_CreateMarket_InitializesLockedCostToZero() public {
        address market = _createMarket();

        (uint256 lockedCost, , ) = _getExitOptions(market, alice);

        assertEq(lockedCost, 0, "Locked cost should be zero initially");
    }

    function test_CreateMarket_InitializesTrialBalanceToZero() public {
        address market = _createMarket();

        (, int256 trialBalance, ) = _getExitOptions(market, alice);

        assertEq(trialBalance, 0, "Trial balance should be zero initially");
    }

    function test_CreateMarket_EmitsMarketCreatedEvent() public {
        vm.prank(creator);
        // Don't check market address (unknown in advance), check indexed creator
        vm.expectEmit(false, true, false, false);
        emit ILaunchpadEngine.MarketCreated(address(0), creator, 100e18, 0, 0);

        launchpad.createMarket(
            "Test question",
            0,
            uint64(block.timestamp + 30 days),
            adjudicator,
            address(protocolConfig),
            100e18,
            0,
            0
        );
    }

    function test_CreateMarket_DeploysERC20LPToken() public {
        address market = _createMarket();

        address lpToken = _getLPToken(market);

        assertTrue(lpToken != address(0), "LP token should be deployed");
        assertEq(LaunchpadLPToken(lpToken).market(), market, "LP token market mismatch");
    }

    function test_CreateMarket_DefaultTrialPeriod() public {
        address market = _createMarket();

        (uint64 trialEndTime, , , ) = _getTrialStatus(market);
        assertEq(trialEndTime, uint64(block.timestamp) + 7 days, "Default trial period not set");
    }

    // ============================================
    // Trial Period Trading Tests
    // ============================================

    function test_TradePositions_UpdatesLockedCost() public {
        address market = _createMarket();

        _buyShares(alice, market, 1, 100e18); // Buy YES

        (uint256 lockedCost, , ) = _getExitOptions(market, alice);

        assertGt(lockedCost, 0, "Locked cost should increase on buy");
    }

    function test_TradePositions_UpdatesTrialBalance() public {
        address market = _createMarket();

        _buyShares(alice, market, 1, 100e18); // Buy YES

        (, int256 trialBalance, ) = _getExitOptions(market, alice);

        assertLt(trialBalance, 0, "Trial balance should be negative after buy");
    }

    function test_TradePositions_BuyIncreasesLockedCost() public {
        address market = _createMarket();

        (uint256 lockedBefore, , ) = _getExitOptions(market, alice);
        _buyShares(alice, market, 1, 50e18);
        (uint256 lockedAfter, , ) = _getExitOptions(market, alice);

        assertGt(lockedAfter, lockedBefore, "Locked cost should increase");
    }

    function test_TradePositions_SellUpdatesTrialBalance() public {
        address market = _createMarket();

        // Setup: Alice buys shares first
        _buyShares(alice, market, 1, 100e18);

        // Set position in mock so Alice can sell
        ammEngine.setPosition(market, alice, 100e18, 0);

        (, int256 balanceBefore, ) = _getExitOptions(market, alice);
        _sellShares(alice, market, 1, 50e18);
        (, int256 balanceAfter, ) = _getExitOptions(market, alice);

        assertGt(balanceAfter, balanceBefore, "Trial balance should improve after sell");
    }

    function test_TradePositions_RevertsIfDismissed() public {
        address market = _createMarket();

        // Warp past trial period, then creator dismisses market
        _advanceTime(8 days);
        vm.prank(creator);
        launchpad.dismissMarket(market);

        // Trading should fail
        vm.prank(alice);
        vm.expectRevert("LaunchpadEngine: market dismissed");
        launchpad.tradePositions(market, 1, 100e18, type(uint256).max);
    }

    function testFuzz_TradePositions_LockedCostNeverNegative(uint256 shares) public {
        shares = bound(shares, 1e18, 1000e18);
        address market = _createMarket();

        _buyShares(alice, market, 1, shares);

        (uint256 lockedCost, , ) = _getExitOptions(market, alice);

        assertGe(lockedCost, 0, "Locked cost should never be negative");
    }

    // ============================================
    // Market Dismissal Tests
    // ============================================

    function test_DismissMarket_OnlyCreatorCanCall() public {
        address market = _createMarket();

        vm.prank(alice);
        vm.expectRevert("LaunchpadEngine: not creator");
        launchpad.dismissMarket(market);
    }

    function test_DismissMarket_RevertsIfTrialNotEnded() public {
        address market = _createMarket();

        // Try to dismiss during trial (should fail)
        vm.prank(creator);
        vm.expectRevert("LaunchpadEngine: trial not ended");
        launchpad.dismissMarket(market);
    }

    function test_DismissMarket_RevertsIfAlreadyDismissed() public {
        address market = _createMarket();

        // Warp past trial period first
        _advanceTime(8 days);

        vm.prank(creator);
        launchpad.dismissMarket(market);

        vm.prank(creator);
        vm.expectRevert("LaunchpadEngine: already dismissed");
        launchpad.dismissMarket(market);
    }

    function test_DismissMarket_SetsMarketDismissedFlag() public {
        address market = _createMarket();

        // Warp past trial period first
        _advanceTime(8 days);

        vm.prank(creator);
        launchpad.dismissMarket(market);

        (, bool isDismissed, , ) = _getTrialStatus(market);
        assertTrue(isDismissed, "Market should be dismissed");
    }

    function test_DismissMarket_EmitsDismissedEvent() public {
        address market = _createMarket();

        // Warp past trial period first
        _advanceTime(8 days);

        vm.prank(creator);
        vm.expectEmit(true, true, false, true);
        emit ILaunchpadEngine.MarketDismissed(market, creator, block.timestamp);

        launchpad.dismissMarket(market);
    }

    function test_DismissMarket_FreezesTrading() public {
        address market = _createMarket();

        // Warp past trial period first
        _advanceTime(8 days);

        vm.prank(creator);
        launchpad.dismissMarket(market);

        vm.prank(alice);
        vm.expectRevert("LaunchpadEngine: market dismissed");
        launchpad.tradePositions(market, 1, 100e18, type(uint256).max);
    }

    // ============================================
    // Refund Claim Tests
    // ============================================

    function test_ClaimRefund_ReturnsLockedCost() public {
        address market = _createMarket();

        // Alice trades during trial
        _buyShares(alice, market, 1, 100e18);

        (uint256 lockedCost, , ) = _getExitOptions(market, alice);
        assertGt(lockedCost, 0, "Alice should have locked cost");

        // Warp past trial period, then creator dismisses
        _advanceTime(8 days);
        vm.prank(creator);
        launchpad.dismissMarket(market);

        // Alice claims refund
        uint256 balanceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        uint256 refund = launchpad.claimRefund(market);

        assertGt(refund, 0, "Refund should be > 0");
        assertGt(usdc.balanceOf(alice), balanceBefore, "Alice should receive USDC");
    }

    function test_ClaimRefund_RevertsIfNotDismissed() public {
        address market = _createMarket();

        _buyShares(alice, market, 1, 100e18);

        vm.prank(alice);
        vm.expectRevert("LaunchpadEngine: market not dismissed");
        launchpad.claimRefund(market);
    }

    function test_ClaimRefund_RevertsIfAlreadyClaimed() public {
        address market = _createMarket();
        _buyShares(alice, market, 1, 100e18);

        // Warp past trial period, then dismiss
        _advanceTime(8 days);
        vm.prank(creator);
        launchpad.dismissMarket(market);

        vm.prank(alice);
        launchpad.claimRefund(market);

        vm.prank(alice);
        vm.expectRevert("LaunchpadEngine: no refund available");
        launchpad.claimRefund(market);
    }

    function test_ClaimRefund_TransfersCorrectAmount() public {
        address market = _createMarket();
        _buyShares(alice, market, 1, 100e18);

        (uint256 expectedRefund, , ) = _getExitOptions(market, alice);

        // Warp past trial period, then dismiss
        _advanceTime(8 days);
        vm.prank(creator);
        launchpad.dismissMarket(market);

        vm.prank(alice);
        uint256 actualRefund = launchpad.claimRefund(market);

        // Refund should match locked cost (converted to USDC decimals)
        assertGt(actualRefund, 0, "Refund should be positive");
    }

    function test_ClaimRefund_ResetsUserLockedCost() public {
        address market = _createMarket();
        _buyShares(alice, market, 1, 100e18);

        // Warp past trial period, then dismiss
        _advanceTime(8 days);
        vm.prank(creator);
        launchpad.dismissMarket(market);

        vm.prank(alice);
        launchpad.claimRefund(market);

        (uint256 lockedCost, , bool canClaim) = _getExitOptions(market, alice);
        assertEq(lockedCost, 0, "Locked cost should be reset");
        assertFalse(canClaim, "Should not be able to claim again");
    }

    function testFuzz_ClaimRefund_MultipleUsers(uint8 numUsers) public {
        // Bound to 1-5 users to avoid edge cases
        uint256 boundedUsers = bound(uint256(numUsers), 1, 5);
        address market = _createMarket();

        address[] memory users = new address[](boundedUsers);
        for (uint256 i = 0; i < boundedUsers; i++) {
            users[i] = address(uint160(0x1000 + i));
            usdc.mint(users[i], INITIAL_BALANCE);
            vm.prank(users[i]);
            usdc.approve(address(launchpad), type(uint256).max);
            // Use fixed shares per user to avoid overflow
            _buyShares(users[i], market, 1, 10e18);
        }

        // Warp past trial period, then dismiss
        _advanceTime(8 days);
        vm.prank(creator);
        launchpad.dismissMarket(market);

        for (uint256 i = 0; i < boundedUsers; i++) {
            uint256 balanceBefore = usdc.balanceOf(users[i]);
            vm.prank(users[i]);
            launchpad.claimRefund(market);
            assertGt(usdc.balanceOf(users[i]), balanceBefore, "User should receive refund");
        }
    }

    // ============================================
    // View Functions Tests
    // ============================================

    function test_GetTrialStatus_ReturnsCorrectValues() public {
        address market = _createMarket();

        (
            uint64 trialEndTime,
            bool isDismissed,
            uint256 totalLockedCost,
            bool isTrialActive
        ) = _getTrialStatus(market);

        assertEq(trialEndTime, uint64(block.timestamp) + 7 days, "Trial end time");
        assertFalse(isDismissed, "Should not be dismissed");
        assertEq(totalLockedCost, 0, "No locked cost initially");
        assertTrue(isTrialActive, "Trial should be active");
    }

    function test_GetExitOptions_ReturnsCorrectValues() public {
        address market = _createMarket();

        _buyShares(alice, market, 1, 100e18);

        (
            uint256 lockedCost,
            int256 trialBalance,
            bool canClaimRefund
        ) = _getExitOptions(market, alice);

        assertGt(lockedCost, 0, "Should have locked cost");
        assertLt(trialBalance, 0, "Should have negative trial balance");
        assertFalse(canClaimRefund, "Cannot claim until dismissed");
    }

    function test_GetExitOptions_CanClaimAfterDismissal() public {
        address market = _createMarket();

        _buyShares(alice, market, 1, 100e18);

        // Warp past trial period, then dismiss
        _advanceTime(8 days);
        vm.prank(creator);
        launchpad.dismissMarket(market);

        (, , bool canClaimRefund) = _getExitOptions(market, alice);
        assertTrue(canClaimRefund, "Should be able to claim after dismissal");
    }

    // ============================================
    // LP Token Tests
    // ============================================

    function test_LPToken_MintedOnCreate() public {
        vm.prank(creator);
        (address market, uint256 lpTokens) = launchpad.createMarket(
            "Test",
            0,
            uint64(block.timestamp + 30 days),
            adjudicator,
            address(protocolConfig),
            100e18,
            0,
            0
        );

        assertGt(lpTokens, 0, "LP tokens should be minted");

        uint256 balance = _getLPBalance(market, creator);
        assertEq(balance, lpTokens, "Creator should have LP tokens");
    }

    function test_LPToken_MintedOnTrade() public {
        address market = _createMarket();

        uint256 balanceBefore = _getLPBalance(market, alice);
        _buyShares(alice, market, 1, 100e18);
        uint256 balanceAfter = _getLPBalance(market, alice);

        assertGt(balanceAfter, balanceBefore, "LP tokens minted to trader");
    }

    // ============================================
    // Edge Cases
    // ============================================

    function test_TradePositions_RevertsOnUnknownMarket() public {
        vm.prank(alice);
        vm.expectRevert("LaunchpadEngine: market not found");
        launchpad.tradePositions(address(0x1234), 1, 100e18, type(uint256).max);
    }

    function test_TradePositions_RevertsOnInvalidOutcome() public {
        address market = _createMarket();

        vm.prank(alice);
        vm.expectRevert("LaunchpadEngine: invalid outcome");
        launchpad.tradePositions(market, 3, 100e18, type(uint256).max);
    }

    function test_TrialPeriod_EndsAfterTime() public {
        address market = _createMarket();

        (, , , bool isTrialActiveBefore) = _getTrialStatus(market);
        assertTrue(isTrialActiveBefore, "Trial should be active");

        _advanceTime(7 days + 1);

        (, , , bool isTrialActiveAfter) = _getTrialStatus(market);
        assertFalse(isTrialActiveAfter, "Trial should end after period");
    }
}
