// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ILaunchpadEngine} from "./interfaces/ILaunchpadEngine.sol";
import {IAMMEngine} from "./interfaces/IAMMEngine.sol";
import {ITruthMarket} from "./interfaces/ITruthMarket.sol";
import {IAdjudicatorRegistration} from "./interfaces/IAdjudicator.sol";
import {TruthMarket} from "./TruthMarket.sol";
import {ICollateralizer} from "./interfaces/ICollateralizer.sol";
import {ITickBook} from "./interfaces/ITickBook.sol";
import {LaunchpadLPToken} from "./LaunchpadLPToken.sol";
import {IProtocolConfig} from "./interfaces/IProtocolConfig.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {DecimalMath} from "./libraries/DecimalMath.sol";

/**
 * @title LaunchpadEngine
 * @notice Launchpad with trial periods and ERC20 LP tokens
 * @dev Key features:
 *      - TRIAL PERIOD: New markets have a trial period where trading costs are locked
 *      - DISMISS & REFUND: Creator can dismiss market during trial, users claim refunds
 *      - ERC20 LP TOKENS: LaunchpadLPToken is now ERC20 (transferable pre-settlement)
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

    /// @notice Default trial period duration (7 days)
    uint64 public constant DEFAULT_TRIAL_PERIOD = 7 days;

    // ============================================
    // Immutables
    // ============================================

    IERC20 public immutable usdc;
    IAMMEngine public immutable ammEngine;
    ICollateralizer public immutable collateralizer;
    ITickBook public immutable tickBook;
    IProtocolConfig public immutable protocolConfig;
    address public immutable protocolTreasury;
    uint8 private immutable usdcDecimals;

    // ============================================
    // Configurable Parameters
    // ============================================

    uint16 public preGradFeeBps;
    uint16 public postGradFeeBps;
    uint16 public bBaseShareBps;
    uint16 public lpYieldShareBps;
    uint16 public protocolShareBps;
    uint16 public graduationMultiplier;
    address public defaultHook;

    // ============================================
    // V11: Trial Period State
    // ============================================

    struct TrialState {
        uint64 trialEndTime;        // When trial period ends
        bool isDismissed;           // Creator dismissed the market
        uint256 totalLockedCost;    // Total cost locked across all traders
    }

    /// @notice Trial state per market
    mapping(address => TrialState) public trialStates;

    /// @notice User's locked cost per market (for refund calculation)
    mapping(address => mapping(address => uint256)) public userLockedCost;

    /// @notice User's trial balance per market (net P&L during trial)
    mapping(address => mapping(address => int256)) public userTrialBalance;

    // ============================================
    // Market State
    // ============================================

    struct MarketState {
        address creator;
        address lpToken;            // V11: ERC20 LP token address
        uint256 bBase;
        uint256 bCurrent;
        uint256 creatorDeposit;
        uint256 feesAccrued;
        uint256 totalLPSupply;
        uint256 lpYieldPool;
        bool isGraduated;
        uint64 createdAt;
        uint64 graduatedAt;
    }

    mapping(address => MarketState) public markets;
    address[] public allMarkets;

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
        usdcDecimals = IERC20Metadata(_usdc).decimals();

        // Set default parameters
        preGradFeeBps = 500;
        postGradFeeBps = 100;
        bBaseShareBps = 5000;
        lpYieldShareBps = 3000;
        protocolShareBps = 2000;
        graduationMultiplier = 1;

    }

    modifier whenNotPaused() {
        require(!protocolConfig.isPaused(), "LaunchpadEngine: paused");
        _;
    }

    // ============================================
    // Owner Functions
    // ============================================

    function setPreGradFee(uint16 feeBps) external onlyOwner {
        require(feeBps <= 1000, "LaunchpadEngine: fee too high");
        preGradFeeBps = feeBps;
        emit PreGradFeeUpdated(feeBps);
    }

    function setPostGradFee(uint16 feeBps) external onlyOwner {
        require(feeBps <= 500, "LaunchpadEngine: fee too high");
        postGradFeeBps = feeBps;
        emit PostGradFeeUpdated(feeBps);
    }

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

    function setGraduationMultiplier(uint16 multiplier) external onlyOwner {
        require(multiplier >= 1 && multiplier <= 10, "LaunchpadEngine: invalid multiplier");
        graduationMultiplier = multiplier;
        emit GraduationMultiplierUpdated(multiplier);
    }

    function setDefaultHook(address hook) external onlyOwner {
        defaultHook = hook;
        emit DefaultHookUpdated(hook);
    }

    /// @notice Emitted when default hook is updated
    event DefaultHookUpdated(address indexed hook);

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
        return _createMarketInternal(
            question,
            startTime,
            deadline,
            adjudicator,
            guardian,
            initialLiquidity,
            DEFAULT_TRIAL_PERIOD,
            adjudicatorAgentId,
            adjudicatorMinValidators
        );
    }

    function _createMarketInternal(
        string calldata question,
        uint64 startTime,
        uint64 deadline,
        address adjudicator,
        address guardian,
        uint256 initialLiquidity,
        uint64 trialDuration,
        uint256 adjudicatorAgentId,
        uint256 adjudicatorMinValidators
    ) internal returns (address market, uint256 lpTokens) {
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

        // Create ERC20 LP token
        string memory lpName = string(abi.encodePacked("Sooth LP: ", _truncateString(question, 50)));
        string memory lpSymbol = string(abi.encodePacked("sLP-", _addressToString(market)));
        address lpToken = address(new LaunchpadLPToken(market, address(this), lpName, lpSymbol));

        markets[market] = MarketState({
            creator: msg.sender,
            lpToken: lpToken,
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

        // V11: Initialize trial period
        trialStates[market] = TrialState({
            trialEndTime: uint64(block.timestamp) + trialDuration,
            isDismissed: false,
            totalLockedCost: 0
        });

        // Mint LP tokens to creator
        LaunchpadLPToken(lpToken).mint(msg.sender, lpTokens);

        allMarkets.push(market);

        emit LPTokenCreated(market, lpToken);
        emit LPBalanceUpdated(market, msg.sender, int256(lpTokens), lpTokens, lpTokens);
        emit MarketCreated(market, msg.sender, initialLiquidity, deposit, lpTokens);
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
        return _tradeInternal(market, outcome, deltaShares, maxCostOrMinProceeds, msg.sender);
    }

    function _tradeInternal(
        address market,
        uint8 outcome,
        int256 deltaShares,
        uint256 maxCostOrMinProceeds,
        address trader
    ) internal returns (uint256 actualCost) {
        MarketState storage state = markets[market];
        TrialState storage trial = trialStates[market];

        require(state.creator != address(0), "LaunchpadEngine: market not found");
        require(!trial.isDismissed, "LaunchpadEngine: market dismissed");
        require(ITruthMarket(market).isLive(), "LaunchpadEngine: market not live");
        require(ammEngine.router() == address(this), "LaunchpadEngine: amm not configured");
        require(outcome <= 1, "LaunchpadEngine: invalid outcome");

        bool isTrialPeriod = block.timestamp < trial.trialEndTime;
        bool isBuy = deltaShares > 0;

        // Get quote from AMM
        (uint256 baseCost, ) = ammEngine.getPositionQuote(market, outcome, deltaShares);

        // Calculate fee
        uint16 baseFee = state.isGraduated ? postGradFeeBps : preGradFeeBps;
        uint256 fee = (baseCost * uint256(baseFee)) / BPS_DENOMINATOR;

        if (!isBuy) {
            // SELL logic
            uint256 feeUsdc = _wadToUsdc(fee);
            uint256 netProceeds = baseCost > fee ? baseCost - fee : 0;
            actualCost = netProceeds;

            ammEngine.tradePositionsFor(trader, market, outcome, deltaShares, maxCostOrMinProceeds, fee);

            if (feeUsdc > 0) {
                _distributeFee(market, fee, feeUsdc, trader);
            }

            // V11: Track trial balance for sells
            if (isTrialPeriod) {
                userTrialBalance[market][trader] += int256(netProceeds);
            }
        } else {
            // BUY logic
            actualCost = baseCost + fee;
            require(actualCost <= maxCostOrMinProceeds, "LaunchpadEngine: cost too high");

            (uint256 userAvailable, ) = ammEngine.getBalances(trader);
            uint256 fromBalance = userAvailable > baseCost ? baseCost : userAvailable;
            uint256 fromWallet = actualCost - fromBalance;

            uint256 fromWalletUsdc = _wadToUsdcCeil(fromWallet);
            uint256 feeUsdc = _wadToUsdcCeil(fee);
            uint256 baseCostFromWallet = fromWallet > fee ? fromWallet - fee : 0;
            uint256 baseCostFromWalletUsdc = _wadToUsdcCeil(baseCostFromWallet);

            if (fromWalletUsdc > 0) {
                usdc.safeTransferFrom(trader, address(this), fromWalletUsdc);
            }

            if (baseCostFromWalletUsdc > 0) {
                usdc.forceApprove(address(ammEngine), baseCostFromWalletUsdc);
            }

            ammEngine.tradePositionsFor(trader, market, outcome, deltaShares, baseCost, 0);

            _distributeFee(market, fee, feeUsdc, trader);

            // V11: Track locked cost during trial
            if (isTrialPeriod) {
                userLockedCost[market][trader] += actualCost;
                trial.totalLockedCost += actualCost;
                userTrialBalance[market][trader] -= int256(actualCost);
            }
        }

        emit PositionTraded(trader, market, outcome, deltaShares, actualCost, fee);
    }

    // ============================================
    // V11: Trial Period Functions
    // ============================================

    /**
     * @notice Dismiss a market after trial period ends (creator only)
     * @dev Sets isDismissed flag, allowing users to claim refunds.
     *      Only callable after trial period AND if market has NOT graduated.
     *      Graduated markets cannot be dismissed (they proved traction).
     * @param market The market to dismiss
     */
    function dismissMarket(address market) external nonReentrant {
        MarketState storage state = markets[market];
        TrialState storage trial = trialStates[market];

        require(msg.sender == state.creator, "LaunchpadEngine: not creator");
        require(block.timestamp >= trial.trialEndTime, "LaunchpadEngine: trial not ended");
        require(!trial.isDismissed, "LaunchpadEngine: already dismissed");
        require(!state.isGraduated, "LaunchpadEngine: already graduated");

        trial.isDismissed = true;

        emit MarketDismissed(market, msg.sender, block.timestamp);
    }

    /**
     * @notice Claim refund after market dismissal
     * @dev Returns user's locked cost during trial period
     * @param market The dismissed market
     * @return refundAmount Amount refunded
     */
    function claimRefund(address market) external nonReentrant returns (uint256 refundAmount) {
        TrialState storage trial = trialStates[market];
        require(trial.isDismissed, "LaunchpadEngine: market not dismissed");

        refundAmount = userLockedCost[market][msg.sender];
        require(refundAmount > 0, "LaunchpadEngine: no refund available");

        userLockedCost[market][msg.sender] = 0;
        trial.totalLockedCost -= refundAmount;

        uint256 refundUsdc = _wadToUsdc(refundAmount);
        usdc.safeTransfer(msg.sender, refundUsdc);

        emit RefundClaimed(market, msg.sender, refundUsdc);
    }

    // ============================================
    // Fee Distribution (unchanged from V10)
    // ============================================

    function _distributeFee(
        address market,
        uint256 feeWad,
        uint256 feeUsdc,
        address trader
    ) internal {
        MarketState storage state = markets[market];

        if (!state.isGraduated) {
            uint256 deltaB = (feeWad * LN2_INV_WAD) / WAD;
            state.bCurrent += deltaB;
            ammEngine.increaseLiquidity(market, deltaB);

            uint256 lpTokens = feeWad;
            LaunchpadLPToken(state.lpToken).mint(trader, lpTokens);
            state.totalLPSupply += lpTokens;

            emit LPBalanceUpdated(market, trader, int256(lpTokens), LaunchpadLPToken(state.lpToken).balanceOf(trader), state.totalLPSupply);

            state.feesAccrued += feeUsdc;
            emit FeesAccrued(market, feeUsdc, state.feesAccrued);

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

            emit FeeDistributedPreGrad(market, feeUsdc, feeWad, lpTokens, trader);
        } else {
            uint256 toBBase = (feeWad * uint256(bBaseShareBps)) / BPS_DENOMINATOR;
            uint256 toLPYield = (feeUsdc * uint256(lpYieldShareBps)) / BPS_DENOMINATOR;
            uint256 toProtocol = (feeUsdc * uint256(protocolShareBps)) / BPS_DENOMINATOR;

            state.bCurrent += toBBase;
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
        LaunchpadLPToken lpToken = LaunchpadLPToken(state.lpToken);

        require(lpToken.balanceOf(msg.sender) >= lpAmount, "LaunchpadEngine: insufficient LP");

        uint256 floorValue = _calculateFloor(market);
        usdcAmount = (floorValue * lpAmount) / state.totalLPSupply;

        lpToken.burn(msg.sender, lpAmount);
        state.totalLPSupply -= lpAmount;

        emit LPBalanceUpdated(market, msg.sender, -int256(lpAmount), lpToken.balanceOf(msg.sender), state.totalLPSupply);

        usdc.safeTransfer(msg.sender, usdcAmount);

        emit LPRedeemed(msg.sender, market, lpAmount, usdcAmount);
    }

    function _calculateFloor(address market) internal view returns (uint256) {
        MarketState memory state = markets[market];
        (uint256 qYes, uint256 qNo, ) = ammEngine.getMarketState(market);
        uint256 totalCash = state.creatorDeposit + state.feesAccrued + state.lpYieldPool;
        uint256 maxLiability = qYes > qNo ? qYes : qNo;
        uint256 maxLiabilityInUsdc = _wadToUsdc(maxLiability);

        if (totalCash > maxLiabilityInUsdc) {
            return totalCash - maxLiabilityInUsdc;
        } else {
            return 0;
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

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        uint256 amountInWad = _usdcToWad(amount);
        state.bCurrent += amountInWad;
        state.bBase += amountInWad;

        LaunchpadLPToken(state.lpToken).mint(msg.sender, amountInWad);
        state.totalLPSupply += amountInWad;

        emit BaseLiquidityIncreased(market, amountInWad, state.bBase, state.bCurrent);
        emit LPBalanceUpdated(market, msg.sender, int256(amountInWad), LaunchpadLPToken(state.lpToken).balanceOf(msg.sender), state.totalLPSupply);
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
    function getGraduationProgress(address market)
        external
        view
        override
        returns (uint256 feesAccrued, uint256 threshold, uint256 progressBps)
    {
        MarketState memory state = markets[market];
        feesAccrued = state.feesAccrued;
        uint256 thresholdWad = (state.bBase * LN2_WAD * uint256(graduationMultiplier)) / WAD;
        threshold = _wadToUsdc(thresholdWad);

        if (state.isGraduated) {
            progressBps = BPS_DENOMINATOR;
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

    function _truncateString(string memory str, uint256 maxLen) internal pure returns (string memory) {
        bytes memory strBytes = bytes(str);
        if (strBytes.length <= maxLen) return str;

        bytes memory result = new bytes(maxLen);
        for (uint256 i = 0; i < maxLen; i++) {
            result[i] = strBytes[i];
        }
        return string(result);
    }

    function _addressToString(address addr) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory data = abi.encodePacked(addr);
        bytes memory str = new bytes(8); // First 4 bytes = 8 hex chars
        for (uint256 i = 0; i < 4; i++) {
            str[i*2] = alphabet[uint8(data[i] >> 4)];
            str[i*2+1] = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }
}
