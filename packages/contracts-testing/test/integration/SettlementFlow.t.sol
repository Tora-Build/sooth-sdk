// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TrialPeriodTestBase} from "../base/TrialPeriodTestBase.sol";
import {ValidatedAdjudicator} from "@core/ValidatedAdjudicator.sol";
import {TruthMarket} from "@core/TruthMarket.sol";
import {LaunchpadLPToken} from "@core/LaunchpadLPToken.sol";

/**
 * @title Settlement Flow Integration Tests
 * @notice End-to-end tests for TEE settlement → LP locking → redemption
 */
contract SettlementFlowTest is TrialPeriodTestBase {
    // ============================================
    // Test State
    // ============================================

    address internal testMarket;
    uint256 internal teeAgentId = 100;
    bytes32 internal attestationHash = keccak256("settlement_attestation");
    address internal validator = address(0xDA1DA70);

    // ============================================
    // Setup
    // ============================================

    function setUp() public override {
        super.setUp();

        // Create market with ValidatedAdjudicator
        testMarket = address(new TruthMarket(
            "TEE Settlement Test",
            uint64(block.timestamp),
            uint64(block.timestamp + 30 days),
            address(validatedAdjudicator),
            address(protocolConfig),
            creator
        ));

        // Register market in adjudicator
        validatedAdjudicator.registerMarket(testMarket, teeAgentId, 1);
    }

    // ============================================
    // TEE Settlement Flow Tests
    // ============================================

    function test_TEESettlement_FullFlow() public {
        // 1. Warp past deadline FIRST
        _advanceTime(31 days);

        // 2. Setup valid attestation AFTER time warp (so it's fresh)
        validationRegistry.setAttestation(
            attestationHash,
            validator,
            teeAgentId,
            100, // Perfect score
            block.timestamp
        );

        // 3. Verify market can be settled
        assertTrue(validatedAdjudicator.canSettle(testMarket), "Should be settleable");

        // 4. Settle via ValidatedAdjudicator
        validatedAdjudicator.settle(testMarket, 1, 0, attestationHash);

        // 5. Verify settlement
        assertTrue(TruthMarket(testMarket).isSettled(), "Market should be settled");
        assertEq(TruthMarket(testMarket).winningOutcome(), 1, "YES should win");
    }

    function test_TEESettlement_MultipleValidators() public {
        // Register market requiring 3 validators
        address market2 = address(new TruthMarket(
            "Multi-Validator Test",
            uint64(block.timestamp),
            uint64(block.timestamp + 30 days),
            address(validatedAdjudicator),
            address(protocolConfig),
            creator
        ));

        validatedAdjudicator.registerMarket(market2, teeAgentId, 3);

        // Warp past deadline first
        _advanceTime(31 days);

        // Setup 3 attestations AFTER time warp
        bytes32[] memory hashes = new bytes32[](3);
        for (uint i = 0; i < 3; i++) {
            hashes[i] = keccak256(abi.encodePacked("multi_attest_", i));
            validationRegistry.setAttestation(
                hashes[i],
                validator,
                teeAgentId,
                100,
                block.timestamp
            );
        }

        // Settle with multiple attestations
        validatedAdjudicator.settleWithMultipleAttestations(market2, 0, 0, hashes);

        assertTrue(TruthMarket(market2).isSettled(), "Market should be settled");
        assertEq(TruthMarket(market2).winningOutcome(), 0, "NO should win");
    }

    // ============================================
    // LP Token Locking Tests
    // ============================================

    function test_TEESettlement_LPTokensLockedAfterSettlement() public {
        // Create market through launchpad for LP tokens
        address market = _createMarket();
        address lpToken = launchpad.getLPToken(market);

        // Trade to get LP tokens
        _buyShares(alice, market, 1, 100e18);
        uint256 aliceLP = launchpad.getLPBalance(market, alice);
        assertGt(aliceLP, 0, "Alice should have LP");

        // Check how much LP alice has for transfer
        uint256 transferAmount = aliceLP > 20e18 ? 10e18 : aliceLP / 3;

        // Transfer works pre-settlement
        vm.prank(alice);
        LaunchpadLPToken(lpToken).transfer(bob, transferAmount);

        // Settle the market via adjudicator
        _settleMarket(market, 1);

        // Transfer blocked post-settlement
        vm.prank(alice);
        vm.expectRevert(LaunchpadLPToken.TransfersLocked.selector);
        LaunchpadLPToken(lpToken).transfer(bob, transferAmount);
    }

    function test_TEESettlement_LPRedemptionStillWorks() public {
        address market = _createMarket();

        // Trade to get LP tokens
        _buyShares(alice, market, 1, 100e18);
        uint256 aliceLP = launchpad.getLPBalance(market, alice);

        // Settle
        _settleMarket(market, 1);

        // LP redemption should still work
        uint256 balanceBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        launchpad.redeemLP(market, aliceLP);

        // Note: Redemption value depends on floor calculation
        // Just verify the call succeeded
        assertLt(launchpad.getLPBalance(market, alice), aliceLP, "LP burned");
    }

    // ============================================
    // Redemption Value Tests
    // ============================================

    /// @dev Helper to settle testMarket via ValidatedAdjudicator
    function _settleTestMarketViaTEE(uint8 outcome) internal {
        // Warp past deadline
        _advanceTime(31 days);

        // Setup fresh attestation
        bytes32 hash = keccak256(abi.encodePacked("redemption_test_", outcome));
        validationRegistry.setAttestation(hash, validator, teeAgentId, 100, block.timestamp);

        // Settle via validatedAdjudicator
        validatedAdjudicator.settle(testMarket, outcome, 0, hash);
    }

    function test_Redemption_YESWins() public {
        _settleTestMarketViaTEE(1); // YES wins

        uint256 yesValue = TruthMarket(testMarket).getRedemptionValue(1);
        uint256 noValue = TruthMarket(testMarket).getRedemptionValue(0);

        assertEq(yesValue, 1e18, "YES should be worth 1 WAD");
        assertEq(noValue, 0, "NO should be worthless");
    }

    function test_Redemption_NOWins() public {
        _settleTestMarketViaTEE(0); // NO wins

        uint256 yesValue = TruthMarket(testMarket).getRedemptionValue(1);
        uint256 noValue = TruthMarket(testMarket).getRedemptionValue(0);

        assertEq(yesValue, 0, "YES should be worthless");
        assertEq(noValue, 1e18, "NO should be worth 1 WAD");
    }

    function test_Redemption_Invalid() public {
        _settleTestMarketViaTEE(2); // INVALID

        uint256 yesValue = TruthMarket(testMarket).getRedemptionValue(1);
        uint256 noValue = TruthMarket(testMarket).getRedemptionValue(0);

        assertEq(yesValue, 0.5e18, "YES should be worth 0.5 WAD");
        assertEq(noValue, 0.5e18, "NO should be worth 0.5 WAD");
    }

    // ============================================
    // Guardian Veto Flow Tests
    // ============================================

    function test_Veto_RevertsSettlement() public {
        // Warp past deadline first
        _advanceTime(31 days);

        // Setup attestation AFTER time warp
        validationRegistry.setAttestation(attestationHash, validator, teeAgentId, 100, block.timestamp);
        validatedAdjudicator.settle(testMarket, 1, 0, attestationHash);

        assertTrue(TruthMarket(testMarket).isSettled(), "Should be settled");

        // Guardian vetoes
        vm.prank(guardian);
        TruthMarket(testMarket).veto();

        // Market is back to settling state
        assertTrue(TruthMarket(testMarket).isSettling(), "Should be settling again");
        assertFalse(TruthMarket(testMarket).isSettled(), "Should not be settled");
    }

    function test_Veto_CanSettleAgain() public {
        // Warp past deadline first
        _advanceTime(31 days);

        // First settlement
        validationRegistry.setAttestation(attestationHash, validator, teeAgentId, 100, block.timestamp);
        validatedAdjudicator.settle(testMarket, 1, 0, attestationHash);

        // Veto
        vm.prank(guardian);
        TruthMarket(testMarket).veto();

        // Can settle again with different outcome
        bytes32 newHash = keccak256("new_attestation");
        validationRegistry.setAttestation(newHash, validator, teeAgentId, 100, block.timestamp);

        validatedAdjudicator.settle(testMarket, 0, 0, newHash);

        assertEq(TruthMarket(testMarket).winningOutcome(), 0, "NO should win now");
    }

    // ============================================
    // Finalization Tests
    // ============================================

    function test_Finalize_PreventsVeto() public {
        // Warp past deadline first
        _advanceTime(31 days);

        // Settle with fresh attestation
        validationRegistry.setAttestation(attestationHash, validator, teeAgentId, 100, block.timestamp);
        validatedAdjudicator.settle(testMarket, 1, 0, attestationHash);

        // Finalize
        vm.prank(address(validatedAdjudicator));
        TruthMarket(testMarket).finalize();

        // Veto should fail
        vm.prank(guardian);
        vm.expectRevert("TruthMarket: not settled");
        TruthMarket(testMarket).veto();
    }

    function test_Finalize_MarketIsFinalized() public {
        // Warp past deadline first
        _advanceTime(31 days);

        // Settle with fresh attestation
        validationRegistry.setAttestation(attestationHash, validator, teeAgentId, 100, block.timestamp);
        validatedAdjudicator.settle(testMarket, 1, 0, attestationHash);

        vm.prank(address(validatedAdjudicator));
        TruthMarket(testMarket).finalize();

        assertTrue(TruthMarket(testMarket).isFinalized(), "Should be finalized");
    }

    // ============================================
    // Edge Cases
    // ============================================

    function test_Settlement_CannotSettleBeforeStart() public {
        // Create market starting in future
        address futureMarket = address(new TruthMarket(
            "Future Market",
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 30 days),
            address(validatedAdjudicator),
            address(protocolConfig),
            creator
        ));

        validatedAdjudicator.registerMarket(futureMarket, teeAgentId, 1);
        validationRegistry.setAttestation(attestationHash, validator, teeAgentId, 100, block.timestamp);

        // Cannot settle before start
        vm.expectRevert("TruthMarket: before start");
        validatedAdjudicator.settle(futureMarket, 1, 0, attestationHash);
    }

    function test_Settlement_WithTStar() public {
        // Store current timestamp for tStar calculation
        uint64 startTime = uint64(block.timestamp);
        uint64 tStarValue = startTime + 15 days;

        // Warp to after tStar (and past deadline)
        _advanceTime(31 days);

        // Setup attestation AFTER time warp
        validationRegistry.setAttestation(attestationHash, validator, teeAgentId, 100, block.timestamp);

        // Settle with tStar
        validatedAdjudicator.settle(testMarket, 1, tStarValue, attestationHash);

        assertEq(TruthMarket(testMarket).tStar(), tStarValue, "tStar should be set");
    }
}
