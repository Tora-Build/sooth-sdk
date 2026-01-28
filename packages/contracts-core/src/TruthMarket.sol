// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ITruthMarket} from "./interfaces/ITruthMarket.sol";
import {IProtocolConfig} from "./interfaces/IProtocolConfig.sol";

/**
 * @title TruthMarket
 * @notice Canonical source of truth for market lifecycle and settlement
 * @dev All execution venues query this contract for market state
 *
 * Lifecycle: LIVE → SETTLING → SETTLED → FINALIZED
 *   - LIVE: Trading active (between startTime and deadline)
 *   - SETTLING: Deadline passed, awaiting adjudicator resolution
 *   - SETTLED: Outcome determined, guardian role can veto
 *   - FINALIZED: Settlement locked, redemption enabled
 */
contract TruthMarket is ITruthMarket {
    // ============================================
    // Constants
    // ============================================

    uint256 private constant WAD = 1e18;

    // ============================================
    // Enums
    // ============================================

    enum MarketState {
        LIVE,       // Trading active
        SETTLING,   // Deadline passed, awaiting resolution
        SETTLED,    // Outcome determined
        FINALIZED   // Settlement complete
    }

    // ============================================
    // State Variables
    // ============================================

    MarketState public state;
    string public override question;
    uint64 public override startTime;
    uint64 public override deadline;
    address public override creator;
    uint8 public override winningOutcome;
    uint64 public override tStar;

    address public adjudicator;
    IProtocolConfig public protocolConfig;

    // ============================================
    // Constructor
    // ============================================

    constructor(
        string memory _question,
        uint64 _startTime,
        uint64 _deadline,
        address _adjudicator,
        address _protocolConfig,
        address _creator
    ) {
        require(_deadline > block.timestamp, "TruthMarket: deadline in past");
        require(_adjudicator != address(0), "TruthMarket: zero adjudicator");
        require(_protocolConfig != address(0), "TruthMarket: zero protocol config");
        require(_creator != address(0), "TruthMarket: zero creator");

        uint64 normalizedStartTime = _startTime == 0 ? uint64(block.timestamp) : _startTime;
        require(normalizedStartTime >= block.timestamp, "TruthMarket: start in past");
        require(normalizedStartTime < _deadline, "TruthMarket: start after deadline");

        question = _question;
        startTime = normalizedStartTime;
        deadline = _deadline;
        creator = _creator;
        adjudicator = _adjudicator;
        protocolConfig = IProtocolConfig(_protocolConfig);
        state = MarketState.LIVE;

        emit MarketCreated(address(this), _question, normalizedStartTime, _deadline);
    }

    // ============================================
    // Lifecycle Management
    // ============================================


    /**
     * @notice Settle market with outcome
     * @param outcome Winning outcome (0=NO, 1=YES, 2=INVALID)
     * @param _tStar Retroactive truth-time (0 if not applicable)
     */
    function settle(uint8 outcome, uint64 _tStar) external {
        require(msg.sender == adjudicator, "TruthMarket: not adjudicator");
        require(block.timestamp >= startTime, "TruthMarket: before start");
        require(state == MarketState.LIVE || state == MarketState.SETTLING, "TruthMarket: not live");
        require(outcome <= 2, "TruthMarket: invalid outcome");
        
        if (_tStar > 0) {
            require(_tStar <= block.timestamp, "TruthMarket: tStar in future");
            require(_tStar <= deadline, "TruthMarket: tStar after deadline");
        }

        winningOutcome = outcome;
        tStar = _tStar;
        state = MarketState.SETTLED;

        emit MarketSettled(address(this), outcome, _tStar);
    }

    /**
     * @notice Finalize settlement (irreversible)
     */
    function finalize() external {
        require(msg.sender == adjudicator, "TruthMarket: not adjudicator");
        require(state == MarketState.SETTLED, "TruthMarket: not settled");

        state = MarketState.FINALIZED;
        emit MarketFinalized(address(this));
    }

    /**
     * @notice Guardian veto (emergency only)
     * @dev Reverts market to SETTLING state for re-adjudication
     */
    function veto() external {
        require(protocolConfig.isGuardian(msg.sender), "TruthMarket: not guardian");
        require(state == MarketState.SETTLED, "TruthMarket: not settled");

        uint8 previousOutcome = winningOutcome;
        uint64 previousTStar = tStar;

        state = MarketState.SETTLING;
        winningOutcome = 0;
        tStar = 0;

        emit MarketVetoed(address(this), previousOutcome, previousTStar);
    }

    // ============================================
    // Lifecycle Queries
    // ============================================

    /**
     * @inheritdoc ITruthMarket
     * @dev Market is live if in LIVE state AND before deadline.
     *      After deadline, trading should stop even if settle() hasn't been called yet.
     */
    function isLive() external view override returns (bool) {
        return state == MarketState.LIVE && block.timestamp >= startTime && block.timestamp < deadline;
    }

    /**
     * @notice Check if market is awaiting settlement (past deadline, not yet settled)
     * @return True if market is in settling period
     */
    function isSettling() external view returns (bool) {
        return (state == MarketState.LIVE && block.timestamp >= deadline) ||
               state == MarketState.SETTLING;
    }

    /**
     * @inheritdoc ITruthMarket
     */
    function isSettled() external view override returns (bool) {
        return state == MarketState.SETTLED || state == MarketState.FINALIZED;
    }

    /**
     * @notice Check if market is fully finalized (irreversible)
     * @return True if market is finalized
     */
    function isFinalized() external view override returns (bool) {
        return state == MarketState.FINALIZED;
    }

    // ============================================
    // Redemption Logic
    // ============================================

    /**
     * @inheritdoc ITruthMarket
     */
    function getRedemptionValue(uint8 outcome) external view override returns (uint256) {
        require(state == MarketState.SETTLED || state == MarketState.FINALIZED, "TruthMarket: not settled");
        require(outcome <= 1, "TruthMarket: invalid outcome");

        // Binary outcomes
        if (winningOutcome == 0) {
            // NO won
            return outcome == 0 ? WAD : 0;
        } else if (winningOutcome == 1) {
            // YES won
            return outcome == 1 ? WAD : 0;
        } else {
            // INVALID - return 50/50
            return WAD / 2;
        }
    }
}
