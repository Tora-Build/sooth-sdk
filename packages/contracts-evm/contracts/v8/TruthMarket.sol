// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ITruthMarket} from "../interfaces/v8/ITruthMarket.sol";

/**
 * @title TruthMarket
 * @notice Canonical source of truth for market lifecycle and settlement
 * @dev All execution venues query this contract for market state
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
        CREATED,    // Market created but not live
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
    uint64 public override deadline;
    address public override creator;
    uint8 public override winningOutcome;
    uint64 public override tStar;

    address public adjudicator;
    address public guardian;

    // ============================================
    // Constructor
    // ============================================

    constructor(
        string memory _question,
        uint64 _deadline,
        address _adjudicator,
        address _guardian
    ) {
        require(_deadline > block.timestamp, "TruthMarket: deadline in past");
        require(_adjudicator != address(0), "TruthMarket: zero adjudicator");
        require(_guardian != address(0), "TruthMarket: zero guardian");

        question = _question;
        deadline = _deadline;
        creator = msg.sender;
        adjudicator = _adjudicator;
        guardian = _guardian;
        state = MarketState.CREATED;
    }

    // ============================================
    // Lifecycle Management
    // ============================================

    /**
     * @notice Activate market for trading
     * @dev Only creator can activate
     */
    function activate() external {
        require(msg.sender == creator, "TruthMarket: not creator");
        require(state == MarketState.CREATED, "TruthMarket: not created");
        require(block.timestamp < deadline, "TruthMarket: past deadline");

        state = MarketState.LIVE;
    }

    /**
     * @notice Settle market with outcome
     * @param outcome Winning outcome (0=NO, 1=YES, 2=INVALID)
     * @param _tStar Retroactive truth-time (0 if not applicable)
     */
    function settle(uint8 outcome, uint64 _tStar) external {
        require(msg.sender == adjudicator, "TruthMarket: not adjudicator");
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
        require(msg.sender == adjudicator || msg.sender == guardian, "TruthMarket: not authorized");
        require(state == MarketState.SETTLED, "TruthMarket: not settled");

        state = MarketState.FINALIZED;
        emit MarketFinalized(address(this));
    }

    /**
     * @notice Guardian veto (emergency only)
     * @dev Reverts market to SETTLING state
     */
    function veto() external {
        require(msg.sender == guardian, "TruthMarket: not guardian");
        require(state == MarketState.SETTLED, "TruthMarket: not settled");

        state = MarketState.SETTLING;
        winningOutcome = 0;
        tStar = 0;
    }

    // ============================================
    // Lifecycle Queries
    // ============================================

    /**
     * @inheritdoc ITruthMarket
     */
    function isLive() external view override returns (bool) {
        return state == MarketState.LIVE;
    }

    /**
     * @inheritdoc ITruthMarket
     */
    function isSettled() external view override returns (bool) {
        return state == MarketState.SETTLED || state == MarketState.FINALIZED;
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
