// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IValidationRegistry} from "@core/interfaces/IERC8004.sol";

/**
 * @title MockValidationRegistry
 * @notice Mock ERC-8004 Validation Registry for V11 testing
 * @dev Used to test ValidatedAdjudicator TEE attestation flow
 */
contract MockValidationRegistry is IValidationRegistry {
    struct ValidationData {
        address validator;
        uint256 agentId;
        uint8 response;
        string tag;
        uint256 lastUpdate;
    }

    mapping(bytes32 => ValidationData) private validations;

    // ============================================
    // Test Setup Functions
    // ============================================

    /**
     * @notice Set up an attestation for testing
     * @param requestHash The attestation hash
     * @param validator The validator address
     * @param agentId The agent ID
     * @param score The validation score (0-100)
     * @param timestamp The validation timestamp
     */
    function setAttestation(
        bytes32 requestHash,
        address validator,
        uint256 agentId,
        uint8 score,
        uint256 timestamp
    ) external {
        validations[requestHash] = ValidationData({
            validator: validator,
            agentId: agentId,
            response: score,
            tag: "tee-settlement",
            lastUpdate: timestamp
        });
    }

    /**
     * @notice Set up an attestation with tag
     */
    function setAttestationWithTag(
        bytes32 requestHash,
        address validator,
        uint256 agentId,
        uint8 score,
        uint256 timestamp,
        string calldata tag
    ) external {
        validations[requestHash] = ValidationData({
            validator: validator,
            agentId: agentId,
            response: score,
            tag: tag,
            lastUpdate: timestamp
        });
    }

    /**
     * @notice Clear an attestation (for testing invalid cases)
     */
    function clearAttestation(bytes32 requestHash) external {
        delete validations[requestHash];
    }

    // ============================================
    // IValidationRegistry Implementation
    // ============================================

    function validationRequest(
        address validator,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestHash
    ) external override {
        validations[requestHash] = ValidationData({
            validator: validator,
            agentId: agentId,
            response: 0,
            tag: "",
            lastUpdate: block.timestamp
        });

        emit ValidationRequested(requestHash, validator, agentId, requestURI);
    }

    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata, // responseURI
        bytes32, // responseHash
        string calldata tag
    ) external override {
        validations[requestHash].response = response;
        validations[requestHash].tag = tag;
        validations[requestHash].lastUpdate = block.timestamp;

        emit ValidationCompleted(requestHash, response, tag);
    }

    function getValidationStatus(bytes32 requestHash)
        external
        view
        override
        returns (
            address validator,
            uint256 agentId,
            uint8 response,
            string memory tag,
            uint256 lastUpdate
        )
    {
        ValidationData memory data = validations[requestHash];
        return (data.validator, data.agentId, data.response, data.tag, data.lastUpdate);
    }

    function isValidated(bytes32 requestHash, uint8 minScore)
        external
        view
        override
        returns (bool)
    {
        ValidationData memory data = validations[requestHash];
        return data.validator != address(0) && data.response >= minScore;
    }
}
