// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IAMMEngine} from "./interfaces/IAMMEngine.sol";
import {ITruthMarket} from "./interfaces/ITruthMarket.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {LMSRMath} from "./libraries/LMSRMath.sol";

/**
 * @title AMMEngine
 * @notice LMSR-based AMM with position domain, 24h locks, and T* settlement
 * @dev Positions are non-transferable ledger entries
 *      Users manage their own USDC custody (EOA, Safe, smart account, etc.)
 */
contract AMMEngine is IAMMEngine, Ownable {
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

    /// @notice User positions
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
        return _tradePositions(msg.sender, msg.sender, market, deltaShares, maxCost);
    }

    /**
     * @inheritdoc IAMMEngine
     */
    function tradePositionsFor(
        address user,
        address market,
        int256 deltaShares,
        uint256 maxCost
    ) external override onlyRouter returns (uint256 actualCost) {
        require(user != address(0), "AMMEngine: zero user");
        // Payer is the router (LaunchpadEngine) which has custody of trade USDC (via fee layer).
        return _tradePositions(user, msg.sender, market, deltaShares, maxCost);
    }

    function _tradePositions(
        address user,
        address payer,
        address market,
        int256 deltaShares,
        uint256 maxCost
    ) internal returns (uint256 actualCost) {
        require(deltaShares != 0, "AMMEngine: zero delta");
        require(ITruthMarket(market).isLive(), "AMMEngine: market not live");

        MarketState storage state = _markets[market];
        require(state.initialized, "AMMEngine: not initialized");

        Position storage position = _positions[market][user];

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

        // NOTE: V8.1 position model uses a single signed "YES exposure" number:
        //   +shares = long YES
        //   -shares = long NO (short YES)
        //
        // For UX symmetry we support "sell" for both sides:
        //   - If user is long YES (position > 0) and deltaShares < 0, that's a YES sell (close YES) → proceeds locked.
        //   - If user is long NO  (position < 0) and deltaShares > 0, that's a NO sell (close NO)  → proceeds locked.
        // Otherwise it's an "open / increase exposure" trade → pay cost.

        bool isClosingYes = (deltaShares < 0) && (position.shares > 0);
        bool isClosingNo = (deltaShares > 0) && (position.shares < 0);

        if (isClosingYes || isClosingNo) {
            // Closing position → lock proceeds
            if (isClosingYes) {
                require(position.shares >= -deltaShares, "AMMEngine: insufficient shares");
            } else {
                require(uint256(-position.shares) >= uint256(deltaShares), "AMMEngine: insufficient shares");
            }

            // For closes, interpret maxCost as a *minimum proceeds* (slippage protection)
            if (maxCost > 0) {
                require(actualCost >= maxCost, "AMMEngine: slippage exceeded");
            }

            _availableBalance[user] += actualCost;
            _lockedBalance[user] += actualCost;

            _lockQueue[user].push(IAMMEngine.LockEntry({
                amount: actualCost,
                expiry: uint64(block.timestamp + LOCK_DURATION),
                market: market
            }));

            position.shares += deltaShares;
            emit ProceedsLocked(user, market, actualCost, uint64(block.timestamp + LOCK_DURATION));
        } else {
            // Opening / increasing exposure → pay cost
            require(actualCost <= maxCost, "AMMEngine: cost too high");

            if (_availableBalance[user] >= actualCost) {
                _availableBalance[user] -= actualCost;
                emit BalanceUsed(user, actualCost, _availableBalance[user]);
            } else {
                uint256 fromBalance = _availableBalance[user];
                uint256 fromWallet = actualCost - fromBalance;

                _availableBalance[user] = 0;
                usdc.safeTransferFrom(payer, address(this), _wadToUsdcCeil(fromWallet));

                if (fromBalance > 0) {
                    emit BalanceUsed(user, fromBalance, 0);
                }
                emit WalletPull(user, fromWallet);
            }

            position.shares += deltaShares;
        }

        // Update market state
        state.qYes = newQYes;
        state.qNo = newQNo;

        emit PositionTraded(
            user,
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
                
                // Remove entry (swap with last, pop)
                queue[i] = queue[queue.length - 1];
                queue.pop();
                
                processed++;
                // Don't increment i (we just swapped in a new entry)
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
        returns (int256 shares)
    {
        Position memory position = _positions[market][user];
        return position.shares;
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

        // Transfer USDC payout to user
        if (payout > 0) {
            usdc.safeTransfer(msg.sender, _wadToUsdc(payout));
        }
    }

    /**
     * @inheritdoc IAMMEngine
     */
    function applyRetroSettlement(
        address /* market */,
        address /* user */,
        bytes calldata /* proof */
    ) external override returns (uint256 refund) {
        // T* settlement logic would go here
        // This requires Merkle proof verification and state reconstruction
        // Placeholder for now
        revert("AMMEngine: T* not implemented");
    }


    // ============================================
    // Internal Helpers
    // ============================================

    function _wadToUsdc(uint256 wadAmount) internal view returns (uint256) {
        // Floor conversion for transfers FROM the contract.
        if (usdcDecimals == 18) {
            return wadAmount;
        } else if (usdcDecimals < 18) {
            return wadAmount / (10 ** (18 - usdcDecimals));
        } else {
            return wadAmount * (10 ** (usdcDecimals - 18));
        }
    }

    function _wadToUsdcCeil(uint256 wadAmount) internal view returns (uint256) {
        // Ceil conversion for transfers TO the contract.
        if (wadAmount == 0) return 0;
        if (usdcDecimals == 18) {
            return wadAmount;
        } else if (usdcDecimals < 18) {
            uint256 factor = 10 ** (18 - usdcDecimals);
            return (wadAmount + factor - 1) / factor;
        } else {
            return wadAmount * (10 ** (usdcDecimals - 18));
        }
    }
}
