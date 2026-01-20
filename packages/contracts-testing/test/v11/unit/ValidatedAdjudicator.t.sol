// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {V11TestBase} from "../V11TestBase.sol";
import {ValidatedAdjudicator} from "@core/ValidatedAdjudicator.sol";
import {IValidatedAdjudicator} from "@core/interfaces/IAdjudicator.sol";
import {TruthMarket} from "@core/TruthMarket.sol";

/**
 * @title ValidatedAdjudicator Unit Tests
 * @notice Tests for TEE-validated settlement flow
 */
contract ValidatedAdjudicatorTest is V11TestBase {
    // ============================================
    // Test State
    // ============================================

    address internal testMarket;
    bytes32 internal attestationHash = keccak256("test_attestation");
    address internal validator = address(0xDA1DA70);
    uint256 internal teeAgentId = 100;

    // ============================================
    // Setup
    // ============================================

    function setUp() public override {
        super.setUp();

        // Create a test market with validatedAdjudicator as adjudicator
        testMarket = address(new TruthMarket(
            "Test Market",
            uint64(block.timestamp),
            uint64(block.timestamp + 30 days),
            address(validatedAdjudicator),
            guardian,
            creator
        ));
    }

    // ============================================
    // Market Registration Tests
    // ============================================

    function test_RegisterMarket_OnlyOwnerCanCall() public {
        vm.prank(alice);
        vm.expectRevert();
        validatedAdjudicator.registerMarket(testMarket, teeAgentId, 1);
    }

    function test_RegisterMarket_StoresAgentId() public {
        validatedAdjudicator.registerMarket(testMarket, teeAgentId, 1);

        (, uint256 storedAgentId, , ) = validatedAdjudicator.getMarketConfig(testMarket);
        assertEq(storedAgentId, teeAgentId, "Agent ID should match");
    }

    function test_RegisterMarket_StoresMinValidators() public {
        validatedAdjudicator.registerMarket(testMarket, teeAgentId, 3);

        (, , uint256 minValidators, ) = validatedAdjudicator.getMarketConfig(testMarket);
        assertEq(minValidators, 3, "Min validators should match");
    }

    function test_RegisterMarket_RevertsIfAlreadyRegistered() public {
        validatedAdjudicator.registerMarket(testMarket, teeAgentId, 1);

        vm.expectRevert(ValidatedAdjudicator.MarketAlreadyRegistered.selector);
        validatedAdjudicator.registerMarket(testMarket, teeAgentId, 1);
    }

    function test_RegisterMarket_RevertsOnZeroAddress() public {
        vm.expectRevert(ValidatedAdjudicator.ZeroAddress.selector);
        validatedAdjudicator.registerMarket(address(0), teeAgentId, 1);
    }

    function test_RegisterMarket_EmitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit ValidatedAdjudicator.MarketRegistered(testMarket, teeAgentId, 1);

        validatedAdjudicator.registerMarket(testMarket, teeAgentId, 1);
    }

    // ============================================
    // Single Attestation Settlement Tests
    // ============================================

    function test_Settle_RequiresValidAttestation() public {
        validatedAdjudicator.registerMarket(testMarket, teeAgentId, 1);

        // Warp past deadline FIRST
        _advanceTime(31 days);

        // Setup valid attestation AFTER time warp (so it's fresh)
        validationRegistry.setAttestation(
            attestationHash,
            validator,
            teeAgentId,
            100, // score
            block.timestamp
        );

        // Should succeed
        validatedAdjudicator.settle(testMarket, 1, 0, attestationHash);

        assertTrue(TruthMarket(testMarket).isSettled(), "Market should be settled");
        assertEq(TruthMarket(testMarket).winningOutcome(), 1, "Outcome should be YES");
    }

    function test_Settle_RevertsIfAttestationMissing() public {
        validatedAdjudicator.registerMarket(testMarket, teeAgentId, 1);

        _advanceTime(31 days);

        vm.expectRevert(IValidatedAdjudicator.AttestationMissing.selector);
        validatedAdjudicator.settle(testMarket, 1, 0, attestationHash);
    }

    function test_Settle_RevertsIfAttestationTooOld() public {
        validatedAdjudicator.registerMarket(testMarket, teeAgentId, 1);

        // Warp past deadline first
        _advanceTime(31 days);

        // Setup old attestation (2 hours ago, window is 1 hour)
        // Now that time has advanced, we can safely subtract
        validationRegistry.setAttestation(
            attestationHash,
            validator,
            teeAgentId,
            100,
            block.timestamp - 2 hours
        );

        vm.expectRevert(IValidatedAdjudicator.AttestationTooOld.selector);
        validatedAdjudicator.settle(testMarket, 1, 0, attestationHash);
    }

    function test_Settle_RevertsIfScoreBelowMin() public {
        validatedAdjudicator.registerMarket(testMarket, teeAgentId, 1);

        // Setup attestation with low score (min is 80)
        validationRegistry.setAttestation(
            attestationHash,
            validator,
            teeAgentId,
            50, // Below minimum
            block.timestamp
        );

        _advanceTime(31 days);

        vm.expectRevert(IValidatedAdjudicator.AttestationInvalid.selector);
        validatedAdjudicator.settle(testMarket, 1, 0, attestationHash);
    }

    function test_Settle_RevertsIfWrongAgentId() public {
        validatedAdjudicator.registerMarket(testMarket, teeAgentId, 1);

        // Setup attestation with wrong agent ID
        validationRegistry.setAttestation(
            attestationHash,
            validator,
            999, // Wrong agent ID
            100,
            block.timestamp
        );

        _advanceTime(31 days);

        vm.expectRevert(IValidatedAdjudicator.AttestationInvalid.selector);
        validatedAdjudicator.settle(testMarket, 1, 0, attestationHash);
    }

    function test_Settle_RevertsIfMarketNotRegistered() public {
        vm.expectRevert(ValidatedAdjudicator.MarketNotRegistered.selector);
        validatedAdjudicator.settle(testMarket, 1, 0, attestationHash);
    }

    function test_Settle_RevertsIfMarketAlreadySettled() public {
        validatedAdjudicator.registerMarket(testMarket, teeAgentId, 1);

        // Warp past deadline first
        _advanceTime(31 days);

        // Setup attestation AFTER time warp
        validationRegistry.setAttestation(
            attestationHash,
            validator,
            teeAgentId,
            100,
            block.timestamp
        );

        // First settle succeeds
        validatedAdjudicator.settle(testMarket, 1, 0, attestationHash);

        // Second settle fails
        bytes32 newHash = keccak256("new_attestation");
        validationRegistry.setAttestation(newHash, validator, teeAgentId, 100, block.timestamp);

        vm.expectRevert(ValidatedAdjudicator.MarketAlreadySettled.selector);
        validatedAdjudicator.settle(testMarket, 0, 0, newHash);
    }

    function test_Settle_EmitsSettledEvent() public {
        validatedAdjudicator.registerMarket(testMarket, teeAgentId, 1);

        // Warp past deadline first
        _advanceTime(31 days);

        // Setup attestation AFTER time warp
        validationRegistry.setAttestation(
            attestationHash,
            validator,
            teeAgentId,
            100,
            block.timestamp
        );

        vm.expectEmit(true, false, false, true);
        emit ValidatedAdjudicator.MarketSettled(testMarket, 1, 0, attestationHash);

        validatedAdjudicator.settle(testMarket, 1, 0, attestationHash);
    }

    // ============================================
    // Multi-Attestation Settlement Tests
    // ============================================

    function test_SettleMultiple_RequiresMinValidators() public {
        validatedAdjudicator.registerMarket(testMarket, teeAgentId, 3);

        // Warp past deadline first
        _advanceTime(31 days);

        bytes32[] memory hashes = new bytes32[](2);
        hashes[0] = keccak256("attest1");
        hashes[1] = keccak256("attest2");

        // Setup attestations AFTER time warp
        for (uint i = 0; i < 2; i++) {
            validationRegistry.setAttestation(
                hashes[i],
                validator,
                teeAgentId,
                100,
                block.timestamp
            );
        }

        vm.expectRevert(IValidatedAdjudicator.InsufficientValidators.selector);
        validatedAdjudicator.settleWithMultipleAttestations(testMarket, 1, 0, hashes);
    }

    function test_SettleMultiple_SucceedsWithEnoughAttestations() public {
        validatedAdjudicator.registerMarket(testMarket, teeAgentId, 3);

        // Warp past deadline first
        _advanceTime(31 days);

        bytes32[] memory hashes = new bytes32[](3);
        // Setup attestations AFTER time warp
        for (uint i = 0; i < 3; i++) {
            hashes[i] = keccak256(abi.encodePacked("attest", i));
            validationRegistry.setAttestation(
                hashes[i],
                validator,
                teeAgentId,
                100,
                block.timestamp
            );
        }

        validatedAdjudicator.settleWithMultipleAttestations(testMarket, 1, 0, hashes);

        assertTrue(TruthMarket(testMarket).isSettled(), "Market should be settled");
    }

    function test_SettleMultiple_ValidatesAllAttestations() public {
        validatedAdjudicator.registerMarket(testMarket, teeAgentId, 2);

        // Warp past deadline first
        _advanceTime(31 days);

        bytes32[] memory hashes = new bytes32[](2);
        hashes[0] = keccak256("valid");
        hashes[1] = keccak256("invalid");

        // First is valid - setup AFTER time warp
        validationRegistry.setAttestation(hashes[0], validator, teeAgentId, 100, block.timestamp);
        // Second has wrong agent ID
        validationRegistry.setAttestation(hashes[1], validator, 999, 100, block.timestamp);

        vm.expectRevert(IValidatedAdjudicator.AttestationInvalid.selector);
        validatedAdjudicator.settleWithMultipleAttestations(testMarket, 1, 0, hashes);
    }

    function test_SettleMultiple_RecordsFirstAttestationHash() public {
        validatedAdjudicator.registerMarket(testMarket, teeAgentId, 2);

        // Warp past deadline first
        _advanceTime(31 days);

        bytes32[] memory hashes = new bytes32[](2);
        hashes[0] = keccak256("first");
        hashes[1] = keccak256("second");

        // Setup attestations AFTER time warp
        for (uint i = 0; i < 2; i++) {
            validationRegistry.setAttestation(
                hashes[i],
                validator,
                teeAgentId,
                100,
                block.timestamp
            );
        }

        validatedAdjudicator.settleWithMultipleAttestations(testMarket, 1, 0, hashes);

        (, , , bytes32 lastAttestation) = validatedAdjudicator.getMarketConfig(testMarket);
        assertEq(lastAttestation, hashes[0], "Should record first hash");
    }

    // ============================================
    // View Functions Tests
    // ============================================

    function test_CanSettle_ReturnsTrueIfRegisteredAndUnsettled() public {
        validatedAdjudicator.registerMarket(testMarket, teeAgentId, 1);

        assertTrue(validatedAdjudicator.canSettle(testMarket), "Should be able to settle");
    }

    function test_CanSettle_ReturnsFalseIfNotRegistered() public {
        assertFalse(validatedAdjudicator.canSettle(testMarket), "Cannot settle unregistered");
    }

    function test_CanSettle_ReturnsFalseIfSettled() public {
        validatedAdjudicator.registerMarket(testMarket, teeAgentId, 1);

        // Warp past deadline first
        _advanceTime(31 days);

        // Setup attestation AFTER time warp
        validationRegistry.setAttestation(attestationHash, validator, teeAgentId, 100, block.timestamp);
        validatedAdjudicator.settle(testMarket, 1, 0, attestationHash);

        assertFalse(validatedAdjudicator.canSettle(testMarket), "Cannot settle again");
    }

    function test_AdjudicatorType_ReturnsTee() public view {
        assertEq(validatedAdjudicator.adjudicatorType(), "tee", "Type should be tee");
    }

    function test_GetMinValidators_ReturnsConfigured() public {
        validatedAdjudicator.registerMarket(testMarket, teeAgentId, 5);

        assertEq(validatedAdjudicator.getMinValidators(testMarket), 5, "Should return 5");
    }

    function test_IsMarketRegistered_ReturnsCorrectly() public {
        assertFalse(validatedAdjudicator.isMarketRegistered(testMarket), "Not registered");

        validatedAdjudicator.registerMarket(testMarket, teeAgentId, 1);

        assertTrue(validatedAdjudicator.isMarketRegistered(testMarket), "Should be registered");
    }

    // ============================================
    // Admin Functions Tests
    // ============================================

    function test_SetValidationRegistry_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        validatedAdjudicator.setValidationRegistry(address(0x123));
    }

    function test_SetValidationRegistry_RevertsOnZero() public {
        vm.expectRevert(ValidatedAdjudicator.ZeroAddress.selector);
        validatedAdjudicator.setValidationRegistry(address(0));
    }

    function test_SetValidationRegistry_EmitsEvent() public {
        address newRegistry = address(0x123);

        vm.expectEmit(true, false, false, false);
        emit ValidatedAdjudicator.ValidationRegistryUpdated(newRegistry);

        validatedAdjudicator.setValidationRegistry(newRegistry);
    }

    function test_SetAttestationWindow_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        validatedAdjudicator.setAttestationWindow(2 hours);
    }

    function test_SetAttestationWindow_UpdatesValue() public {
        validatedAdjudicator.setAttestationWindow(2 hours);
        assertEq(validatedAdjudicator.attestationWindow(), 2 hours, "Window updated");
    }

    function test_SetMinValidationScore_OnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        validatedAdjudicator.setMinValidationScore(90);
    }

    function test_SetMinValidationScore_UpdatesValue() public {
        validatedAdjudicator.setMinValidationScore(90);
        assertEq(validatedAdjudicator.minValidationScore(), 90, "Score updated");
    }
}
