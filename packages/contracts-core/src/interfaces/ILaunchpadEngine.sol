// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ILaunchpadEngine
 * @notice Interface for Launchpad economics layer with creator deposits and LP tokens
 * @dev V8.2: Supports dual-balance position model (users can hold both YES and NO)
 */
interface ILaunchpadEngine {
    // ============================================
    // Events
    // ============================================

    event MarketCreated(
        address indexed market,
        address indexed creator,
        uint256 initialLiquidity,
        uint256 deposit,
        uint256 lpTokens
    );

    event PositionTraded(
        address indexed trader,
        address indexed market,
        uint8 outcome,
        int256 deltaShares,
        uint256 cost,
        uint256 fee
    );

    event FeeDistributedPreGrad(
        address indexed market,
        uint256 totalFee,
        uint256 toBBase,
        uint256 lpTokensMinted,
        address indexed trader
    );

    event FeeDistributedPostGrad(
        address indexed market,
        uint256 totalFee,
        uint256 toBBase,
        uint256 toLPYield,
        uint256 toProtocol
    );

    event MarketGraduated(
        address indexed market,
        uint256 totalFeesAccrued,
        uint256 timestamp
    );

    event LPRedeemed(
        address indexed user,
        address indexed market,
        uint256 lpAmount,
        uint256 usdcAmount
    );

    event LiquidityIncreased(
        address indexed market,
        address indexed creator,
        uint256 amount,
        uint256 lpTokens
    );

    event LPBalanceUpdated(
        address indexed market,
        address indexed user,
        int256 delta,
        uint256 newBalance,
        uint256 totalSupply
    );

    event LPYieldPoolUpdated(
        address indexed market,
        uint256 amountUsdc,
        uint256 newTotal
    );

    event FeesAccrued(
        address indexed market,
        uint256 amountUsdc,
        uint256 totalAccrued
    );

    event BaseLiquidityIncreased(
        address indexed market,
        uint256 amountWad,
        uint256 newBBase,
        uint256 newBCurrent
    );

    event GraduationProgressUpdated(
        address indexed market,
        uint256 feesAccruedWad,
        uint256 thresholdWad
    );

    event PreGradFeeUpdated(uint16 feeBps);
    event PostGradFeeUpdated(uint16 feeBps);
    event FeeDistributionUpdated(uint16 bBaseBps, uint16 lpYieldBps, uint16 protocolBps);
    event GraduationMultiplierUpdated(uint16 multiplier);

    // V11 Events
    event MarketDismissed(address indexed market, address indexed creator, uint256 timestamp);
    event RefundClaimed(address indexed market, address indexed user, uint256 amount);
    event LPTokenCreated(address indexed market, address indexed lpToken);

    // ============================================
    // Market Creation
    // ============================================

    /**
     * @notice Create a new launchpad market
     * @param question Market question
     * @param startTime Trading start timestamp (0 = now)
     * @param deadline Market deadline
     * @param adjudicator Address that can settle the market
     * @param guardian Address that can veto settlement
     * @param initialLiquidity Liquidity parameter b (WAD)
     * @param adjudicatorAgentId ERC-8004 agent ID for validated adjudicator (0 to skip)
     * @param adjudicatorMinValidators Min validators for validated adjudicator (0 to skip)
     * @return market Address of deployed TruthMarket
     * @return lpTokens Initial LP tokens minted to creator
     */
    function createMarket(
        string calldata question,
        uint64 startTime,
        uint64 deadline,
        address adjudicator,
        address guardian,
        uint256 initialLiquidity,
        uint256 adjudicatorAgentId,
        uint256 adjudicatorMinValidators
    ) external returns (address market, uint256 lpTokens);

    // ============================================
    // Trading
    // ============================================

    /**
     * @notice Trade positions with automatic fee distribution
     * @param market Market address
     * @param outcome 0 = YES, 1 = NO
     * @param deltaShares Position change (positive = buy, negative = sell)
     * @param maxCostOrMinProceeds For buys: max cost (including fees); for sells: min proceeds
     * @return actualCost Actual cost paid (buys) or proceeds received (sells)
     */
    function tradePositions(
        address market,
        uint8 outcome,
        int256 deltaShares,
        uint256 maxCostOrMinProceeds
    ) external returns (uint256 actualCost);

    // ============================================
    // LP Management
    // ============================================

    /**
     * @notice Redeem LP tokens for USDC
     * @param market Market address
     * @param lpAmount LP tokens to redeem (WAD)
     * @return usdcAmount USDC received
     */
    function redeemLP(
        address market,
        uint256 lpAmount
    ) external returns (uint256 usdcAmount);

    // ============================================
    // Creator Functions
    // ============================================

    /**
     * @notice Creator manually increases liquidity
     * @param market Market address
     * @param amount USDC amount to add
     */
    function increaseBBase(
        address market,
        uint256 amount
    ) external;

    // ============================================
    // View Functions
    // ============================================

    /**
     * @notice Get market state
     * @param market Market address
     * @return creator Market creator address
     * @return bBase Initial liquidity (WAD)
     * @return bCurrent Current liquidity (WAD)
     * @return totalLPSupply Total LP tokens minted (WAD)
     * @return isGraduated Whether market has graduated
     * @return floorValue Current floor value (USDC)
     */
    function getMarketState(address market)
        external
        view
        returns (
            address creator,
            uint256 bBase,
            uint256 bCurrent,
            uint256 totalLPSupply,
            bool isGraduated,
            uint256 floorValue
        );

    /**
     * @notice Get graduation progress
     * @param market Market address
     * @return feesAccrued Total fees collected (USDC)
     * @return threshold Graduation threshold (USDC)
     * @return progressBps Progress in basis points (0-10000)
     */
    function getGraduationProgress(address market)
        external
        view
        returns (uint256 feesAccrued, uint256 threshold, uint256 progressBps);

    // ============================================
    // Market Enumeration
    // ============================================

    /**
     * @notice Get all created markets
     * @return Array of market addresses
     */
    function getMarkets() external view returns (address[] memory);

    /**
     * @notice Get total number of markets
     * @return Number of markets created
     */
    function getMarketCount() external view returns (uint256);

    // ============================================
    // V11: Trial Period Functions
    // ============================================

    /**
     * @notice Dismiss a market during trial period (creator only)
     * @param market The market to dismiss
     */
    function dismissMarket(address market) external;

    /**
     * @notice Claim refund after market dismissal
     * @param market The dismissed market
     * @return refundAmount Amount refunded
     */
    function claimRefund(address market) external returns (uint256 refundAmount);

}
