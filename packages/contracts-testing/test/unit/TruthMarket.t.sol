// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {TruthMarket} from "@core/TruthMarket.sol";

/**
 * @title TruthMarket Lifecycle Tests
 * @notice Comprehensive tests for market lifecycle: activate, settle, veto, finalize
 */
contract TruthMarketLifecycleTest is Test {
    TruthMarket public market;

    address public creator = address(0xC0E8);
    address public adjudicator = address(0xAD7);
    address public guardian = address(0x6A2D);
    address public randomUser = address(0xBEEF);

    uint64 public deadline;
    string constant QUESTION = "Will BTC reach $100k?";

    function setUp() public {
        deadline = uint64(block.timestamp + 30 days);
        
        vm.prank(creator);
        market = new TruthMarket(
            QUESTION,
            deadline,
            adjudicator,
            guardian
        );
    }

    // ============================================
    // Constructor Tests
    // ============================================

    function test_Constructor_SetsCorrectValues() public view {
        assertEq(market.question(), QUESTION);
        assertEq(market.deadline(), deadline);
        assertEq(market.creator(), creator);
        assertEq(market.adjudicator(), adjudicator);
        assertEq(market.guardian(), guardian);
        assertEq(uint8(market.state()), 0); // CREATED
    }

    function test_Constructor_RevertWhenDeadlineInPast() public {
        vm.expectRevert("TruthMarket: deadline in past");
        new TruthMarket(QUESTION, uint64(block.timestamp - 1), adjudicator, guardian);
    }

    function test_Constructor_RevertWhenZeroAdjudicator() public {
        vm.expectRevert("TruthMarket: zero adjudicator");
        new TruthMarket(QUESTION, deadline, address(0), guardian);
    }

    function test_Constructor_RevertWhenZeroGuardian() public {
        vm.expectRevert("TruthMarket: zero guardian");
        new TruthMarket(QUESTION, deadline, adjudicator, address(0));
    }

    // ============================================
    // Activation Tests
    // ============================================

    function test_Activate_Success() public {
        vm.prank(creator);
        market.activate();

        assertEq(uint8(market.state()), 1); // LIVE
        assertTrue(market.isLive());
    }

    function test_Activate_RevertWhenNotCreator() public {
        vm.prank(randomUser);
        vm.expectRevert("TruthMarket: not creator");
        market.activate();
    }

    function test_Activate_RevertWhenAlreadyLive() public {
        vm.prank(creator);
        market.activate();

        vm.prank(creator);
        vm.expectRevert("TruthMarket: not created");
        market.activate();
    }

    function test_Activate_RevertWhenPastDeadline() public {
        vm.warp(deadline + 1);

        vm.prank(creator);
        vm.expectRevert("TruthMarket: past deadline");
        market.activate();
    }

    // ============================================
    // IsLive Tests
    // ============================================

    function test_IsLive_TrueWhenActivatedBeforeDeadline() public {
        vm.prank(creator);
        market.activate();

        assertTrue(market.isLive());
    }

    function test_IsLive_FalseWhenPastDeadline() public {
        vm.prank(creator);
        market.activate();

        vm.warp(deadline + 1);
        assertFalse(market.isLive());
    }

    function test_IsLive_FalseWhenNotActivated() public {
        assertFalse(market.isLive());
    }

    // ============================================
    // Settlement Tests
    // ============================================

    function test_Settle_YESWins() public {
        vm.prank(creator);
        market.activate();

        vm.prank(adjudicator);
        market.settle(1, 0); // YES = 1

        assertTrue(market.isSettled());
        assertEq(market.winningOutcome(), 1);
    }

    function test_Settle_NOWins() public {
        vm.prank(creator);
        market.activate();

        vm.prank(adjudicator);
        market.settle(0, 0); // NO = 0

        assertTrue(market.isSettled());
        assertEq(market.winningOutcome(), 0);
    }

    function test_Settle_INVALIDWins() public {
        vm.prank(creator);
        market.activate();

        vm.prank(adjudicator);
        market.settle(2, 0); // INVALID = 2

        assertTrue(market.isSettled());
        assertEq(market.winningOutcome(), 2);
    }

    function test_Settle_WithTStar() public {
        vm.prank(creator);
        market.activate();

        uint64 tStarValue = uint64(block.timestamp + 1 days);
        vm.warp(tStarValue + 1 hours);

        vm.prank(adjudicator);
        market.settle(1, tStarValue);

        assertEq(market.tStar(), tStarValue);
    }

    function test_Settle_RevertWhenNotAdjudicator() public {
        vm.prank(creator);
        market.activate();

        vm.prank(randomUser);
        vm.expectRevert("TruthMarket: not adjudicator");
        market.settle(1, 0);
    }

    function test_Settle_RevertWhenNotLive() public {
        // Market hasn't been activated yet
        vm.prank(adjudicator);
        vm.expectRevert("TruthMarket: not live");
        market.settle(1, 0);
    }

    function test_Settle_RevertWhenInvalidOutcome() public {
        vm.prank(creator);
        market.activate();

        vm.prank(adjudicator);
        vm.expectRevert("TruthMarket: invalid outcome");
        market.settle(3, 0);
    }

    function test_Settle_RevertWhenTStarInFuture() public {
        vm.prank(creator);
        market.activate();

        vm.prank(adjudicator);
        vm.expectRevert("TruthMarket: tStar in future");
        market.settle(1, uint64(block.timestamp + 1));
    }

    // ============================================
    // Veto Tests
    // ============================================

    function test_Veto_Success() public {
        vm.prank(creator);
        market.activate();

        vm.prank(adjudicator);
        market.settle(1, 0);

        vm.prank(guardian);
        market.veto();

        // Market should be back to SETTLING
        assertTrue(market.isSettling());
        assertEq(market.winningOutcome(), 0);
        assertEq(market.tStar(), 0);
    }

    function test_Veto_RevertWhenNotGuardian() public {
        vm.prank(creator);
        market.activate();

        vm.prank(adjudicator);
        market.settle(1, 0);

        vm.prank(randomUser);
        vm.expectRevert("TruthMarket: not guardian");
        market.veto();
    }

    function test_Veto_RevertWhenNotSettled() public {
        vm.prank(creator);
        market.activate();

        vm.prank(guardian);
        vm.expectRevert("TruthMarket: not settled");
        market.veto();
    }

    // ============================================
    // Finalize Tests
    // ============================================

    function test_Finalize_ByAdjudicator() public {
        vm.prank(creator);
        market.activate();

        vm.prank(adjudicator);
        market.settle(1, 0);

        vm.prank(adjudicator);
        market.finalize();

        assertTrue(market.isFinalized());
    }

    function test_Finalize_ByGuardian() public {
        vm.prank(creator);
        market.activate();

        vm.prank(adjudicator);
        market.settle(1, 0);

        vm.prank(guardian);
        market.finalize();

        assertTrue(market.isFinalized());
    }

    function test_Finalize_RevertWhenNotAuthorized() public {
        vm.prank(creator);
        market.activate();

        vm.prank(adjudicator);
        market.settle(1, 0);

        vm.prank(randomUser);
        vm.expectRevert("TruthMarket: not authorized");
        market.finalize();
    }

    function test_Finalize_CannotVetoAfterFinalize() public {
        vm.prank(creator);
        market.activate();

        vm.prank(adjudicator);
        market.settle(1, 0);

        vm.prank(guardian);
        market.finalize();

        vm.prank(guardian);
        vm.expectRevert("TruthMarket: not settled");
        market.veto();
    }

    // ============================================
    // Redemption Value Tests
    // ============================================

    function test_RedemptionValue_YesWins() public {
        vm.prank(creator);
        market.activate();

        vm.prank(adjudicator);
        market.settle(1, 0); // YES wins

        assertEq(market.getRedemptionValue(1), 1e18); // YES = 1 WAD
        assertEq(market.getRedemptionValue(0), 0);    // NO = 0
    }

    function test_RedemptionValue_NoWins() public {
        vm.prank(creator);
        market.activate();

        vm.prank(adjudicator);
        market.settle(0, 0); // NO wins

        assertEq(market.getRedemptionValue(0), 1e18); // NO = 1 WAD
        assertEq(market.getRedemptionValue(1), 0);    // YES = 0
    }

    function test_RedemptionValue_Invalid() public {
        vm.prank(creator);
        market.activate();

        vm.prank(adjudicator);
        market.settle(2, 0); // INVALID

        assertEq(market.getRedemptionValue(0), 0.5e18); // NO = 0.5 WAD
        assertEq(market.getRedemptionValue(1), 0.5e18); // YES = 0.5 WAD
    }

    function test_RedemptionValue_RevertWhenNotSettled() public {
        vm.prank(creator);
        market.activate();

        vm.expectRevert("TruthMarket: not settled");
        market.getRedemptionValue(1);
    }

    // ============================================
    // Full Lifecycle Test
    // ============================================

    function test_FullLifecycle_HappyPath() public {
        // 1. Market created
        assertEq(uint8(market.state()), 0); // CREATED
        
        // 2. Activate
        vm.prank(creator);
        market.activate();
        assertTrue(market.isLive());
        
        // 3. Pass deadline
        vm.warp(deadline + 1);
        assertTrue(market.isSettling());
        
        // 4. Settle
        vm.prank(adjudicator);
        market.settle(1, 0);
        assertTrue(market.isSettled());
        
        // 5. Finalize
        vm.prank(guardian);
        market.finalize();
        assertTrue(market.isFinalized());
        
        // 6. Verify redemption works
        assertEq(market.getRedemptionValue(1), 1e18);
    }

    function test_FullLifecycle_WithVeto() public {
        // 1. Activate
        vm.prank(creator);
        market.activate();
        
        // 2. Settle with wrong outcome
        vm.prank(adjudicator);
        market.settle(0, 0); // NO wins
        
        // 3. Guardian vetoes
        vm.prank(guardian);
        market.veto();
        assertTrue(market.isSettling());
        
        // 4. Re-settle with correct outcome
        vm.prank(adjudicator);
        market.settle(1, 0); // YES wins
        
        // 5. Finalize
        vm.prank(guardian);
        market.finalize();
        
        // 6. Verify YES wins
        assertEq(market.getRedemptionValue(1), 1e18);
    }
}
