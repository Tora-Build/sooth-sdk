// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITruthMarket
 * @notice Minimal interface for market lifecycle and settlement
 * @dev This interface defines the canonical source of truth for market state.
 *      All execution venues (AMM, TickBook) query this interface to gate trading.
 */
interface ITruthMarket {
    // ============================================
    // Events
    // ============================================

    event MarketCreated(address indexed market, string question, uint64 deadline);
    event MarketSettled(address indexed market, uint8 outcome, uint64 tStar);
    event MarketFinalized(address indexed market);
    event MarketVetoed(address indexed market, uint8 previousOutcome, uint64 previousTStar);

    // ============================================
    // Lifecycle State
    // ============================================

    /**
     * @notice Check if market is accepting trades
     * @dev Returns true if market is in LIVE state (before settlement)
     * @return True if trading is allowed
     */
    function isLive() external view returns (bool);

    /**
     * @notice Check if market has been settled
     * @dev Returns true if adjudicator has finalized the outcome
     * @return True if market is settled
     */
    function isSettled() external view returns (bool);

    /**
     * @notice Get winning outcome
     * @dev 0 = NO, 1 = YES, 2 = INVALID
     * @return Winning outcome index
     */
    function winningOutcome() external view returns (uint8);

    /**
     * @notice Get retroactive truth-time (T*)
     * @dev Returns the timestamp when the outcome became true.
     *      Returns 0 if no retroactive settlement applies.
     * @return Unix timestamp of truth-time
     */
    function tStar() external view returns (uint64);

    // ============================================
    // Redemption Logic
    // ============================================

    /**
     * @notice Get redemption value per token (WAD precision)
     * @dev For binary markets: returns 1e18 for winning outcome, 0 for losing
     *      For INVALID markets: may return fractional values
     * @param outcome Outcome index (0=NO, 1=YES)
     * @return Redemption value in WAD (1e18 = 1 USDC)
     */
    function getRedemptionValue(uint8 outcome) external view returns (uint256);

    // ============================================
    // Market Metadata
    // ============================================

    /**
     * @notice Get market question
     * @return Market question string
     */
    function question() external view returns (string memory);

    /**
     * @notice Get market deadline
     * @return Unix timestamp of market deadline
     */
    function deadline() external view returns (uint64);

    /**
     * @notice Get market creator
     * @return Address of market creator
     */
    function creator() external view returns (address);
}
