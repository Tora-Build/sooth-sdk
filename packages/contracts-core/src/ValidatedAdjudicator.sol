// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ITruthMarket} from "./interfaces/ITruthMarket.sol";
import {IValidationRegistry} from "./interfaces/IERC8004.sol";
import {IValidatedAdjudicator} from "./interfaces/IAdjudicator.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ValidatedAdjudicator
 * @notice TEE-validated adjudicator for trustless market settlement
 * @dev V11: Integrates with ERC-8004 Validation Registry for TEE attestations
 *
 *      Settlement flow:
 *      1. TEE agent fetches resolution data in secure enclave
 *      2. TEE generates attestation of correct execution
 *      3. Agent submits attestation to Validation Registry
 *      4. ValidatedAdjudicator verifies attestation before settling
 *
 *      Security properties:
 *      - Settlement requires valid TEE attestation
 *      - Attestation must be recent (within attestationWindow)
 *      - Multiple validators can be required for high-value markets
 *      - Owner can update validator requirements
 */
contract ValidatedAdjudicator is IValidatedAdjudicator, Ownable {
    // ============================================
    // Errors (additional to IValidatedAdjudicator)
    // ============================================

    error ZeroAddress();
    error InvalidConfig();
    error MarketNotRegistered();
    error MarketAlreadySettled();
    error NotRegisteredAgent();
    error MarketAlreadyRegistered();

    // ============================================
    // Events
    // ============================================

    event MarketRegistered(address indexed market, uint256 indexed agentId, uint256 minValidators);
    event MarketSettled(address indexed market, uint8 outcome, uint64 tStar, bytes32 attestationHash);
    event ValidationRegistryUpdated(address indexed registry);
    event AttestationWindowUpdated(uint256 window);
    event MinScoreUpdated(uint8 minScore);

    // ============================================
    // Storage
    // ============================================

    /// @notice ERC-8004 Validation Registry
    IValidationRegistry public validationRegistry;

    /// @notice Window in seconds for valid attestations (default: 1 hour)
    uint256 public attestationWindow;

    /// @notice Minimum validation score required (0-100)
    uint8 public minValidationScore;

    /// @notice Markets registered with this adjudicator
    struct MarketConfig {
        bool registered;
        uint256 agentId;           // The TEE agent authorized to settle
        uint256 minValidators;     // Minimum validators required
        bytes32 lastAttestation;   // Last attestation hash used
    }

    mapping(address => MarketConfig) public marketConfigs;

    // ============================================
    // Constructor
    // ============================================

    /**
     * @param _validationRegistry ERC-8004 Validation Registry address
     * @param _attestationWindow Time window for valid attestations (seconds)
     * @param _minScore Minimum validation score required (0-100)
     * @param _owner Contract owner
     */
    constructor(
        address _validationRegistry,
        uint256 _attestationWindow,
        uint8 _minScore,
        address _owner
    ) Ownable(_owner) {
        if (_validationRegistry == address(0)) revert ZeroAddress();

        validationRegistry = IValidationRegistry(_validationRegistry);
        attestationWindow = _attestationWindow;
        minValidationScore = _minScore;
    }

    // ============================================
    // Admin Functions
    // ============================================

    /**
     * @notice Update the Validation Registry address
     * @param _registry New registry address
     */
    function setValidationRegistry(address _registry) external onlyOwner {
        if (_registry == address(0)) revert ZeroAddress();
        validationRegistry = IValidationRegistry(_registry);
        emit ValidationRegistryUpdated(_registry);
    }

    /**
     * @notice Update attestation validity window
     * @param _window New window in seconds
     */
    function setAttestationWindow(uint256 _window) external onlyOwner {
        attestationWindow = _window;
        emit AttestationWindowUpdated(_window);
    }

    /**
     * @notice Update minimum validation score
     * @param _minScore New minimum score (0-100)
     */
    function setMinValidationScore(uint8 _minScore) external onlyOwner {
        minValidationScore = _minScore;
        emit MinScoreUpdated(_minScore);
    }

    // ============================================
    // Market Registration
    // ============================================

    /**
     * @notice Register a market for TEE-validated settlement
     * @param market The TruthMarket address
     * @param agentId The ERC-8004 agent ID authorized to settle
     * @param minValidators Minimum number of validators required
     */
    function registerMarket(
        address market,
        uint256 agentId,
        uint256 minValidators
    ) external {
        if (market == address(0)) revert ZeroAddress();
        if (agentId == 0 || minValidators == 0) revert InvalidConfig();
        if (marketConfigs[market].registered) revert MarketAlreadyRegistered();

        marketConfigs[market] = MarketConfig({
            registered: true,
            agentId: agentId,
            minValidators: minValidators,
            lastAttestation: bytes32(0)
        });

        emit MarketRegistered(market, agentId, minValidators);
    }

    // ============================================
    // Settlement
    // ============================================

    /**
     * @notice Settle a market with TEE attestation
     * @dev Requires valid attestation in Validation Registry
     *
     * @param market The TruthMarket to settle
     * @param outcome The winning outcome (0=NO, 1=YES, 2=INVALID)
     * @param tStar The truth point timestamp
     * @param attestationHash Hash of the TEE attestation
     */
    function settle(
        address market,
        uint8 outcome,
        uint64 tStar,
        bytes32 attestationHash
    ) external override {
        MarketConfig storage config = marketConfigs[market];
        if (!config.registered) revert MarketNotRegistered();
        if (ITruthMarket(market).isSettled()) revert MarketAlreadySettled();

        // Verify attestation in Validation Registry
        (
            address validator,
            uint256 agentId,
            uint8 score,
            ,
            uint256 lastUpdate
        ) = validationRegistry.getValidationStatus(attestationHash);

        // Check attestation exists
        if (validator == address(0)) revert AttestationMissing();

        // Check attestation is for the correct agent
        if (agentId != config.agentId) revert AttestationInvalid();

        // Check attestation score meets minimum
        if (score < minValidationScore) revert AttestationInvalid();

        // Check attestation is recent enough
        if (block.timestamp > lastUpdate + attestationWindow) revert AttestationTooOld();

        // Record attestation hash to prevent replay
        config.lastAttestation = attestationHash;

        // Settle the market via TruthMarket.settle()
        _settleMarket(market, outcome, tStar);

        emit MarketSettled(market, outcome, tStar, attestationHash);
    }

    /**
     * @notice Settle a market with multiple attestations (for high-value markets)
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
    ) external override {
        MarketConfig storage config = marketConfigs[market];
        if (!config.registered) revert MarketNotRegistered();
        if (ITruthMarket(market).isSettled()) revert MarketAlreadySettled();
        if (attestationHashes.length < config.minValidators) revert InsufficientValidators();

        // Verify all attestations
        for (uint256 i = 0; i < attestationHashes.length; ) {
            bytes32 hash = attestationHashes[i];

            (
                address validator,
                uint256 agentId,
                uint8 score,
                ,
                uint256 lastUpdate
            ) = validationRegistry.getValidationStatus(hash);

            if (validator == address(0)) revert AttestationMissing();
            if (agentId != config.agentId) revert AttestationInvalid();
            if (score < minValidationScore) revert AttestationInvalid();
            if (block.timestamp > lastUpdate + attestationWindow) revert AttestationTooOld();

            unchecked { ++i; }
        }

        // Record first attestation hash
        config.lastAttestation = attestationHashes[0];

        // Settle the market via TruthMarket.settle()
        _settleMarket(market, outcome, tStar);

        emit MarketSettled(market, outcome, tStar, attestationHashes[0]);
    }

    // ============================================
    // Internal Functions
    // ============================================

    /**
     * @notice Internal helper to settle market via TruthMarket
     * @param market The market to settle
     * @param outcome The winning outcome
     * @param _tStar The truth point timestamp
     */
    function _settleMarket(address market, uint8 outcome, uint64 _tStar) internal {
        ITruthMarket(market).settle(outcome, _tStar);
    }

    // ============================================
    // View Functions
    // ============================================

    /**
     * @notice Check if a market is registered
     * @param market The market address
     * @return True if registered
     */
    function isMarketRegistered(address market) external view returns (bool) {
        return marketConfigs[market].registered;
    }

    /**
     * @notice Get market configuration
     * @param market The market address
     * @return registered Whether market is registered
     * @return agentId The authorized agent ID
     * @return minValidators Minimum validators required
     * @return lastAttestation Last used attestation hash
     */
    function getMarketConfig(address market) external view returns (
        bool registered,
        uint256 agentId,
        uint256 minValidators,
        bytes32 lastAttestation
    ) {
        MarketConfig memory config = marketConfigs[market];
        return (config.registered, config.agentId, config.minValidators, config.lastAttestation);
    }

    // ============================================
    // IAdjudicator Interface Implementation
    // ============================================

    /**
     * @notice Check if this adjudicator can settle a market
     * @param market The market address
     * @return True if registered and not yet settled
     */
    function canSettle(address market) external view override returns (bool) {
        return marketConfigs[market].registered && !ITruthMarket(market).isSettled();
    }

    /**
     * @notice Returns the adjudicator type
     * @return "tee" for TEE-validated adjudicator
     */
    function adjudicatorType() external pure override returns (string memory) {
        return "tee";
    }

    /**
     * @notice Get minimum validators required for a market
     * @param market The market address
     * @return Number of validators required
     */
    function getMinValidators(address market) external view override returns (uint256) {
        return marketConfigs[market].minValidators;
    }
}
