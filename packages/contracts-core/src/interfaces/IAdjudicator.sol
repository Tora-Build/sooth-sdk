// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAdjudicator
 * @notice Standard interface for market adjudicators (settlement authorities)
 * @dev Adjudicators are responsible for determining market outcomes.
 *      Different implementations can use various resolution mechanisms:
 *      - Manual: Human adjudicator submits outcome
 *      - Oracle: External data feed provides outcome
 *      - TEE: Trusted Execution Environment validates outcome (ValidatedAdjudicator)
 *      - DAO: Governance vote determines outcome
 *      - UMA/Optimistic: Dispute-based resolution
 */
interface IAdjudicator {
    // ============================================
    // Events
    // ============================================

    /// @notice Emitted when an adjudicator settles a market
    event MarketSettledByAdjudicator(
        address indexed market,
        uint8 outcome,
        uint64 tStar,
        bytes32 indexed resolutionData
    );

    // ============================================
    // Settlement Functions
    // ============================================

    /**
     * @notice Settle a market with the determined outcome
     * @dev Implementation-specific. May require attestations, oracle data, or governance approval.
     * @param market The TruthMarket address to settle
     * @param outcome The winning outcome (0=NO, 1=YES, 2=INVALID)
     * @param tStar The retroactive truth-time (0 if not applicable)
     * @param resolutionData Implementation-specific data (attestation hash, oracle proof, etc.)
     */
    function settle(
        address market,
        uint8 outcome,
        uint64 tStar,
        bytes32 resolutionData
    ) external;

    // ============================================
    // Query Functions
    // ============================================

    /**
     * @notice Check if this adjudicator can settle a specific market
     * @param market The market address
     * @return True if this adjudicator is authorized for the market
     */
    function canSettle(address market) external view returns (bool);

    /**
     * @notice Get the adjudicator type identifier
     * @dev Used for frontend/indexer to determine adjudicator capabilities
     * @return Type string (e.g., "manual", "oracle", "tee", "dao")
     */
    function adjudicatorType() external view returns (string memory);
}

/**
 * @title IValidatedAdjudicator
 * @notice Extended interface for TEE-validated adjudicators (ERC-8004 integration)
 * @dev Adds attestation verification requirements on top of base IAdjudicator
 */
interface IValidatedAdjudicator is IAdjudicator {
    // ============================================
    // Errors
    // ============================================

    error AttestationMissing();
    error AttestationInvalid();
    error AttestationTooOld();
    error InsufficientValidators();

    // ============================================
    // Multi-Attestation Settlement
    // ============================================

    /**
     * @notice Settle with multiple attestations (for high-value markets)
     * @param market The TruthMarket to settle
     * @param outcome The winning outcome
     * @param tStar The truth point timestamp
     * @param attestationHashes Array of attestation hashes from different validators
     */
    function settleWithMultipleAttestations(
        address market,
        uint8 outcome,
        uint64 tStar,
        bytes32[] calldata attestationHashes
    ) external;

    // ============================================
    // Configuration
    // ============================================

    /**
     * @notice Get minimum validators required for a market
     * @param market The market address
     * @return Number of validators required
     */
    function getMinValidators(address market) external view returns (uint256);

    /**
     * @notice Get attestation validity window
     * @return Window in seconds
     */
    function attestationWindow() external view returns (uint256);

    /**
     * @notice Get minimum validation score required
     * @return Score (0-100)
     */
    function minValidationScore() external view returns (uint8);
}

/**
 * @title IAdjudicatorRegistration
 * @notice Optional interface for adjudicators that require per-market registration
 */
interface IAdjudicatorRegistration {
    /**
     * @notice Register a market with adjudicator-specific config
     * @param market The TruthMarket address
     * @param agentId The ERC-8004 agent ID authorized to settle
     * @param minValidators Minimum validators required
     */
    function registerMarket(address market, uint256 agentId, uint256 minValidators) external;
}
