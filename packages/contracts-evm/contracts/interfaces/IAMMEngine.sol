// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IAMMEngine
 * @notice Interface for LMSR-based AMM with dual-balance position domain
 * @dev Positions are non-transferable ledger entries with 24h locks and T* settlement
 *      V8.2: Users can hold both YES and NO shares simultaneously
 */
interface IAMMEngine {
    // ============================================
    // Events
    // ============================================

    event PositionTraded(
        address indexed user,
        address indexed market,
        uint8 outcome,         // 0 = NO, 1 = YES (consistent with TruthMarket)
        int256 deltaShares,    // positive = buy, negative = sell
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

    event BalanceUsed(
        address indexed user,
        uint256 amount,
        uint256 remaining
    );

    event WalletPull(
        address indexed user,
        uint256 amount
    );

    event LocksProcessed(
        address indexed user,
        uint256 count,
        uint256 totalUnlocked
    );

    /// @notice Router (e.g. LaunchpadEngine) authorized to trade on behalf of users
    event RouterUpdated(address indexed router);

    /// @notice Market liquidity (b) updated (WAD)
    event LiquidityIncreased(address indexed market, uint256 deltaLiquidity, uint256 newLiquidity);

    // ============================================
    // Structs
    // ============================================

    /// @notice User position with separate YES and NO balances
    struct Position {
        uint256 yesShares;    // YES shares held (WAD)
        uint256 noShares;     // NO shares held (WAD)
    }

    struct LockEntry {
        uint256 amount;     // Locked amount (WAD)
        uint64 expiry;      // Unlock timestamp
        address market;     // Market that generated this lock
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
     * @param market Market address
     * @param outcome 0 = NO, 1 = YES (consistent with TruthMarket)
     * @param deltaShares Share delta in WAD (positive = buy, negative = sell)
     * @param maxCostOrMinProceeds For buys: max cost; for sells: min proceeds (slippage)
     * @return actualCost Actual USDC spent (buys) or received (sells)
     */
    function tradePositions(
        address market,
        uint8 outcome,
        int256 deltaShares,
        uint256 maxCostOrMinProceeds
    ) external returns (uint256 actualCost);

    /**
     * @notice Execute trade on behalf of a user (router-only)
     * @dev Used by LaunchpadEngine so AMM positions + balances are attributed to the trader,
     *      while USDC can still be routed through the LaunchpadEngine economics layer.
     * @param user Trader whose position/balances are affected
     * @param market Market address
     * @param outcome 0 = NO, 1 = YES (consistent with TruthMarket)
     * @param deltaShares Share delta in WAD (positive = buy, negative = sell)
     * @param maxCostOrMinProceeds For buys: max cost; for sells: min proceeds
     */
    function tradePositionsFor(
        address user,
        address market,
        uint8 outcome,
        int256 deltaShares,
        uint256 maxCostOrMinProceeds,
        uint256 fee
    ) external returns (uint256 actualCost);

    /**
     * @notice Increase market liquidity parameter b (WAD)
     * @dev Router-only. LaunchpadEngine calls this when fees are reinvested into depth.
     */
    function increaseLiquidity(address market, uint256 deltaLiquidity) external;

    /**
     * @notice Set router address
     * @dev Owner-only
     */
    function setRouter(address router) external;

    /**
     * @notice Current router address
     */
    function router() external view returns (address);

    /**
     * @notice Get quote for position trade (view-only)
     * @param market Market address
     * @param outcome 0 = NO, 1 = YES (consistent with TruthMarket)
     * @param deltaShares Share delta in WAD (positive = buy, negative = sell)
     * @return cost Estimated cost/proceeds in USDC (WAD)
     * @return newPrice New YES probability after trade
     */
    function getPositionQuote(
        address market,
        uint8 outcome,
        int256 deltaShares
    ) external view returns (uint256 cost, uint256 newPrice);

    // ============================================
    // Position Management
    // ============================================

    /**
     * @notice Get user's position (both YES and NO balances)
     * @param market Market address
     * @param user User address
     * @return yesShares YES shares held (WAD)
     * @return noShares NO shares held (WAD)
     */
    function getPosition(address market, address user)
        external
        view
        returns (uint256 yesShares, uint256 noShares);

    // ============================================
    // Balance Management (V8.1)
    // ============================================

    /**
     * @notice Claim unlocked proceeds (global, not per-market)
     * @param maxClaims Maximum number of lock entries to process (gas limit)
     * @return totalUnlocked Total amount unlocked and transferred
     */
    function claimUnlocked(uint256 maxClaims) external returns (uint256 totalUnlocked);

    /**
     * @notice Get user's available and locked balances
     * @param user User address
     * @return available Total available balance (spendable)
     * @return locked Locked balance (subset of available, not withdrawable)
     */
    function getBalances(address user) 
        external 
        view 
        returns (uint256 available, uint256 locked);

    /**
     * @notice Get user's lock queue
     * @param user User address
     * @return entries Array of lock entries
     */
    function getLockQueue(address user) 
        external 
        view 
        returns (LockEntry[] memory entries);

    /**
     * @notice Spend from user's available balance (router only)
     * @dev Called by LaunchpadEngine to use spendable proceeds for buys
     * @param user User whose balance to spend
     * @param amount Amount to spend (WAD)
     * @return spent Actual amount spent (may be less if balance insufficient)
     */
    function spendBalanceFor(address user, uint256 amount) 
        external 
        returns (uint256 spent);

    /**
     * @notice Calculate currently claimable amount
     * @param user User address
     * @return claimable Amount that can be claimed now
     * @return nextUnlock Timestamp of next unlock (0 if none)
     * @return nextAmount Amount of next unlock (0 if none)
     */
    function getClaimableAmount(address user) 
        external 
        view 
        returns (
            uint256 claimable, 
            uint64 nextUnlock, 
            uint256 nextAmount
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
