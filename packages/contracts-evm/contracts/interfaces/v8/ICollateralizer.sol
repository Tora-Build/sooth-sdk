// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ICollateralizer
 * @notice Interface for outcome token custody and split/merge operations
 * @dev Manages ERC20 outcome tokens for the TickBook domain
 */
interface ICollateralizer {
    // ============================================
    // Events
    // ============================================

    event Split(
        address indexed user,
        address indexed market,
        uint256 usdcAmount,
        uint256 tokensMinted
    );

    event Merged(
        address indexed user,
        address indexed market,
        uint256 tokenAmount,
        uint256 usdcReturned
    );

    event Redeemed(
        address indexed user,
        address indexed market,
        uint8 outcome,
        uint256 tokenAmount,
        uint256 usdcPayout
    );

    // ============================================
    // Split/Merge Operations
    // ============================================

    /**
     * @notice Split USDC into YES+NO tokens
     * @dev Mints equal amounts of YES and NO outcome tokens
     *      1 USDC → 1 YES + 1 NO (WAD precision)
     * @param market Market address
     * @param amount USDC amount to split (WAD)
     */
    function split(address market, uint256 amount) external;

    /**
     * @notice Merge YES+NO tokens back to USDC
     * @dev Burns equal amounts of YES and NO tokens
     *      1 YES + 1 NO → 1 USDC
     * @param market Market address
     * @param amount Token amount to merge (must have equal YES+NO, WAD)
     */
    function merge(address market, uint256 amount) external;

    // ============================================
    // Redemption (Post-Settlement)
    // ============================================

    /**
     * @notice Redeem winning tokens for USDC post-settlement
     * @dev Converts outcome tokens to USDC based on ITruthMarket.getRedemptionValue()
     *      For binary markets: 1 winning token → 1 USDC
     *      For INVALID markets: may return fractional USDC
     * @param market Market address
     * @param amount Token amount to redeem (WAD)
     * @return usdcAmount USDC received (WAD)
     */
    function redeem(address market, uint256 amount)
        external
        returns (uint256 usdcAmount);

    /**
     * @notice Redeem specific outcome tokens
     * @dev Allows redeeming YES or NO tokens separately
     * @param market Market address
     * @param outcome Outcome to redeem (0=NO, 1=YES)
     * @param amount Token amount to redeem (WAD)
     * @return usdcAmount USDC received (WAD)
     */
    function redeemOutcome(
        address market,
        uint8 outcome,
        uint256 amount
    ) external returns (uint256 usdcAmount);

    // ============================================
    // Token Management
    // ============================================

    /**
     * @notice Get outcome token addresses for market
     * @param market Market address
     * @return yesToken YES token address
     * @return noToken NO token address
     */
    function getOutcomeTokens(address market)
        external
        view
        returns (address yesToken, address noToken);

    /**
     * @notice Get user's token balances
     * @param market Market address
     * @param user User address
     * @return yesBalance YES token balance (WAD)
     * @return noBalance NO token balance (WAD)
     */
    function getBalances(address market, address user)
        external
        view
        returns (uint256 yesBalance, uint256 noBalance);

    // ============================================
    // Collateral Tracking
    // ============================================

    /**
     * @notice Get total USDC collateral for market
     * @dev Should equal totalSupply(YES) == totalSupply(NO)
     * @param market Market address
     * @return Total USDC backing (WAD)
     */
    function getTotalCollateral(address market)
        external
        view
        returns (uint256);

    /**
     * @notice Check if market is settled
     * @dev Queries ITruthMarket.isSettled()
     * @param market Market address
     * @return True if market is settled
     */
    function isMarketSettled(address market) external view returns (bool);

    /**
     * @notice Get redemption value for outcome
     * @dev Queries ITruthMarket.getRedemptionValue()
     * @param market Market address
     * @param outcome Outcome index (0=NO, 1=YES)
     * @return Redemption value in WAD (1e18 = 1 USDC)
     */
    function getRedemptionValue(address market, uint8 outcome)
        external
        view
        returns (uint256);

    // ============================================
    // Market Registration
    // ============================================

    /**
     * @notice Register market and deploy outcome tokens
     * @dev Creates ERC20 YES and NO tokens for the market
     * @param market Market address (must implement ITruthMarket)
     * @param name Token name prefix (e.g., "Sooth Market #123")
     * @param symbol Token symbol prefix (e.g., "SOOTH-123")
     * @return yesToken Deployed YES token address
     * @return noToken Deployed NO token address
     */
    function registerMarket(
        address market,
        string calldata name,
        string calldata symbol
    ) external returns (address yesToken, address noToken);

    /**
     * @notice Check if market is registered
     * @param market Market address
     * @return True if market has outcome tokens deployed
     */
    function isMarketRegistered(address market) external view returns (bool);
}
