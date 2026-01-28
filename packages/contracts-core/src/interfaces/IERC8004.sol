// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IIdentityRegistry
 * @notice ERC-8004 Identity Registry interface
 * @dev Manages agent identity as ERC-721 NFTs with metadata and wallet delegation
 */
interface IIdentityRegistry {
    /// @notice Register a new agent
    /// @param agentURI URI pointing to agent metadata JSON
    /// @return agentId The newly minted agent NFT ID
    function register(string calldata agentURI) external returns (uint256 agentId);

    /// @notice Get agent metadata by key
    /// @param agentId The agent NFT ID
    /// @param key Metadata key to retrieve
    /// @return value The metadata value as bytes
    function getMetadata(uint256 agentId, string calldata key) external view returns (bytes memory value);

    /// @notice Set agent metadata
    /// @param agentId The agent NFT ID
    /// @param key Metadata key
    /// @param value Metadata value
    function setMetadata(uint256 agentId, string calldata key, bytes calldata value) external;

    /// @notice Delegate agent wallet to a new address
    /// @param agentId The agent NFT ID
    /// @param newWallet The new wallet address
    /// @param deadline Signature deadline
    /// @param sig EIP-712 signature from current owner
    function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes calldata sig) external;

    /// @notice Get the delegated wallet for an agent
    /// @param agentId The agent NFT ID
    /// @return wallet The delegated wallet address (or owner if not delegated)
    function getAgentWallet(uint256 agentId) external view returns (address wallet);

    /// @notice Get the owner of an agent NFT (ERC-721)
    /// @param agentId The agent NFT ID
    /// @return owner The NFT owner address
    function ownerOf(uint256 agentId) external view returns (address owner);

    /// @notice Check if an agent is registered
    /// @param agentId The agent NFT ID
    /// @return exists True if agent exists
    function exists(uint256 agentId) external view returns (bool exists);

    /// @notice Get the agent URI
    /// @param agentId The agent NFT ID
    /// @return uri The agent metadata URI
    function agentURI(uint256 agentId) external view returns (string memory uri);
}

/**
 * @title IReputationRegistry
 * @notice ERC-8004 Reputation Registry interface
 * @dev Tracks agent reputation via feedback scores and tags
 */
interface IReputationRegistry {
    /// @notice Give feedback to an agent
    /// @param agentId The agent receiving feedback
    /// @param score Score from 0-100
    /// @param tag1 Primary category tag (e.g., "sooth-trading")
    /// @param tag2 Secondary tag (e.g., "prediction")
    /// @param endpoint The endpoint/service being rated
    /// @param feedbackURI URI to detailed feedback (e.g., IPFS)
    /// @param feedbackHash Hash of feedback content for verification
    function giveFeedback(
        uint256 agentId,
        uint8 score,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;

    /// @notice Get reputation summary for an agent
    /// @param agentId The agent to query
    /// @param clients Filter by specific client addresses (empty = all)
    /// @param tag1 Filter by primary tag (empty = all)
    /// @param tag2 Filter by secondary tag (empty = all)
    /// @return count Number of feedback entries
    /// @return averageScore Average score (0-100)
    function getSummary(
        uint256 agentId,
        address[] calldata clients,
        string calldata tag1,
        string calldata tag2
    ) external view returns (uint64 count, uint8 averageScore);

    /// @notice Get detailed feedback entries
    /// @param agentId The agent to query
    /// @param offset Pagination offset
    /// @param limit Maximum entries to return
    /// @return feedbackIds Array of feedback entry IDs
    function getFeedback(
        uint256 agentId,
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory feedbackIds);

    /// @notice Emitted when feedback is given
    event FeedbackGiven(
        uint256 indexed agentId,
        address indexed client,
        uint8 score,
        string tag1,
        string tag2,
        bytes32 feedbackHash
    );
}

/**
 * @title IValidationRegistry
 * @notice ERC-8004 Validation Registry interface
 * @dev Manages TEE attestations and zkML verification for agent actions
 */
interface IValidationRegistry {
    /// @notice Request validation for an agent action
    /// @param validator The validator address (TEE operator)
    /// @param agentId The agent being validated
    /// @param requestURI URI describing the validation request
    /// @param requestHash Hash of request for verification
    function validationRequest(
        address validator,
        uint256 agentId,
        string calldata requestURI,
        bytes32 requestHash
    ) external;

    /// @notice Submit validation response
    /// @param requestHash The original request hash
    /// @param response Validation score (0=failed, 100=passed)
    /// @param responseURI URI to validation proof (e.g., attestation)
    /// @param responseHash Hash of response content
    /// @param tag Validation type tag (e.g., "tee-settlement")
    function validationResponse(
        bytes32 requestHash,
        uint8 response,
        string calldata responseURI,
        bytes32 responseHash,
        string calldata tag
    ) external;

    /// @notice Get validation status
    /// @param requestHash The request hash to query
    /// @return validator The validator address
    /// @return agentId The agent ID
    /// @return response The validation response (0-100)
    /// @return tag The validation type tag
    /// @return lastUpdate Timestamp of last update
    function getValidationStatus(bytes32 requestHash) external view returns (
        address validator,
        uint256 agentId,
        uint8 response,
        string memory tag,
        uint256 lastUpdate
    );

    /// @notice Check if a validation is complete and passed
    /// @param requestHash The request hash to check
    /// @param minScore Minimum acceptable score
    /// @return valid True if validated with score >= minScore
    function isValidated(bytes32 requestHash, uint8 minScore) external view returns (bool valid);

    /// @notice Emitted when validation is requested
    event ValidationRequested(
        bytes32 indexed requestHash,
        address indexed validator,
        uint256 indexed agentId,
        string requestURI
    );

    /// @notice Emitted when validation response is submitted
    event ValidationCompleted(
        bytes32 indexed requestHash,
        uint8 response,
        string tag
    );
}
