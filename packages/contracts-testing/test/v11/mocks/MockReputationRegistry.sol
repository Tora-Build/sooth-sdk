// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IReputationRegistry} from "@core/interfaces/IERC8004.sol";

/**
 * @title MockReputationRegistry
 * @notice Mock ERC-8004 Reputation Registry for V11 testing
 */
contract MockReputationRegistry is IReputationRegistry {
    struct ReputationData {
        uint64 feedbackCount;
        uint256 totalScore;
    }

    mapping(uint256 => ReputationData) private reputations;

    // ============================================
    // Test Setup Functions
    // ============================================

    /**
     * @notice Set reputation for an agent (for testing)
     * @param agentId The agent ID
     * @param score The reputation score (0-100)
     */
    function setReputation(uint256 agentId, uint8 score) external {
        reputations[agentId] = ReputationData({
            feedbackCount: 1,
            totalScore: score
        });
    }

    /**
     * @notice Set reputation with count (for testing)
     */
    function setReputationWithCount(uint256 agentId, uint8 score, uint64 count) external {
        reputations[agentId] = ReputationData({
            feedbackCount: count,
            totalScore: uint256(score) * uint256(count)
        });
    }

    // ============================================
    // IReputationRegistry Implementation
    // ============================================

    function giveFeedback(
        uint256 agentId,
        uint8 score,
        string calldata, // tag1
        string calldata, // tag2
        string calldata, // endpoint
        string calldata, // feedbackURI
        bytes32 feedbackHash
    ) external override {
        reputations[agentId].feedbackCount++;
        reputations[agentId].totalScore += score;

        emit FeedbackGiven(agentId, msg.sender, score, "", "", feedbackHash);
    }

    function getSummary(
        uint256 agentId,
        address[] calldata, // clients (ignored)
        string calldata, // tag1 (ignored)
        string calldata  // tag2 (ignored)
    ) external view override returns (uint64 count, uint8 averageScore) {
        ReputationData memory data = reputations[agentId];
        count = data.feedbackCount;
        if (count > 0) {
            averageScore = uint8(data.totalScore / uint256(count));
        }
    }

    function getFeedback(
        uint256, // agentId
        uint256, // offset
        uint256  // limit
    ) external pure override returns (uint256[] memory feedbackIds) {
        return new uint256[](0);
    }
}
