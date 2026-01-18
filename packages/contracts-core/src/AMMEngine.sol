// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAMMEngine} from "./interfaces/IAMMEngine.sol";
import {ITruthMarket} from "./interfaces/ITruthMarket.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {LMSRMath} from "./libraries/LMSRMath.sol";
import {DecimalMath} from "./libraries/DecimalMath.sol";

/**
 * @title AMMEngine
 * @notice LMSR-based AMM with dual-balance position domain, 24h locks, and T* settlement
 * @dev V8.2: Users can hold both YES and NO shares simultaneously
 *      Positions are non-transferable ledger entries
 *      Users manage their own USDC custody (EOA, Safe, smart account, etc.)
 */
contract AMMEngine is IAMMEngine, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================
    // Constants
    // ============================================

    uint256 private constant WAD = 1e18;
    uint64 private constant LOCK_DURATION = 24 hours;

    // ============================================
    // State Variables
    // ============================================

    /// @notice USDC token address
    IERC20 public immutable usdc;
    uint8 private immutable usdcDecimals; // Cached for WAD ↔ token-decimals conversions

    /// @notice Authorized router (LaunchpadEngine) that can trade on behalf of users
    address public router;

    /// @notice Market state
    mapping(address => MarketState) private _markets;

    /// @notice User positions (market => user => Position)
    mapping(address => mapping(address => Position)) private _positions;

    /// @notice User available balances (spendable USDC, includes locked)
    mapping(address => uint256) private _availableBalance;

    /// @notice User locked balances (subset of available, not withdrawable)
    mapping(address => uint256) private _lockedBalance;

    /// @notice Lock queue for tracking individual lock entries
    mapping(address => IAMMEngine.LockEntry[]) private _lockQueue;

    struct MarketState {
        uint256 qYes;           // YES quantity (WAD)
        uint256 qNo;            // NO quantity (WAD)
        uint256 liquidity;      // Liquidity parameter b (WAD)
        bool initialized;
    }

    // ============================================
    // Constructor
    // ============================================

    constructor(address _usdc, address _owner) Ownable(_owner) {
        require(_usdc != address(0), "AMMEngine: zero usdc");
        usdc = IERC20(_usdc);
        usdcDecimals = IERC20Metadata(_usdc).decimals();
    }

    // ============================================
    // Router Configuration
    // ============================================

    function setRouter(address _router) external onlyOwner {
        router = _router;
        emit RouterUpdated(_router);
    }

    modifier onlyRouter() {
        require(msg.sender == router, "AMMEngine: not router");
        _;
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

        emit MarketInitialized(market, initialLiquidity);
    }

    // ============================================
    // Trading
    // ============================================

    /**
     * @inheritdoc IAMMEngine
     */
    function tradePositions(
        address market,
        uint8 outcome,
        int256 deltaShares,
        uint256 maxCostOrMinProceeds
    ) external override returns (uint256 actualCost) {
        return _tradePositions(msg.sender, msg.sender, market, outcome, deltaShares, maxCostOrMinProceeds, 0);
    }

    /**
     * @inheritdoc IAMMEngine
     */
    function tradePositionsFor(
        address user,
        address market,
        uint8 outcome,
        int256 deltaShares,
        uint256 maxCostOrMinProceeds,
        uint256 fee
    ) external override onlyRouter returns (uint256 actualCost) {
        require(user != address(0), "AMMEngine: zero user");
        // Payer is the router (LaunchpadEngine) which has custody of trade USDC (via fee layer).
        return _tradePositions(user, msg.sender, market, outcome, deltaShares, maxCostOrMinProceeds, fee);
    }

    function _tradePositions(
        address user,
        address payer,
        address market,
        uint8 outcome,
        int256 deltaShares,
        uint256 maxCostOrMinProceeds,
        uint256 fee
    ) internal returns (uint256 actualCost) {
        require(deltaShares != 0, "AMMEngine: zero delta");
        require(outcome <= 1, "AMMEngine: invalid outcome");
        require(ITruthMarket(market).isLive(), "AMMEngine: market not live");

        MarketState storage state = _markets[market];
        require(state.initialized, "AMMEngine: not initialized");

        Position storage position = _positions[market][user];

        bool isBuy = deltaShares > 0;
        uint256 absDelta = isBuy ? uint256(deltaShares) : uint256(-deltaShares);

        // Calculate new quantities based on outcome and direction
        uint256 newQYes;
        uint256 newQNo;

        if (outcome == 1) {
            // YES outcome (1 = YES, consistent with TruthMarket)
            if (isBuy) {
                newQYes = state.qYes + absDelta;
                newQNo = state.qNo;
            } else {
                require(position.yesShares >= absDelta, "AMMEngine: insufficient YES shares");
                require(state.qYes >= absDelta, "AMMEngine: insufficient market YES");
                newQYes = state.qYes - absDelta;
                newQNo = state.qNo;
            }
        } else {
            // NO outcome (0 = NO, consistent with TruthMarket)
            if (isBuy) {
                newQYes = state.qYes;
                newQNo = state.qNo + absDelta;
            } else {
                require(position.noShares >= absDelta, "AMMEngine: insufficient NO shares");
                require(state.qNo >= absDelta, "AMMEngine: insufficient market NO");
                newQYes = state.qYes;
                newQNo = state.qNo - absDelta;
            }
        }

        // Calculate cost/proceeds using LMSR
        if (isBuy) {
            // Buying: cost = C(new) - C(old)
            actualCost = LMSRMath.calculateCost(
                state.liquidity,
                state.qYes,
                state.qNo,
                newQYes,
                newQNo
            );

            // Slippage check for buys
            require(actualCost <= maxCostOrMinProceeds, "AMMEngine: cost too high");

            // Pay cost
            if (_availableBalance[user] >= actualCost) {
                // Reduce locked balance proportionally to maintain invariant: locked <= available
                if (_lockedBalance[user] > 0) {
                    uint256 lockedReduction = (actualCost * _lockedBalance[user]) / _availableBalance[user];
                    _lockedBalance[user] -= lockedReduction;
                    if (lockedReduction > 0) {
                        emit LockedBalanceReduced(user, lockedReduction, _lockedBalance[user]);
                    }
                }
                _availableBalance[user] -= actualCost;
                emit BalanceUsed(user, actualCost, _availableBalance[user]);
            } else {
                uint256 fromBalance = _availableBalance[user];
                uint256 fromWallet = actualCost - fromBalance;

                uint256 lockedBefore = _lockedBalance[user];
                _lockedBalance[user] = 0;
                _availableBalance[user] = 0;
                if (lockedBefore > 0) {
                    emit LockedBalanceReduced(user, lockedBefore, 0);
                }
                usdc.safeTransferFrom(payer, address(this), _wadToUsdcCeil(fromWallet));

                if (fromBalance > 0) {
                    emit BalanceUsed(user, fromBalance, 0);
                }
                emit WalletPull(user, fromWallet);
            }

            // Update user position
            if (outcome == 1) {
                position.yesShares += absDelta;
            } else {
                position.noShares += absDelta;
            }
        } else {
            // Selling: proceeds = C(old) - C(new)
            actualCost = LMSRMath.calculateCost(
                state.liquidity,
                newQYes,
                newQNo,
                state.qYes,
                state.qNo
            );

            // Apply fee (Router Only)
            uint256 proceedsToUser = actualCost;
            if (fee > 0) {
                require(fee <= actualCost, "AMMEngine: fee exceeds proceeds");
                proceedsToUser = actualCost - fee;
                // Send fee to payer (Router)
                usdc.safeTransfer(payer, _wadToUsdc(fee));
            }

            // Slippage check for sells (minProceeds)
            if (maxCostOrMinProceeds > 0) {
                require(proceedsToUser >= maxCostOrMinProceeds, "AMMEngine: slippage exceeded");
            }

            // Lock proceeds (24h before withdrawal)
            _availableBalance[user] += uint224(proceedsToUser);
            _lockedBalance[user] += uint224(proceedsToUser);
            
            _lockQueue[user].push(IAMMEngine.LockEntry({
                amount: proceedsToUser,
                expiry: uint64(block.timestamp + LOCK_DURATION),
                market: market
            }));

            emit BalanceCredited(user, proceedsToUser, _availableBalance[user], _lockedBalance[user]);

            // Update user position
            if (outcome == 1) {
                position.yesShares -= absDelta;
            } else {
                position.noShares -= absDelta;
            }

            emit ProceedsLocked(user, market, proceedsToUser, uint64(block.timestamp + LOCK_DURATION));
        }

        // Update market state
        state.qYes = newQYes;
        state.qNo = newQNo;

        emit PositionTraded(
            user,
            market,
            outcome,
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
    function increaseLiquidity(address market, uint256 deltaLiquidity) external override onlyRouter {
        require(deltaLiquidity > 0, "AMMEngine: zero liquidity");
        MarketState storage state = _markets[market];
        require(state.initialized, "AMMEngine: not initialized");
        state.liquidity += deltaLiquidity;
        emit LiquidityIncreased(market, deltaLiquidity, state.liquidity);
    }

    /**
     * @inheritdoc IAMMEngine
     */
    function getPositionQuote(
        address market,
        uint8 outcome,
        int256 deltaShares
    ) external view override returns (uint256 cost, uint256 newPrice) {
        require(outcome <= 1, "AMMEngine: invalid outcome");
        MarketState memory state = _markets[market];
        require(state.initialized, "AMMEngine: not initialized");

        bool isBuy = deltaShares > 0;
        uint256 absDelta = isBuy ? uint256(deltaShares) : uint256(-deltaShares);

        uint256 newQYes;
        uint256 newQNo;

        if (outcome == 1) {
            // YES (1 = YES, consistent with TruthMarket)
            if (isBuy) {
                newQYes = state.qYes + absDelta;
                newQNo = state.qNo;
            } else {
                newQYes = state.qYes > absDelta ? state.qYes - absDelta : 0;
                newQNo = state.qNo;
            }
        } else {
            // NO (0 = NO, consistent with TruthMarket)
            if (isBuy) {
                newQYes = state.qYes;
                newQNo = state.qNo + absDelta;
            } else {
                newQYes = state.qYes;
                newQNo = state.qNo > absDelta ? state.qNo - absDelta : 0;
            }
        }

        if (isBuy) {
            cost = LMSRMath.calculateCost(
                state.liquidity,
                state.qYes,
                state.qNo,
                newQYes,
                newQNo
            );
        } else {
            cost = LMSRMath.calculateCost(
                state.liquidity,
                newQYes,
                newQNo,
                state.qYes,
                state.qNo
            );
        }

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
     * @notice Claim unlocked proceeds (global, not per-market)
     * @param maxClaims Maximum number of lock entries to process (gas limit)
     * @return totalUnlocked Total amount unlocked and transferred
     */
    function claimUnlocked(uint256 maxClaims) external returns (uint256 totalUnlocked) {
        require(maxClaims > 0 && maxClaims <= 50, "AMMEngine: invalid maxClaims");
        
        IAMMEngine.LockEntry[] storage queue = _lockQueue[msg.sender];
        require(queue.length > 0, "AMMEngine: no locks");
        
        uint256 processed = 0;
        uint256 i = 0;
        
        // Iterate through queue, remove expired locks
        while (i < queue.length && processed < maxClaims) {
            if (block.timestamp >= queue[i].expiry) {
                totalUnlocked += queue[i].amount;

                emit LockEntryRemoved(msg.sender, queue[i].market, queue[i].amount, queue[i].expiry);

                queue[i] = queue[queue.length - 1];
                queue.pop();

                processed++;
            } else {
                i++;
            }
        }
        
        require(totalUnlocked > 0, "AMMEngine: no unlocked proceeds");
        
        // Update balances
        _lockedBalance[msg.sender] -= totalUnlocked;
        _availableBalance[msg.sender] -= totalUnlocked;
        
        // Transfer to user
        usdc.safeTransfer(msg.sender, _wadToUsdc(totalUnlocked));
        
        emit ProceedsClaimed(msg.sender, address(0), totalUnlocked);
        emit LocksProcessed(msg.sender, processed, totalUnlocked);
    }

    /**
     * @inheritdoc IAMMEngine
     */
    function getPosition(address market, address user)
        external
        view
        override
        returns (uint256 yesShares, uint256 noShares)
    {
        Position memory position = _positions[market][user];
        return (position.yesShares, position.noShares);
    }

    // ============================================
    // Balance Management (V8.1)
    // ============================================

    /**
     * @notice Get user's available and locked balances
     * @param user User address
     * @return available Total available balance (spendable)
     * @return locked Locked balance (subset of available, not withdrawable)
     */
    function getBalances(address user) 
        external 
        view 
        returns (uint256 available, uint256 locked) 
    {
        return (_availableBalance[user], _lockedBalance[user]);
    }

    /**
     * @notice Spend from user's available balance (router only)
     * @dev Called by LaunchpadEngine to use spendable proceeds for buys
     * @param user User whose balance to spend
     * @param amount Amount to spend (WAD)
     * @return spent Actual amount spent (may be less if balance insufficient)
     */
    function spendBalanceFor(address user, uint256 amount) 
        external 
        override
        onlyRouter
        returns (uint256 spent) 
    {
        uint256 available = _availableBalance[user];
        spent = amount > available ? available : amount;
        
        if (spent > 0) {
            _availableBalance[user] -= spent;
            
            // Also reduce locked balance proportionally (locked is subset of available)
            // This ensures locked <= available invariant holds
            if (_lockedBalance[user] > 0) {
                uint256 lockedReduction = (spent * _lockedBalance[user]) / available;
                _lockedBalance[user] -= lockedReduction;
                if (lockedReduction > 0) {
                    emit LockedBalanceReduced(user, lockedReduction, _lockedBalance[user]);
                }
            }

            emit BalanceUsed(user, spent, _availableBalance[user]);
        }
    }

    /**
     * @notice Get user's lock queue
     * @param user User address
     * @return entries Array of lock entries
     */
    function getLockQueue(address user) 
        external 
        view 
        returns (IAMMEngine.LockEntry[] memory entries)
    {
        return _lockQueue[user];
    }

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
        ) 
    {
        IAMMEngine.LockEntry[] memory queue = _lockQueue[user];
        uint64 earliestLocked = type(uint64).max;
        
        for (uint256 i = 0; i < queue.length; i++) {
            if (block.timestamp >= queue[i].expiry) {
                claimable += queue[i].amount;
            } else if (queue[i].expiry < earliestLocked) {
                earliestLocked = queue[i].expiry;
                nextAmount = queue[i].amount;
            }
        }
        
        nextUnlock = (earliestLocked == type(uint64).max) ? 0 : earliestLocked;
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
     * @dev Handles all three outcomes: YES (1), NO (0), INVALID (2)
     *      INVALID returns 50% of total shares (both YES and NO)
     */
    function settlePosition(address market) external override nonReentrant returns (uint256 payout) {
        require(ITruthMarket(market).isSettled(), "AMMEngine: not settled");

        Position storage position = _positions[market][msg.sender];
        require(position.yesShares > 0 || position.noShares > 0, "AMMEngine: no position");

        ITruthMarket truthMarket = ITruthMarket(market);
        uint8 winningOutcome = truthMarket.winningOutcome();

        uint256 yesShares = position.yesShares;
        uint256 noShares = position.noShares;

        // Clear position first (CEI pattern)
        position.yesShares = 0;
        position.noShares = 0;

        // Calculate payout based on position and outcome
        if (winningOutcome == 1) {
            // YES won: pay full value for YES shares
            payout = yesShares;
        } else if (winningOutcome == 0) {
            // NO won: pay full value for NO shares
            payout = noShares;
        } else {
            // INVALID (2): return 50% of total position value
            // Both YES and NO get 50% redemption value
            payout = (yesShares + noShares) / 2;
        }

        // Transfer USDC payout to user
        if (payout > 0) {
            usdc.safeTransfer(msg.sender, _wadToUsdc(payout));
        }

        emit PositionSettled(msg.sender, market, winningOutcome, yesShares, noShares, payout);
    }

    /// @notice Emitted when a position is settled after market resolution
    event PositionSettled(
        address indexed user,
        address indexed market,
        uint8 winningOutcome,
        uint256 yesShares,
        uint256 noShares,
        uint256 payout
    );

    // V9.9.4: applyRetroSettlement removed - T* not implemented
    // See audit/IMPLEMENTATION_PLAN_V9.9.4.md for archived code


    // ============================================
    // Internal Helpers
    // ============================================

    function _wadToUsdc(uint256 wadAmount) internal view returns (uint256) {
        return DecimalMath.fromWad(wadAmount, usdcDecimals);
    }

    function _wadToUsdcCeil(uint256 wadAmount) internal view returns (uint256) {
        return DecimalMath.fromWadCeil(wadAmount, usdcDecimals);
    }
}
