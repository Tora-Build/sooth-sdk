// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ILaunchpadEngine} from "./interfaces/ILaunchpadEngine.sol";
import {IAMMEngine} from "./interfaces/IAMMEngine.sol";
import {ITruthMarket} from "./interfaces/ITruthMarket.sol";
import {ICollateralizer} from "./interfaces/ICollateralizer.sol";
import {ITickBook} from "./interfaces/ITickBook.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LaunchpadEngine
 * @notice Creator economics layer with LP tokens, fee distribution, and graduation mechanics
 * @dev V8.2: Supports dual-balance position model (users can hold both YES and NO)
 *      Wraps AMMEngine to add Launchpad model on top of pure trading logic
 */
contract LaunchpadEngine is ILaunchpadEngine, Ownable {
    using SafeERC20 for IERC20;

    // ============================================
    // Constants
    // ============================================

    uint256 private constant WAD = 1e18;
    uint256 private constant LN2 = 693147180559945309; // ln(2) in WAD
    uint256 private constant BPS_DENOMINATOR = 10000;

    // ============================================
    // Immutables
    // ============================================

    IERC20 public immutable usdc;
    IAMMEngine public immutable ammEngine;
    ICollateralizer public immutable collateralizer;
    ITickBook public immutable tickBook;
    address public immutable protocolTreasury;
    uint8 private immutable usdcDecimals; // Cached for gas savings

    // ============================================
    // Configurable Parameters (Owner-controlled)
    // ============================================

    /// @notice Pre-graduation fee in basis points (default: 500 = 5%)
    uint16 public preGradFeeBps;

    /// @notice Post-graduation fee in basis points (default: 100 = 1%)
    uint16 public postGradFeeBps;

    /// @notice Post-grad fee split: % to bBase growth (default: 5000 = 50%)
    uint16 public bBaseShareBps;

    /// @notice Post-grad fee split: % to LP yield (default: 3000 = 30%)
    uint16 public lpYieldShareBps;

    /// @notice Post-grad fee split: % to protocol (default: 2000 = 20%)
    uint16 public protocolShareBps;

    /// @notice Graduation multiplier (default: 2 = 2× bBase)
    uint16 public graduationMultiplier;

    // ============================================
    // Market State
    // ============================================

    struct MarketState {
        address creator;
        uint256 bBase;              // Initial liquidity (WAD)
        uint256 bCurrent;           // Current liquidity (WAD)
        uint256 creatorDeposit;     // Initial deposit (USDC decimals)
        uint256 feesAccrued;        // Total fees collected (USDC decimals)
        uint256 totalLPSupply;      // Total LP tokens minted (WAD)
        uint256 lpYieldPool;        // Accumulated LP yield (USDC decimals)
        bool isGraduated;
        uint64 createdAt;
        uint64 graduatedAt;
        string name;                // Market name (for TickBook tokens)
        string symbol;              // Market symbol (for TickBook tokens)
    }

    mapping(address => MarketState) public markets;

    // ============================================
    // LP Token Tracking
    // ============================================

    /// @notice LP token balances: market => user => balance (WAD)
    mapping(address => mapping(address => uint256)) public lpBalances;

    // ============================================
    // Constructor
    // ============================================

    constructor(
        address _usdc,
        address _ammEngine,
        address _collateralizer,
        address _tickBook,
        address _protocolTreasury,
        address _owner
    ) Ownable(_owner) {
        require(_usdc != address(0), "LaunchpadEngine: zero usdc");
        require(_ammEngine != address(0), "LaunchpadEngine: zero ammEngine");
        require(_collateralizer != address(0), "LaunchpadEngine: zero collateralizer");
        require(_tickBook != address(0), "LaunchpadEngine: zero tickBook");
        require(_protocolTreasury != address(0), "LaunchpadEngine: zero treasury");

        usdc = IERC20(_usdc);
        ammEngine = IAMMEngine(_ammEngine);
        collateralizer = ICollateralizer(_collateralizer);
        tickBook = ITickBook(_tickBook);
        protocolTreasury = _protocolTreasury;
        usdcDecimals = IERC20Metadata(_usdc).decimals(); // Cache decimals

        // Set default parameters
        preGradFeeBps = 500;        // 5%
        postGradFeeBps = 100;       // 1%
        bBaseShareBps = 5000;       // 50%
        lpYieldShareBps = 3000;     // 30%
        protocolShareBps = 2000;    // 20%
        graduationMultiplier = 2;   // 2× bBase
    }

    // ============================================
    // Owner Functions (Governance)
    // ============================================

    /**
     * @notice Set pre-graduation fee
     * @param feeBps Fee in basis points (e.g., 500 = 5%)
     */
    function setPreGradFee(uint16 feeBps) external onlyOwner {
        require(feeBps <= 1000, "LaunchpadEngine: fee too high"); // Max 10%
        preGradFeeBps = feeBps;
        emit PreGradFeeUpdated(feeBps);
    }

    /**
     * @notice Set post-graduation fee
     * @param feeBps Fee in basis points (e.g., 100 = 1%)
     */
    function setPostGradFee(uint16 feeBps) external onlyOwner {
        require(feeBps <= 500, "LaunchpadEngine: fee too high"); // Max 5%
        postGradFeeBps = feeBps;
        emit PostGradFeeUpdated(feeBps);
    }

    /**
     * @notice Set post-graduation fee distribution
     * @param bBaseBps % to bBase growth
     * @param lpYieldBps % to LP yield
     * @param protocolBps % to protocol
     */
    function setFeeDistribution(
        uint16 bBaseBps,
        uint16 lpYieldBps,
        uint16 protocolBps
    ) external onlyOwner {
        require(bBaseBps + lpYieldBps + protocolBps == BPS_DENOMINATOR, "LaunchpadEngine: must sum to 100%");
        
        bBaseShareBps = bBaseBps;
        lpYieldShareBps = lpYieldBps;
        protocolShareBps = protocolBps;
        
        emit FeeDistributionUpdated(bBaseBps, lpYieldBps, protocolBps);
    }

    /**
     * @notice Set graduation multiplier
     * @param multiplier Graduation threshold = multiplier × bBase (e.g., 2 = 2× bBase)
     */
    function setGraduationMultiplier(uint16 multiplier) external onlyOwner {
        require(multiplier >= 1 && multiplier <= 10, "LaunchpadEngine: invalid multiplier");
        graduationMultiplier = multiplier;
        emit GraduationMultiplierUpdated(multiplier);
    }

    // ============================================
    // Market Creation
    // ============================================

    /**
     * @inheritdoc ILaunchpadEngine
     */
    function createMarket(
        address market,
        uint256 initialLiquidity,
        string calldata name,
        string calldata symbol
    ) external override returns (uint256 lpTokens) {
        require(ITruthMarket(market).creator() == msg.sender, "LaunchpadEngine: not creator");
        require(markets[market].creator == address(0), "LaunchpadEngine: already exists");
        require(initialLiquidity > 0, "LaunchpadEngine: zero liquidity");

        // Calculate required deposit: b × ln(2)
        uint256 depositWad = (initialLiquidity * LN2) / WAD;
        uint256 deposit = _wadToUsdcCeil(depositWad);

        // Transfer deposit from creator
        usdc.safeTransferFrom(msg.sender, address(this), deposit);

        // Initialize AMM with liquidity
        ammEngine.initializeMarket(market, initialLiquidity);

        // Mint initial LP tokens to creator (1:1 with deposit in WAD)
        lpTokens = depositWad;

        // Store market state
        markets[market] = MarketState({
            creator: msg.sender,
            bBase: initialLiquidity,
            bCurrent: initialLiquidity,
            creatorDeposit: deposit,
            feesAccrued: 0,
            totalLPSupply: lpTokens,
            lpYieldPool: 0,
            isGraduated: false,
            createdAt: uint64(block.timestamp),
            graduatedAt: 0,
            name: name,
            symbol: symbol
        });

        lpBalances[market][msg.sender] = lpTokens;

        emit MarketCreated(market, msg.sender, initialLiquidity, deposit, lpTokens);
    }

    // ============================================
    // Trading
    // ============================================

    /**
     * @inheritdoc ILaunchpadEngine
     */
    function tradePositions(
        address market,
        uint8 outcome,
        int256 deltaShares,
        uint256 maxCostOrMinProceeds
    ) external override returns (uint256 actualCost) {
        MarketState storage state = markets[market];
        require(state.creator != address(0), "LaunchpadEngine: market not found");
        require(ITruthMarket(market).isLive(), "LaunchpadEngine: market not live");
        require(ammEngine.router() == address(this), "LaunchpadEngine: amm not configured");
        require(outcome <= 1, "LaunchpadEngine: invalid outcome");

        bool isBuy = deltaShares > 0;

        // Get quote from AMM (base cost without fees)
        (uint256 baseCost, ) = ammEngine.getPositionQuote(market, outcome, deltaShares);

        if (!isBuy) {
            // SELL: do not pull USDC from user.
            // We interpret maxCostOrMinProceeds as minimum proceeds (slippage protection).
            // Fees on sells are currently not applied (alpha simplification).
            actualCost = baseCost;

            // Execute trade on AMM (credits proceeds to trader, locked)
            ammEngine.tradePositionsFor(msg.sender, market, outcome, deltaShares, maxCostOrMinProceeds);

            emit PositionTraded(msg.sender, market, outcome, deltaShares, actualCost, 0);
        } else {
            // BUY: user pays baseCost + fee
            uint16 feeBps = state.isGraduated ? postGradFeeBps : preGradFeeBps;
            uint256 fee = (baseCost * uint256(feeBps)) / BPS_DENOMINATOR;
            actualCost = baseCost + fee;

            require(actualCost <= maxCostOrMinProceeds, "LaunchpadEngine: cost too high");

            // Check user's spendable balance in AMMEngine
            // This balance can cover part of the baseCost (not the fee - fee always comes from wallet)
            (uint256 userAvailable, ) = ammEngine.getBalances(msg.sender);
            uint256 fromBalance = userAvailable > baseCost ? baseCost : userAvailable;
            uint256 fromWallet = actualCost - fromBalance; // baseCost - fromBalance + fee

            // Convert to USDC decimals for transfers
            uint256 fromWalletUsdc = _wadToUsdcCeil(fromWallet);
            uint256 feeUsdc = _wadToUsdcCeil(fee);
            uint256 baseCostFromWallet = fromWallet > fee ? fromWallet - fee : 0;
            uint256 baseCostFromWalletUsdc = _wadToUsdcCeil(baseCostFromWallet);

            // Pull only what's needed from user's wallet
            if (fromWalletUsdc > 0) {
                usdc.safeTransferFrom(msg.sender, address(this), fromWalletUsdc);
            }

            // Approve AMM for the portion of baseCost that comes from wallet
            // (AMMEngine will use user's balance for the rest)
            if (baseCostFromWalletUsdc > 0) {
                usdc.approve(address(ammEngine), baseCostFromWalletUsdc);
            }

            // Execute trade on AMM
            // AMMEngine will use user's _availableBalance first, then pull remainder from us
            ammEngine.tradePositionsFor(msg.sender, market, outcome, deltaShares, baseCost);

            // Distribute fee (fee always stays in LaunchpadEngine)
            _distributeFee(market, fee, feeUsdc, msg.sender);

            emit PositionTraded(msg.sender, market, outcome, deltaShares, actualCost, fee);
        }
    }

    /**
     * @notice Distribute trading fee according to graduation status
     */
    function _distributeFee(
        address market,
        uint256 feeWad,
        uint256 feeUsdc,
        address trader
    ) internal {
        MarketState storage state = markets[market];

        if (!state.isGraduated) {
            // PRE-GRADUATION: 100% to bBase growth + LP minting to TRADER
            // This converts traders into stakeholders (V7 model)

            // Increase liquidity parameter
            state.bCurrent += feeWad;
            // Mirror depth growth into AMM pricing
            ammEngine.increaseLiquidity(market, feeWad);

            // Mint LP tokens to TRADER (1:1 with fees paid)
            uint256 lpTokens = feeWad;
            lpBalances[market][trader] += lpTokens;
            state.totalLPSupply += lpTokens;

            // Update fees accrued
            state.feesAccrued += feeUsdc;

            // Check graduation (short-circuit if already graduated)
            if (!state.isGraduated) {
                uint256 graduationThreshold = state.bBase * uint256(graduationMultiplier);
                uint256 feesInWad = _usdcToWad(state.feesAccrued);

                if (feesInWad >= graduationThreshold) {
                    state.isGraduated = true;
                    state.graduatedAt = uint64(block.timestamp);

                    // ATOMIC GRADUATION: Register in Collateralizer and TickBook
                    (address yes, address no) = collateralizer.registerMarket(
                        market,
                        state.name,
                        state.symbol
                    );
                    tickBook.registerMarket(market, yes, no);

                    emit MarketGraduated(market, state.feesAccrued, block.timestamp);
                }
            }

            emit FeeDistributedPreGrad(market, feeUsdc, feeWad, lpTokens, trader);

        } else {
            // POST-GRADUATION: Split according to configured percentages

            // toBBase is WAD growth, calculated from feeWad
            uint256 toBBase = (feeWad * uint256(bBaseShareBps)) / BPS_DENOMINATOR;
            
            // LPYield and Protocol are USDC transfers, calculated from feeUsdc
            uint256 toLPYield = (feeUsdc * uint256(lpYieldShareBps)) / BPS_DENOMINATOR;
            uint256 toProtocol = (feeUsdc * uint256(protocolShareBps)) / BPS_DENOMINATOR;

            state.bCurrent += toBBase;
            // Mirror depth growth into AMM pricing
            if (toBBase > 0) {
                ammEngine.increaseLiquidity(market, toBBase);
            }
            state.lpYieldPool += toLPYield;
            state.feesAccrued += feeUsdc;

            if (toProtocol > 0) {
                usdc.safeTransfer(protocolTreasury, toProtocol);
            }

            emit FeeDistributedPostGrad(market, feeUsdc, toBBase, toLPYield, toProtocol);
        }
    }

    // ============================================
    // LP Management
    // ============================================

    /**
     * @inheritdoc ILaunchpadEngine
     */
    function redeemLP(
        address market,
        uint256 lpAmount
    ) external override returns (uint256 usdcAmount) {
        MarketState storage state = markets[market];
        require(lpBalances[market][msg.sender] >= lpAmount, "LaunchpadEngine: insufficient LP");

        // Calculate redemption value using Honest Floor Model
        uint256 floorValue = _calculateFloor(market);

        // Pro-rata share
        usdcAmount = (floorValue * lpAmount) / state.totalLPSupply;

        // Burn LP tokens
        lpBalances[market][msg.sender] -= lpAmount;
        state.totalLPSupply -= lpAmount;

        // Transfer USDC
        usdc.safeTransfer(msg.sender, usdcAmount);

        emit LPRedeemed(msg.sender, market, lpAmount, usdcAmount);
    }

    /**
     * @notice Calculate floor value (worst-case LP value)
     * @dev Floor = (Deposit + Fees + LP Yield) - max(qYes, qNo)
     */
    function _calculateFloor(address market) internal view returns (uint256) {
        MarketState memory state = markets[market];

        // Get AMM state
        (uint256 qYes, uint256 qNo, ) = ammEngine.getMarketState(market);

        // Total cash in market
        uint256 totalCash = state.creatorDeposit + state.feesAccrued + state.lpYieldPool;

        // Maximum liability (worst case: all traders hold winning outcome)
        uint256 maxLiability = qYes > qNo ? qYes : qNo;
        uint256 maxLiabilityInUsdc = _wadToUsdc(maxLiability);

        // Floor = Cash - Liability
        if (totalCash > maxLiabilityInUsdc) {
            return totalCash - maxLiabilityInUsdc;
        } else {
            return 0; // Market underwater
        }
    }

    // ============================================
    // Creator Functions
    // ============================================

    /**
     * @inheritdoc ILaunchpadEngine
     */
    function increaseBBase(
        address market,
        uint256 amount
    ) external override {
        MarketState storage state = markets[market];
        require(msg.sender == state.creator, "LaunchpadEngine: not creator");

        // Transfer USDC from creator
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        // Increase liquidity
        uint256 amountInWad = _usdcToWad(amount);
        state.bCurrent += amountInWad;
        state.bBase += amountInWad; // Also increase base for graduation calc

        // Mint LP tokens to creator
        lpBalances[market][msg.sender] += amountInWad;
        state.totalLPSupply += amountInWad;

        emit LiquidityIncreased(market, msg.sender, amount, amountInWad);
    }

    // ============================================
    // View Functions
    // ============================================

    /**
     * @inheritdoc ILaunchpadEngine
     */
    function getMarketState(address market)
        external
        view
        override
        returns (
            address creator,
            uint256 bBase,
            uint256 bCurrent,
            uint256 totalLPSupply,
            bool isGraduated,
            uint256 floorValue
        )
    {
        MarketState memory state = markets[market];
        return (
            state.creator,
            state.bBase,
            state.bCurrent,
            state.totalLPSupply,
            state.isGraduated,
            _calculateFloor(market)
        );
    }

    /**
     * @inheritdoc ILaunchpadEngine
     */
    function getLPBalance(address market, address user)
        external
        view
        override
        returns (uint256)
    {
        return lpBalances[market][user];
    }

    /**
     * @inheritdoc ILaunchpadEngine
     */
    function getGraduationProgress(address market)
        external
        view
        override
        returns (uint256 feesAccrued, uint256 threshold, uint256 progressBps)
    {
        MarketState memory state = markets[market];
        
        feesAccrued = state.feesAccrued;
        uint256 thresholdWad = state.bBase * graduationMultiplier;
        threshold = _wadToUsdc(thresholdWad);
        
        if (state.isGraduated) {
            progressBps = BPS_DENOMINATOR; // 100%
        } else if (threshold > 0) {
            progressBps = (feesAccrued * BPS_DENOMINATOR) / threshold;
        } else {
            progressBps = 0;
        }
    }

    // ============================================
    // Helper Functions
    // ============================================

    function _usdcToWad(uint256 usdcAmount) internal view returns (uint256) {
        if (usdcDecimals == 18) {
            return usdcAmount;
        } else if (usdcDecimals < 18) {
            return usdcAmount * (10 ** (18 - usdcDecimals));
        } else {
            return usdcAmount / (10 ** (usdcDecimals - 18));
        }
    }

    function _wadToUsdc(uint256 wadAmount) internal view returns (uint256) {
        if (usdcDecimals == 18) {
            return wadAmount;
        } else if (usdcDecimals < 18) {
            return wadAmount / (10 ** (18 - usdcDecimals));
        } else {
            return wadAmount * (10 ** (usdcDecimals - 18));
        }
    }

    function _wadToUsdcCeil(uint256 wadAmount) internal view returns (uint256) {
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
