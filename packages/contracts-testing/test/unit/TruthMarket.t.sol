// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {TruthMarket} from "@core/TruthMarket.sol";
import {ProtocolConfig} from "@core/ProtocolConfig.sol";

/**
 * @title TruthMarket Lifecycle Tests
 * @notice Comprehensive tests for market lifecycle: activate, settle, veto, finalize
 */
contract TruthMarketLifecycleTest is Test {
    TruthMarket public market;
    ProtocolConfig public protocolConfig;

    address public creator = address(0xC0E8);
    address public adjudicator = address(0xAD7);
    address public guardian = address(0x6A2D);
    address public randomUser = address(0xBEEF);

    uint64 public startTime;
    uint64 public deadline;
    string constant QUESTION = "Will BTC reach $100k?";

    function setUp() public {
        startTime = uint64(block.timestamp);
        deadline = uint64(block.timestamp + 30 days);

        protocolConfig = new ProtocolConfig(address(this));
        address[] memory add = new address[](1);
        add[0] = guardian;
        protocolConfig.setGuardians(add, new address[](0));

        market = new TruthMarket(
            QUESTION,
            startTime,
            deadline,
            adjudicator,
            address(protocolConfig),
            creator
        );
    }

    // ============================================
    // Constructor Tests
    // ============================================

    function test_Constructor_SetsCorrectValues() public view {
        assertEq(market.question(), QUESTION);
        assertEq(market.deadline(), deadline);
        assertEq(market.startTime(), startTime);
        assertEq(market.creator(), creator);
        assertEq(market.adjudicator(), adjudicator);
        assertEq(address(market.protocolConfig()), address(protocolConfig));
        assertEq(uint8(market.state()), 0);
    }

    function test_Constructor_RevertWhenDeadlineInPast() public {
        vm.expectRevert("TruthMarket: deadline in past");
        new TruthMarket(QUESTION, startTime, uint64(block.timestamp - 1), adjudicator, address(protocolConfig), creator);
    }

    function test_Constructor_RevertWhenZeroAdjudicator() public {
        vm.expectRevert("TruthMarket: zero adjudicator");
        new TruthMarket(QUESTION, startTime, deadline, address(0), address(protocolConfig), creator);
    }

    function test_Constructor_RevertWhenZeroProtocolConfig() public {
        vm.expectRevert("TruthMarket: zero protocol config");
        new TruthMarket(QUESTION, startTime, deadline, adjudicator, address(0), creator);
    }

    // ============================================
    // IsLive Tests
    // ============================================

    function test_IsLive_TrueAfterStartTime() public view {
        assertTrue(market.isLive());
    }

    function test_IsLive_FalseBeforeStartTime() public {
        uint64 futureStart = uint64(block.timestamp + 1 days);
        uint64 futureDeadline = uint64(block.timestamp + 30 days);
        TruthMarket futureMarket = new TruthMarket(
            QUESTION,
            futureStart,
            futureDeadline,
            adjudicator,
            address(protocolConfig),
            creator
        );

        assertFalse(futureMarket.isLive());
    }

    function test_IsLive_FalseWhenPastDeadline() public {
        vm.warp(deadline + 1);
        assertFalse(market.isLive());
    }

    // ============================================
    // Settlement Tests
    // ============================================

    function test_Settle_YESWins() public {
        vm.prank(adjudicator);
        market.settle(1, 0); // YES = 1

        assertTrue(market.isSettled());
        assertEq(market.winningOutcome(), 1);
    }

    function test_Settle_NOWins() public {
        vm.prank(adjudicator);
        market.settle(0, 0); // NO = 0

        assertTrue(market.isSettled());
        assertEq(market.winningOutcome(), 0);
    }

    function test_Settle_INVALIDWins() public {
        vm.prank(adjudicator);
        market.settle(2, 0); // INVALID = 2

        assertTrue(market.isSettled());
        assertEq(market.winningOutcome(), 2);
    }

    function test_Settle_WithTStar() public {
        uint64 tStarValue = uint64(block.timestamp + 1 days);
        vm.warp(tStarValue + 1 hours);

        vm.prank(adjudicator);
        market.settle(1, tStarValue);

        assertEq(market.tStar(), tStarValue);
    }

    function test_Settle_RevertWhenNotAdjudicator() public {
        vm.prank(randomUser);
        vm.expectRevert("TruthMarket: not adjudicator");
        market.settle(1, 0);
    }

    function test_Settle_RevertWhenNotLive() public {
        uint64 futureStart = uint64(block.timestamp + 1 days);
        uint64 futureDeadline = uint64(block.timestamp + 30 days);
        TruthMarket futureMarket = new TruthMarket(
            QUESTION,
            futureStart,
            futureDeadline,
            adjudicator,
            address(protocolConfig),
            creator
        );

        vm.prank(adjudicator);
        vm.expectRevert("TruthMarket: before start");
        futureMarket.settle(1, 0);
    }

    function test_Settle_RevertWhenInvalidOutcome() public {
        vm.prank(adjudicator);
        vm.expectRevert("TruthMarket: invalid outcome");
        market.settle(3, 0);
    }

    function test_Settle_RevertWhenTStarInFuture() public {
        vm.prank(adjudicator);
        vm.expectRevert("TruthMarket: tStar in future");
        market.settle(1, uint64(block.timestamp + 1));
    }

    // ============================================
    // Veto Tests
    // ============================================

    function test_Veto_Success() public {
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
        vm.prank(adjudicator);
        market.settle(1, 0);

        vm.prank(randomUser);
        vm.expectRevert("TruthMarket: not guardian");
        market.veto();
    }

    function test_Veto_RevertWhenNotSettled() public {
        vm.prank(guardian);
        vm.expectRevert("TruthMarket: not settled");
        market.veto();
    }

    // ============================================
    // Finalize Tests
    // ============================================

    function test_Finalize_ByAdjudicator() public {
        vm.prank(adjudicator);
        market.settle(1, 0);

        vm.prank(adjudicator);
        market.finalize();

        assertTrue(market.isFinalized());
    }

    function test_Finalize_ByGuardian_Reverts() public {
        vm.prank(adjudicator);
        market.settle(1, 0);

        vm.prank(guardian);
        vm.expectRevert("TruthMarket: not adjudicator");
        market.finalize();
    }

    function test_Finalize_RevertWhenNotAuthorized() public {
        vm.prank(adjudicator);
        market.settle(1, 0);

        vm.prank(randomUser);
        vm.expectRevert("TruthMarket: not adjudicator");
        market.finalize();
    }

    function test_Finalize_CannotVetoAfterFinalize() public {
        vm.prank(adjudicator);
        market.settle(1, 0);

        vm.prank(adjudicator);
        market.finalize();

        vm.prank(guardian);
        vm.expectRevert("TruthMarket: not settled");
        market.veto();
    }

    // ============================================
    // Redemption Value Tests
    // ============================================

    function test_RedemptionValue_YesWins() public {
        vm.prank(adjudicator);
        market.settle(1, 0); // YES wins

        assertEq(market.getRedemptionValue(1), 1e18); // YES = 1 WAD
        assertEq(market.getRedemptionValue(0), 0);    // NO = 0
    }

    function test_RedemptionValue_NoWins() public {
        vm.prank(adjudicator);
        market.settle(0, 0); // NO wins

        assertEq(market.getRedemptionValue(0), 1e18); // NO = 1 WAD
        assertEq(market.getRedemptionValue(1), 0);    // YES = 0
    }

    function test_RedemptionValue_Invalid() public {
        vm.prank(adjudicator);
        market.settle(2, 0); // INVALID

        assertEq(market.getRedemptionValue(0), 0.5e18); // NO = 0.5 WAD
        assertEq(market.getRedemptionValue(1), 0.5e18); // YES = 0.5 WAD
    }

    function test_RedemptionValue_RevertWhenNotSettled() public {
        vm.expectRevert("TruthMarket: not settled");
        market.getRedemptionValue(1);
    }

    // ============================================
    // Full Lifecycle Test
    // ============================================

    function test_FullLifecycle_HappyPath() public {
        assertEq(uint8(market.state()), 0);
        assertTrue(market.isLive());

        vm.warp(deadline + 1);
        assertTrue(market.isSettling());

        vm.prank(adjudicator);
        market.settle(1, 0);
        assertTrue(market.isSettled());

        vm.prank(adjudicator);
        market.finalize();
        assertTrue(market.isFinalized());

        assertEq(market.getRedemptionValue(1), 1e18);
    }

    function test_FullLifecycle_WithVeto() public {
        vm.prank(adjudicator);
        market.settle(0, 0);

        vm.prank(guardian);
        market.veto();
        assertTrue(market.isSettling());

        vm.prank(adjudicator);
        market.settle(1, 0);

        vm.prank(adjudicator);
        market.finalize();

        assertEq(market.getRedemptionValue(1), 1e18);
    }
}
