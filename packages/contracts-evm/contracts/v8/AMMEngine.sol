// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAMMEngine} from "../interfaces/v8/IAMMEngine.sol";
import {ITruthMarket} from "../interfaces/v8/ITruthMarket.sol";
import {ITraderVaultLite} from "../interfaces/v8/ITraderVaultLite.sol";
import {LMSRMath} from "./libraries/LMSRMath.sol";

/**
 * @title AMMEngine
 * @notice LMSR-based AMM with position domain, 24h locks, and T* settlement
 * @dev Positions are non-transferable ledger entries
 */
contract AMMEngine is IAMMEngine {
    // ============================================
    // Constants
    // ============================================

    uint256 private constant WAD = 1e18;
    uint64 private constant LOCK_DURATION = 24 hours;

    // ============================================
    // State Variables
    // ============================================

    /// @notice Trader vault for USDC custody
    ITraderVaultLite public immutable traderVault;

    /// @notice Market state
    mapping(address => MarketState) private _markets;

    /// @notice User positions
    mapping(address => mapping(address => Position)) private _positions;

    struct MarketState {
        uint256 qYes;           // YES quantity (WAD)
        uint256 qNo;            // NO quantity (WAD)
        uint256 liquidity;      // Liquidity parameter b (WAD)
        bool initialized;
    }

    // ============================================
    // Constructor
    // ============================================

    constructor(address _traderVault) {
        require(_traderVault != address(0), "AMMEngine: zero vault");
        traderVault = ITraderVaultLite(_traderVault);
    }

    // ============================================
    // Market Initialization
    // ============================================

    /**
     * @notice Initialize market with liquidity
     * @param market Market address
     * @param initialLiquidity Liquidity parameter b (WAD)
     */
    function initializeMarket(address market, uint256 initialLiquidity) external {
        require(market != address(0), "AMMEngine: zero market");
        require(initialLiquidity > 0, "AMMEngine: zero liquidity");
        require(!_markets[market].initialized, "AMMEngine: already initialized");

        // Initialize at 50/50 probability
        _markets[market] = MarketState({
            qYes: 0,
            qNo: 0,
            liquidity: initialLiquidity,
            initialized: true
        });
    }

    // ============================================
    // Trading
    // ============================================

    /**
     * @inheritdoc IAMMEngine
     */
    function tradePositions(
        address market,
        int256 deltaShares,
        uint256 maxCost
    ) external override returns (uint256 actualCost) {
        require(deltaShares != 0, "AMMEngine: zero delta");
        require(ITruthMarket(market).isLive(), "AMMEngine: market not live");

        MarketState storage state = _markets[market];
        require(state.initialized, "AMMEngine: not initialized");

        Position storage position = _positions[market][msg.sender];

        // Calculate new quantities
        (uint256 newQYes, uint256 newQNo) = LMSRMath.calculateNewQuantities(
            state.qYes,
            state.qNo,
            deltaShares
        );

        // Calculate cost
        actualCost = LMSRMath.calculateCost(
            state.liquidity,
            state.qYes,
            state.qNo,
            newQYes,
            newQNo
        );

        if (deltaShares > 0) {
            // Buying YES
            require(actualCost <= maxCost, "AMMEngine: cost too high");
            
            // Deduct USDC from vault
            // Note: In production, vault would have a debit() function
            // For now, we assume vault integration
            
            // Update position
            position.shares += deltaShares;
        } else {
            // Selling YES (buying NO)
            require(position.shares >= -deltaShares, "AMMEngine: insufficient shares");
            
            // Lock proceeds for 24h
            position.lockedProceeds += actualCost;
            position.lockExpiry = uint64(block.timestamp + LOCK_DURATION);
            
            // Update position
            position.shares += deltaShares; // deltaShares is negative
            
            emit ProceedsLocked(msg.sender, market, actualCost, position.lockExpiry);
        }

        // Update market state
        state.qYes = newQYes;
        state.qNo = newQNo;

        emit PositionTraded(
            msg.sender,
            market,
            deltaShares,
            actualCost,
            newQYes,
            newQNo
        );

        return actualCost;
    }

    /**
     * @inheritdoc IAMMEngine
     */
    function getPositionQuote(
        address market,
        int256 deltaShares
    ) external view override returns (uint256 cost, uint256 newPrice) {
        MarketState memory state = _markets[market];
        require(state.initialized, "AMMEngine: not initialized");

        (uint256 newQYes, uint256 newQNo) = LMSRMath.calculateNewQuantities(
            state.qYes,
            state.qNo,
            deltaShares
        );

        cost = LMSRMath.calculateCost(
            state.liquidity,
            state.qYes,
            state.qNo,
            newQYes,
            newQNo
        );

        newPrice = LMSRMath.calculateProbability(
            state.liquidity,
            newQYes,
            newQNo
        );
    }

    // ============================================
    // Position Management
    // ============================================

    /**
     * @inheritdoc IAMMEngine
     */
    function claimUnlocked(address market) external override returns (uint256 amount) {
        Position storage position = _positions[market][msg.sender];
        
        require(position.lockedProceeds > 0, "AMMEngine: no locked proceeds");
        require(block.timestamp >= position.lockExpiry, "AMMEngine: still locked");

        amount = position.lockedProceeds;
        position.lockedProceeds = 0;

        // Credit USDC to vault
        // Note: In production, vault would have a credit() function

        emit ProceedsClaimed(msg.sender, market, amount);
    }

    /**
     * @inheritdoc IAMMEngine
     */
    function getPosition(address market, address user)
        external
        view
        override
        returns (
            int256 shares,
            uint256 lockedProceeds,
            uint64 lockExpiry
        )
    {
        Position memory position = _positions[market][user];
        return (position.shares, position.lockedProceeds, position.lockExpiry);
    }

    // ============================================
    // Market State
    // ============================================

    /**
     * @inheritdoc IAMMEngine
     */
    function getMarketState(address market)
        external
        view
        override
        returns (
            uint256 qYes,
            uint256 qNo,
            uint256 price
        )
    {
        MarketState memory state = _markets[market];
        require(state.initialized, "AMMEngine: not initialized");

        qYes = state.qYes;
        qNo = state.qNo;
        price = LMSRMath.calculateProbability(state.liquidity, qYes, qNo);
    }

    /**
     * @inheritdoc IAMMEngine
     */
    function getLiquidity(address market) external view override returns (uint256) {
        return _markets[market].liquidity;
    }

    // ============================================
    // Settlement
    // ============================================

    /**
     * @inheritdoc IAMMEngine
     */
    function settlePosition(address market) external override returns (uint256 payout) {
        require(ITruthMarket(market).isSettled(), "AMMEngine: not settled");

        Position storage position = _positions[market][msg.sender];
        require(position.shares != 0, "AMMEngine: no position");

        ITruthMarket truthMarket = ITruthMarket(market);
        uint8 winningOutcome = truthMarket.winningOutcome();

        // Calculate payout based on position and outcome
        if (winningOutcome == 1 && position.shares > 0) {
            // YES won, user has YES shares
            payout = uint256(position.shares);
        } else if (winningOutcome == 0 && position.shares < 0) {
            // NO won, user has NO shares (negative YES)
            payout = uint256(-position.shares);
        } else {
            // User lost
            payout = 0;
        }

        // Clear position
        position.shares = 0;

        // Credit USDC to vault
        // Note: In production, vault would have a credit() function
    }

    /**
     * @inheritdoc IAMMEngine
     */
    function applyRetroSettlement(
        address market,
        address user,
        bytes calldata proof
    ) external override returns (uint256 refund) {
        // T* settlement logic would go here
        // This requires Merkle proof verification and state reconstruction
        // Placeholder for now
        revert("AMMEngine: T* not implemented");
    }
}
