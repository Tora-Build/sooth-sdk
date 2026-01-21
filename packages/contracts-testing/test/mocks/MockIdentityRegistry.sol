// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IIdentityRegistry} from "@core/interfaces/IERC8004.sol";

/**
 * @title MockIdentityRegistry
 * @notice Mock ERC-8004 Identity Registry for V11 testing
 */
contract MockIdentityRegistry is IIdentityRegistry {
    struct AgentData {
        bool exists;
        address wallet;
        address owner;
        string uri;
        mapping(string => bytes) metadata;
    }

    mapping(uint256 => AgentData) private agents;
    uint256 private nextAgentId = 1;

    // ============================================
    // Test Setup Functions
    // ============================================

    /**
     * @notice Set up an agent for testing
     * @param agentId The agent ID
     * @param wallet The agent's delegated wallet
     * @param owner The NFT owner
     */
    function setAgent(uint256 agentId, address wallet, address owner) external {
        agents[agentId].exists = true;
        agents[agentId].wallet = wallet;
        agents[agentId].owner = owner;
    }

    /**
     * @notice Set agent URI
     */
    function setAgentURI(uint256 agentId, string calldata uri) external {
        agents[agentId].uri = uri;
    }

    // ============================================
    // IIdentityRegistry Implementation
    // ============================================

    function register(string calldata _agentURI) external override returns (uint256 agentId) {
        agentId = nextAgentId++;
        agents[agentId].exists = true;
        agents[agentId].wallet = msg.sender;
        agents[agentId].owner = msg.sender;
        agents[agentId].uri = _agentURI;
    }

    function getMetadata(uint256 agentId, string calldata key) external view override returns (bytes memory) {
        return agents[agentId].metadata[key];
    }

    function setMetadata(uint256 agentId, string calldata key, bytes calldata value) external override {
        require(agents[agentId].exists, "Agent does not exist");
        require(msg.sender == agents[agentId].owner, "Not owner");
        agents[agentId].metadata[key] = value;
    }

    function setAgentWallet(
        uint256 agentId,
        address newWallet,
        uint256, // deadline
        bytes calldata // sig
    ) external override {
        require(agents[agentId].exists, "Agent does not exist");
        require(msg.sender == agents[agentId].owner, "Not owner");
        agents[agentId].wallet = newWallet;
    }

    function getAgentWallet(uint256 agentId) external view override returns (address) {
        if (!agents[agentId].exists) return address(0);
        return agents[agentId].wallet != address(0) ? agents[agentId].wallet : agents[agentId].owner;
    }

    function ownerOf(uint256 agentId) external view override returns (address) {
        require(agents[agentId].exists, "Agent does not exist");
        return agents[agentId].owner;
    }

    function exists(uint256 agentId) external view override returns (bool) {
        return agents[agentId].exists;
    }

    function agentURI(uint256 agentId) external view override returns (string memory) {
        return agents[agentId].uri;
    }
}
