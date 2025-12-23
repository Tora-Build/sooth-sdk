// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAMMEngine
 * @notice Interface for LMSR-based AMM with position domain
 * @dev Positions are non-transferable ledger entries with 24h locks and T* settlement
 */
interface IAMMEngine {
    // ============================================
    // Events
    // ============================================

    event PositionTraded(
        address indexed user,
        address indexed market,
        int256 deltaShares,
        uint256 cost,
        uint256 newQYes,
        uint256 newQNo
    );

    event ProceedsLocked(
        address indexed user,
        address indexed market,
        uint256 amount,
        uint64 unlockTime
    );

    event ProceedsClaimed(
        address indexed user,
        address indexed market,
        uint256 amount
    );

    // ============================================
    // Structs
    // ============================================

    struct Position {
        int256 shares;           // Signed shares (positive = YES, negative = NO)
        uint256 lockedProceeds;  // USDC locked from sells
        uint64 lockExpiry;       // Timestamp when proceeds unlock
    }

    // ============================================
    // Market Initialization
    // ============================================

    /**
     * @notice Initialize market with liquidity
     * @param market Market address
     * @param initialLiquidity Liquidity parameter b (WAD)
     */
    function initializeMarket(address market, uint256 initialLiquidity) external;

    // ============================================
    // Trading
    // ============================================

    /**
     * @notice Execute trade in position domain
     * @dev Positive deltaShares = buy YES, negative = sell YES
     * @param market Market address
     * @param deltaShares Share delta in WAD (1e18 = 1 share)
     * @param maxCost Maximum USDC to spend (WAD precision)
     * @return actualCost Actual USDC spent/received
     */
    function tradePositions(
        address market,
        int256 deltaShares,
        uint256 maxCost
    ) external returns (uint256 actualCost);

    /**
     * @notice Get quote for position trade (view-only)
     * @param market Market address
     * @param deltaShares Share delta in WAD
     * @return cost Estimated cost in USDC (WAD)
     * @return newPrice New YES probability after trade
     */
    function getPositionQuote(
        address market,
        int256 deltaShares
    ) external view returns (uint256 cost, uint256 newPrice);

    // ============================================
    // Position Management
    // ============================================

    /**
     * @notice Claim unlocked sell proceeds
     * @dev Only callable after lock expiry
     * @param market Market address
     * @return amount USDC claimed
     */
    function claimUnlocked(address market) external returns (uint256 amount);

    /**
     * @notice Get user's position and lock status
     * @param market Market address
     * @param user User address
     * @return shares Current position (WAD)
     * @return lockedProceeds Locked USDC from sells (WAD)
     * @return lockExpiry Timestamp when proceeds unlock
     */
    function getPosition(address market, address user)
        external
        view
        returns (
            int256 shares,
            uint256 lockedProceeds,
            uint64 lockExpiry
        );

    // ============================================
    // Market State
    // ============================================

    /**
     * @notice Get current LMSR state
     * @param market Market address
     * @return qYes YES quantity in WAD
     * @return qNo NO quantity in WAD
     * @return price Current YES probability (WAD, 0-1e18)
     */
    function getMarketState(address market)
        external
        view
        returns (
            uint256 qYes,
            uint256 qNo,
            uint256 price
        );

    /**
     * @notice Get liquidity parameter (b)
     * @param market Market address
     * @return Liquidity parameter in WAD
     */
    function getLiquidity(address market) external view returns (uint256);

    // ============================================
    // Settlement
    // ============================================

    /**
     * @notice Settle position after market resolution
     * @dev Converts position to USDC based on outcome
     * @param market Market address
     * @return payout USDC payout (WAD)
     */
    function settlePosition(address market) external returns (uint256 payout);

    /**
     * @notice Apply retroactive settlement (T*)
     * @dev Only callable by authorized adjudicator
     * @param market Market address
     * @param user User address
     * @param proof Merkle proof for T* adjustment
     * @return refund USDC refund amount
     */
    function applyRetroSettlement(
        address market,
        address user,
        bytes calldata proof
    ) external returns (uint256 refund);
}
