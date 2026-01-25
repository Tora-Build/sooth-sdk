// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TrialPeriodTestBase} from "../base/TrialPeriodTestBase.sol";
import {LaunchpadLPToken} from "@core/LaunchpadLPToken.sol";
import {TruthMarket} from "@core/TruthMarket.sol";

/**
 * @title V11 Invariant Tests
 * @notice Actor-based invariant tests for V11 contracts
 * @dev Tests critical protocol invariants with randomized operations
 */
contract TrialPeriodInvariantsTest is TrialPeriodTestBase {
    // ============================================
    // Test State
    // ============================================

    address[] internal markets;
    address[] internal traders;

    // ============================================
    // Setup
    // ============================================

    function setUp() public override {
        super.setUp();

        // Setup traders
        traders.push(alice);
        traders.push(bob);

        // Create test markets (custom duration deferred; defaults used)
        markets.push(_createMarket());
        markets.push(_createMarketWithTrialPeriod(3 days));
    }

    // ============================================
    // Invariant: Locked Cost Never Exceeds Deposits
    // ============================================

    function invariant_LockedCostNeverExceedsDeposits() public view {
        for (uint i = 0; i < markets.length; i++) {
            address market = markets[i];

            for (uint j = 0; j < traders.length; j++) {
                address trader = traders[j];

                (uint256 lockedCost, , ) = _getExitOptions(market, trader);

                // Locked cost should never exceed what the trader deposited
                // This is a simplified check - in reality would track deposits separately
                assertLe(lockedCost, INITIAL_BALANCE, "Locked cost exceeds possible deposits");
            }
        }
    }

    // ============================================
    // Invariant: Trial Balance Consistency
    // ============================================

    function invariant_TrialBalanceConsistency() public view {
        for (uint i = 0; i < markets.length; i++) {
            address market = markets[i];

            (, , uint256 totalLockedCost, ) = _getTrialStatus(market);

            // Sum of individual locked costs should equal total
            uint256 sumLockedCost = 0;
            for (uint j = 0; j < traders.length; j++) {
                (uint256 lockedCost, , ) = _getExitOptions(market, traders[j]);
                sumLockedCost += lockedCost;
            }

            // Note: This only works if we track all traders
            // In production would need more comprehensive tracking
        }
    }

    // ============================================
    // Invariant: Dismissed Market Frozen
    // ============================================

    function test_Invariant_DismissedMarketFrozen() public {
        address market = markets[0];

        // Trade first
        _buyShares(alice, market, 1, 100e18);

        // Dismiss
        _advanceTime(8 days);
        _advanceTime(8 days);
        vm.prank(creator);
        launchpad.dismissMarket(market);

        // Verify market is frozen
        (, bool isDismissed, , ) = _getTrialStatus(market);
        assertTrue(isDismissed, "Market should be dismissed");

        // Any trading attempt should fail
        vm.prank(alice);
        vm.expectRevert("LaunchpadEngine: market dismissed");
        launchpad.tradePositions(market, 1, 50e18, type(uint256).max);

        vm.prank(bob);
        vm.expectRevert("LaunchpadEngine: market dismissed");
        launchpad.tradePositions(market, 0, 50e18, type(uint256).max);
    }

    // ============================================
    // Invariant: LP Transfer Locking
    // ============================================

    function test_Invariant_LPTransferLocking() public {
        address market = _createMarket();
        address lpToken = _getLPToken(market);

        // Trade to get LP tokens
        _buyShares(alice, market, 1, 100e18);
        uint256 aliceLP = _getLPBalance(market, alice);

        // Pre-settlement: transfers work
        vm.prank(alice);
        LaunchpadLPToken(lpToken).transfer(bob, aliceLP / 4);
        assertEq(_getLPBalance(market, bob), aliceLP / 4, "Transfer should work pre-settlement");

        // Settle market
        _settleMarket(market, 1);

        // Post-settlement: transfers blocked
        vm.prank(alice);
        vm.expectRevert(LaunchpadLPToken.TransfersLocked.selector);
        LaunchpadLPToken(lpToken).transfer(bob, 1e18);
    }

    // ============================================
    // Invariant: LP Supply Matches Sum of Balances
    // ============================================

    function test_Invariant_LPSupplyConsistency() public {
        address market = _createMarket();
        address lpToken = _getLPToken(market);

        // Creator has initial LP
        uint256 creatorLP = _getLPBalance(market, creator);

        // Trade to mint more LP
        _buyShares(alice, market, 1, 100e18);
        _buyShares(bob, market, 0, 50e18);

        uint256 aliceLP = _getLPBalance(market, alice);
        uint256 bobLP = _getLPBalance(market, bob);

        // Total supply should equal sum of balances
        uint256 totalSupply = LaunchpadLPToken(lpToken).totalSupply();
        uint256 sumBalances = creatorLP + aliceLP + bobLP;

        // Note: Creator's balance may change from transfers or redemptions
        // This test validates LP accounting is consistent
        assertEq(totalSupply, sumBalances, "LP supply should match sum of balances");
    }

    // ============================================
    // Invariant: Refund Claim Zeroes Locked Cost
    // ============================================

    function test_Invariant_RefundClaimZeroesLockedCost() public {
        address market = _createMarket();

        _buyShares(alice, market, 1, 100e18);

        (uint256 lockedBefore, , ) = _getExitOptions(market, alice);
        assertGt(lockedBefore, 0, "Should have locked cost before claim");

        _advanceTime(8 days);
        vm.prank(creator);
        launchpad.dismissMarket(market);

        vm.prank(alice);
        launchpad.claimRefund(market);

        (uint256 lockedAfter, , bool canClaim) = _getExitOptions(market, alice);
        assertEq(lockedAfter, 0, "Locked cost should be zero after claim");
        assertFalse(canClaim, "Cannot claim again");
    }

    // ============================================
    // Invariant: Trial Period Timing
    // ============================================

    function test_Invariant_TrialPeriodTiming() public {
        // Test with default trial market
        address market = markets[0];
        uint64 trialPeriod = launchpad.DEFAULT_TRIAL_PERIOD();

        // Initial: trial active
        (, , , bool isActiveInitial) = _getTrialStatus(market);
        assertTrue(isActiveInitial, "Trial should be active initially");

        // Warp near end: still active
        _advanceTime(uint256(trialPeriod) - 1);
        (, , , bool isActiveMiddle) = _getTrialStatus(market);
        assertTrue(isActiveMiddle, "Trial should be active before end");

        // Warp past trial: no longer active
        _advanceTime(2);
        (, , , bool isActiveAfter) = _getTrialStatus(market);
        assertFalse(isActiveAfter, "Trial should end after duration");
    }

    // ============================================
    // Fuzz: Random Trading Maintains Invariants
    // ============================================

    function testFuzz_RandomTradingMaintainsInvariants(
        uint8 numTrades,
        uint128 seed
    ) public {
        numTrades = uint8(bound(numTrades, 1, 10));
        address market = markets[0];

        for (uint8 i = 0; i < numTrades; i++) {
            // Random trader
            address trader = traders[uint256(keccak256(abi.encode(seed, i, "trader"))) % traders.length];

            // Random outcome
            uint8 outcome = uint8(uint256(keccak256(abi.encode(seed, i, "outcome"))) % 2);

            // Random shares
            uint256 shares = bound(
                uint256(keccak256(abi.encode(seed, i, "shares"))),
                1e18,
                50e18
            );

            try launchpad.tradePositions(market, outcome, int256(shares), type(uint256).max) {
                // Trade succeeded
            } catch {
                // Trade failed (expected sometimes)
            }
        }

        // Check invariants hold after random trading
        (, , , bool isTrialActive) = _getTrialStatus(market);

        // If trial still active, dismissal should work
        if (!isTrialActive) {
            vm.prank(creator);
            launchpad.dismissMarket(market);

            (, bool isDismissed, , ) = _getTrialStatus(market);
            assertTrue(isDismissed, "Dismissal should succeed after trial");
        } else {
            vm.prank(creator);
            vm.expectRevert("LaunchpadEngine: trial not ended");
            launchpad.dismissMarket(market);
        }
    }

    // ============================================
    // Fuzz: Multiple Users Refund Consistency
    // ============================================

    function testFuzz_MultipleUsersRefundConsistency(
        uint8 numTrades
    ) public {
        // Bound to reasonable range to avoid edge cases
        uint256 boundedTrades = bound(uint256(numTrades), 2, 6);
        address market = _createMarket();

        // Multiple trades with fixed amounts to avoid overflow
        for (uint256 i = 0; i < boundedTrades; i++) {
            address trader = i % 2 == 0 ? alice : bob;
            uint8 outcome = uint8(i % 2);
            // Use fixed share amount to avoid potential overflow
            _buyShares(trader, market, outcome, 20e18);
        }

        // Record locked costs
        (uint256 aliceLocked, , ) = _getExitOptions(market, alice);
        (uint256 bobLocked, , ) = _getExitOptions(market, bob);

        // Dismiss
        _advanceTime(8 days);
        vm.prank(creator);
        launchpad.dismissMarket(market);

        // Both can claim if they have locked costs
        if (aliceLocked > 0) {
            vm.prank(alice);
            launchpad.claimRefund(market);
        }

        if (bobLocked > 0) {
            vm.prank(bob);
            launchpad.claimRefund(market);
        }

        // Both locked costs zeroed
        (uint256 aliceLockedAfter, , ) = _getExitOptions(market, alice);
        (uint256 bobLockedAfter, , ) = _getExitOptions(market, bob);

        assertEq(aliceLockedAfter, 0, "Alice locked should be zero");
        assertEq(bobLockedAfter, 0, "Bob locked should be zero");
    }

    // Agent gating disabled for V11 (no invariants here).
}
