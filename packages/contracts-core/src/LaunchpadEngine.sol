// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ILaunchpadEngine} from "./interfaces/ILaunchpadEngine.sol";
import {IAMMEngine} from "./interfaces/IAMMEngine.sol";
import {ITruthMarket} from "./interfaces/ITruthMarket.sol";
import {IAdjudicatorRegistration} from "./interfaces/IAdjudicator.sol";
import {TruthMarket} from "./TruthMarket.sol";
import {ICollateralizer} from "./interfaces/ICollateralizer.sol";
import {ITickBook} from "./interfaces/ITickBook.sol";
import {IProtocolConfig} from "./interfaces/IProtocolConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {DecimalMath} from "./libraries/DecimalMath.sol";

/**
 * @title LaunchpadEngine
 * @notice Creator economics layer with LP tokens, fee distribution, and graduation mechanics
 * @dev V8.2: Supports dual-balance position model (users can hold both YES and NO)
 *      Wraps AMMEngine to add Launchpad model on top of pure trading logic
 */
contract LaunchpadEngine is ILaunchpadEngine, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ============================================
    // Constants
    // ============================================

    uint256 private constant WAD = 1e18;
    uint256 private constant LN2_WAD = 693147180559945309; // ln(2) in WAD
    uint256 private constant LN2_INV_WAD = 1442695040888963407; // 1/ln(2) in WAD
    uint256 private constant BPS_DENOMINATOR = 10000;
    uint256 private constant MIN_DEPOSIT_WAD = 10e18;

    // ============================================
    // Immutables
    // ============================================

    IERC20 public immutable usdc;
    IAMMEngine public immutable ammEngine;
    ICollateralizer public immutable collateralizer;
    ITickBook public immutable tickBook;
    IProtocolConfig public immutable protocolConfig;
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

    /// @notice Graduation multiplier (default: 1 = break-even at bBase×ln(2))
    /// threshold = bBase × ln(2) × multiplier
    /// - 1 = graduate when fees equal creator deposit (LP break-even)
    /// - 2 = graduate when fees are 2× creator deposit
    uint16 public graduationMultiplier;

    /// @notice Default hook for graduated markets (optional, for dynamic fees)
    address public defaultHook;

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
    }

    mapping(address => MarketState) public markets;

    /// @notice Array of all created markets (for enumeration)
    address[] public allMarkets;

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
        address _protocolConfig,
        address _protocolTreasury,
        address _owner
    ) Ownable(_owner) {
        require(_usdc != address(0), "LaunchpadEngine: zero usdc");
        require(_ammEngine != address(0), "LaunchpadEngine: zero ammEngine");
        require(_collateralizer != address(0), "LaunchpadEngine: zero collateralizer");
        require(_tickBook != address(0), "LaunchpadEngine: zero tickBook");
        require(_protocolConfig != address(0), "LaunchpadEngine: zero protocol config");
        require(_protocolTreasury != address(0), "LaunchpadEngine: zero treasury");

        usdc = IERC20(_usdc);
        ammEngine = IAMMEngine(_ammEngine);
        collateralizer = ICollateralizer(_collateralizer);
        tickBook = ITickBook(_tickBook);
        protocolConfig = IProtocolConfig(_protocolConfig);
        protocolTreasury = _protocolTreasury;
        usdcDecimals = IERC20Metadata(_usdc).decimals(); // Cache decimals

        // Set default parameters
        preGradFeeBps = 500;        // 5%
        postGradFeeBps = 100;       // 1%
        bBaseShareBps = 5000;       // 50%
        lpYieldShareBps = 3000;     // 30%
        protocolShareBps = 2000;    // 20%
        graduationMultiplier = 1;   // 1× = break-even (fees = bBase × ln(2))
    }

    modifier whenNotPaused() {
        require(!protocolConfig.isPaused(), "LaunchpadEngine: paused");
        _;
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

    /**
     * @notice Set default hook for graduated markets
     * @param hook The hook contract address (e.g., DynamicFeeHook)
     */
    function setDefaultHook(address hook) external onlyOwner {
        defaultHook = hook;
        emit DefaultHookUpdated(hook);
    }

    /// @notice Emitted when default hook is updated
    event DefaultHookUpdated(address indexed hook);

    /**
     * @notice Register a graduated market in TickBook (admin function for migration)
     * @dev Use this to register markets that graduated before TickBook integration
     * @param market The market address to register
     */
    function registerGraduatedMarketInTickBook(address market) external onlyOwner {
        MarketState storage state = markets[market];
        require(state.creator != address(0), "LaunchpadEngine: market not found");
        require(state.isGraduated, "LaunchpadEngine: not graduated");

        // Get outcome tokens
        (address yes, address no) = collateralizer.getOutcomeTokens(market);
        require(yes != address(0) && no != address(0), "LaunchpadEngine: tokens not registered");

        // Get current AMM probability
        (,, uint256 ammProbability) = ammEngine.getMarketState(market);

        // Register in TickBook with default hook (will revert if already registered)
        tickBook.registerMarket(market, yes, no, ammProbability, defaultHook);

        emit MarketRegisteredInTickBook(market, yes, no, ammProbability, defaultHook);
    }

    /// @notice Emitted when a graduated market is manually registered in TickBook
    event MarketRegisteredInTickBook(address indexed market, address yesToken, address noToken, uint256 initialProbability, address hook);

    // ============================================
    // Market Creation
    // ============================================

    /**
     * @inheritdoc ILaunchpadEngine
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
    ) external override nonReentrant whenNotPaused returns (address market, uint256 lpTokens) {
        require(guardian == address(protocolConfig), "LaunchpadEngine: guardian must be protocol");
        require(initialLiquidity > 0, "LaunchpadEngine: zero liquidity");

        uint64 normalizedStartTime = startTime == 0 ? uint64(block.timestamp) : startTime;
        require(normalizedStartTime >= block.timestamp, "LaunchpadEngine: start in past");
        require(normalizedStartTime < deadline, "LaunchpadEngine: start after deadline");

        uint256 depositWad = (initialLiquidity * LN2_WAD) / WAD;
        require(depositWad >= MIN_DEPOSIT_WAD, "LaunchpadEngine: deposit too small");
        uint256 deposit = _wadToUsdcCeil(depositWad);

        usdc.safeTransferFrom(msg.sender, address(this), deposit);

        market = address(new TruthMarket(
            question,
            normalizedStartTime,
            deadline,
            adjudicator,
            address(protocolConfig),
            msg.sender
        ));

        _registerAdjudicatorMarket(market, adjudicator, adjudicatorAgentId, adjudicatorMinValidators);
        ammEngine.initializeMarket(market, initialLiquidity);

        lpTokens = depositWad;

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
            graduatedAt: 0
        });

        lpBalances[market][msg.sender] = lpTokens;

        emit LPBalanceUpdated(market, msg.sender, int256(lpTokens), lpBalances[market][msg.sender], lpTokens);

        allMarkets.push(market);

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
    ) external override nonReentrant whenNotPaused returns (uint256 actualCost) {
        MarketState storage state = markets[market];
        require(state.creator != address(0), "LaunchpadEngine: market not found");
        require(ITruthMarket(market).isLive(), "LaunchpadEngine: market not live");
        require(ammEngine.router() == address(this), "LaunchpadEngine: amm not configured");
        require(outcome <= 1, "LaunchpadEngine: invalid outcome");

        bool isBuy = deltaShares > 0;

        // Get quote from AMM (base cost without fees)
        (uint256 baseCost, ) = ammEngine.getPositionQuote(market, outcome, deltaShares);

        if (!isBuy) {
            // SELL: Calculate and deduct fee
            uint16 feeBps = state.isGraduated ? postGradFeeBps : preGradFeeBps;
            uint256 fee = (baseCost * uint256(feeBps)) / BPS_DENOMINATOR;
            uint256 feeUsdc = _wadToUsdc(fee); // Floor for AMM push
            
            // Calculate net proceeds
            uint256 netProceeds = baseCost > fee ? baseCost - fee : 0;
            actualCost = netProceeds;

            // Execute trade on AMM (pass fee to be routed to us)
            // AMMEngine checks slippage against netProceeds
            ammEngine.tradePositionsFor(msg.sender, market, outcome, deltaShares, maxCostOrMinProceeds, fee);

            // Accrue fee
            if (feeUsdc > 0) {
                 _distributeFee(market, fee, feeUsdc, msg.sender);
            }

            emit PositionTraded(msg.sender, market, outcome, deltaShares, actualCost, fee);
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
            // Using forceApprove to handle tokens that don't allow approve() when current allowance is non-zero
            if (baseCostFromWalletUsdc > 0) {
                usdc.forceApprove(address(ammEngine), baseCostFromWalletUsdc);
            }

            // Execute trade on AMM
            // AMMEngine will use user's _availableBalance first, then pull remainder from us
            ammEngine.tradePositionsFor(msg.sender, market, outcome, deltaShares, baseCost, 0);

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

            // Increase liquidity parameter: scale fee by 1/ln(2) to preserve max loss capacity
            // maxLoss = b * ln(2). If we want maxLoss to increase by feeUSD, then deltaB = feeUSD / ln(2).
            uint256 deltaB = (feeWad * LN2_INV_WAD) / WAD;
            state.bCurrent += deltaB;
            // Mirror depth growth into AMM pricing
            ammEngine.increaseLiquidity(market, deltaB);

            // Mint LP tokens to TRADER (1:1 with fee paid, matching creator's USD-par model)
            uint256 lpTokens = feeWad;
            lpBalances[market][trader] += lpTokens;
            state.totalLPSupply += lpTokens;

            emit LPBalanceUpdated(market, trader, int256(lpTokens), lpBalances[market][trader], state.totalLPSupply);

            state.feesAccrued += feeUsdc;
            emit FeesAccrued(market, feeUsdc, state.feesAccrued);

            if (!state.isGraduated) {
                uint256 graduationThreshold = (state.bBase * LN2_WAD * uint256(graduationMultiplier)) / WAD;
                uint256 feesInWad = _usdcToWad(state.feesAccrued);

                emit GraduationProgressUpdated(market, feesInWad, graduationThreshold);

                if (feesInWad >= graduationThreshold) {
                    state.isGraduated = true;
                    state.graduatedAt = uint64(block.timestamp);

                    (address yes, address no) = collateralizer.isMarketRegistered(market)
                        ? collateralizer.getOutcomeTokens(market)
                        : collateralizer.registerMarket(market);

                    (,, uint256 ammProbability) = ammEngine.getMarketState(market);

                    try tickBook.registerMarket(market, yes, no, ammProbability, defaultHook) returns (bytes32) {
                    } catch (bytes memory reason) {
                        bytes4 duplicateMarketSelector = 0xedd7c146;
                        if (reason.length < 4 || bytes4(reason) != duplicateMarketSelector) {
                            revert("LaunchpadEngine: tickbook register failed");
                        }
                    }

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
            if (toLPYield > 0) {
                emit LPYieldPoolUpdated(market, toLPYield, state.lpYieldPool);
            }

            state.feesAccrued += feeUsdc;
            emit FeesAccrued(market, feeUsdc, state.feesAccrued);

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
    ) external override nonReentrant returns (uint256 usdcAmount) {
        MarketState storage state = markets[market];
        require(lpBalances[market][msg.sender] >= lpAmount, "LaunchpadEngine: insufficient LP");

        // Calculate redemption value using Honest Floor Model
        uint256 floorValue = _calculateFloor(market);

        // Pro-rata share
        usdcAmount = (floorValue * lpAmount) / state.totalLPSupply;

        lpBalances[market][msg.sender] -= lpAmount;
        state.totalLPSupply -= lpAmount;

        emit LPBalanceUpdated(market, msg.sender, -int256(lpAmount), lpBalances[market][msg.sender], state.totalLPSupply);

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
    ) external override nonReentrant {
        MarketState storage state = markets[market];
        require(msg.sender == state.creator, "LaunchpadEngine: not creator");

        // Transfer USDC from creator
        usdc.safeTransferFrom(msg.sender, address(this), amount);

        uint256 amountInWad = _usdcToWad(amount);
        state.bCurrent += amountInWad;
        state.bBase += amountInWad;

        lpBalances[market][msg.sender] += amountInWad;
        state.totalLPSupply += amountInWad;

        emit BaseLiquidityIncreased(market, amountInWad, state.bBase, state.bCurrent);
        emit LPBalanceUpdated(market, msg.sender, int256(amountInWad), lpBalances[market][msg.sender], state.totalLPSupply);
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
        // Threshold = bBase × ln(2) × multiplier (same formula as _distributeFee)
        uint256 thresholdWad = (state.bBase * LN2_WAD * uint256(graduationMultiplier)) / WAD;
        threshold = _wadToUsdc(thresholdWad);

        if (state.isGraduated) {
            progressBps = BPS_DENOMINATOR; // 100%
        } else if (threshold > 0) {
            progressBps = (feesAccrued * BPS_DENOMINATOR) / threshold;
        } else {
            progressBps = 0;
        }
    }

    /**
     * @inheritdoc ILaunchpadEngine
     */
    function getMarkets() external view override returns (address[] memory) {
        return allMarkets;
    }

    /**
     * @inheritdoc ILaunchpadEngine
     */
    function getMarketCount() external view override returns (uint256) {
        return allMarkets.length;
    }

    // ============================================
    // Helper Functions
    // ============================================

    function _usdcToWad(uint256 usdcAmount) internal view returns (uint256) {
        return DecimalMath.toWad(usdcAmount, usdcDecimals);
    }

    function _wadToUsdc(uint256 wadAmount) internal view returns (uint256) {
        return DecimalMath.fromWad(wadAmount, usdcDecimals);
    }

    function _wadToUsdcCeil(uint256 wadAmount) internal view returns (uint256) {
        return DecimalMath.fromWadCeil(wadAmount, usdcDecimals);
    }

    function _registerAdjudicatorMarket(
        address market,
        address adjudicator,
        uint256 agentId,
        uint256 minValidators
    ) internal {
        if (agentId == 0 && minValidators == 0) {
            return;
        }
        require(agentId > 0 && minValidators > 0, "LaunchpadEngine: invalid adjudicator config");
        IAdjudicatorRegistration(adjudicator).registerMarket(market, agentId, minValidators);
    }

    // ============================================
    // V11 Interface Stubs (Not implemented in V10)
    // ============================================

    function dismissMarket(address) external pure override {
        revert("LaunchpadEngine: V11 feature not available");
    }

    function claimRefund(address) external pure override returns (uint256) {
        revert("LaunchpadEngine: V11 feature not available");
    }

    function getTrialStatus(address) external pure override returns (
        uint64, bool, uint256, bool
    ) {
        return (0, false, 0, false);
    }

    function getExitOptions(address, address) external pure override returns (
        uint256, int256, bool
    ) {
        return (0, 0, false);
    }

    function tradeWithAgent(
        address, uint8, int256, uint256, uint256
    ) external pure override returns (uint256) {
        revert("LaunchpadEngine: V11 feature not available");
    }

    function getLPToken(address) external pure override returns (address) {
        return address(0); // V10 uses internal LP tracking, not ERC20
    }
}
