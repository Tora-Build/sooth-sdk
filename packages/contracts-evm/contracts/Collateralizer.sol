// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ICollateralizer} from "./interfaces/ICollateralizer.sol";
import {ITruthMarket} from "./interfaces/ITruthMarket.sol";
import {OutcomeToken} from "./OutcomeToken.sol";

/**
 * @title Collateralizer
 * @notice Manages outcome token split/merge/redeem operations for TickBook domain
 * @dev 1 USDC = 1 YES + 1 NO (WAD precision)
 */
contract Collateralizer is ICollateralizer {
    using SafeERC20 for IERC20;

    // ============================================
    // Constants
    // ============================================

    uint256 private constant WAD = 1e18;

    // ============================================
    // State Variables
    // ============================================

    /// @notice USDC token
    IERC20 public immutable usdc;
    uint8 private immutable usdcDecimals; // Cached for WAD ↔ token-decimals conversions

    /// @notice Market => (YES token, NO token)
    mapping(address => MarketTokens) private _marketTokens;

    struct MarketTokens {
        OutcomeToken yesToken;
        OutcomeToken noToken;
        bool registered;
    }

    // ============================================
    // Constructor
    // ============================================

    constructor(address _usdc) {
        require(_usdc != address(0), "Collateralizer: zero address");
        usdc = IERC20(_usdc);
        usdcDecimals = IERC20Metadata(_usdc).decimals();
    }

    // ============================================
    // Market Registration
    // ============================================

    /**
     * @inheritdoc ICollateralizer
     */
    function registerMarket(
        address market,
        string calldata name,
        string calldata symbol
    ) external override returns (address yesToken, address noToken) {
        require(market != address(0), "Collateralizer: zero market");
        require(!_marketTokens[market].registered, "Collateralizer: already registered");

        // Deploy YES and NO tokens
        OutcomeToken yes = new OutcomeToken(
            string.concat(name, " - YES"),
            string.concat(symbol, "-YES"),
            address(this),
            market,
            1 // YES = 1
        );

        OutcomeToken no = new OutcomeToken(
            string.concat(name, " - NO"),
            string.concat(symbol, "-NO"),
            address(this),
            market,
            0 // NO = 0
        );

        // Store tokens
        _marketTokens[market] = MarketTokens({
            yesToken: yes,
            noToken: no,
            registered: true
        });

        return (address(yes), address(no));
    }

    // ============================================
    // Split/Merge Operations
    // ============================================

    /**
     * @inheritdoc ICollateralizer
     */
    function split(address market, uint256 amount) external override {
        require(amount > 0, "Collateralizer: zero amount");
        MarketTokens memory tokens = _getTokens(market);

        // Transfer USDC from user
        usdc.safeTransferFrom(msg.sender, address(this), _wadToUsdcCeil(amount));

        // Mint equal YES and NO tokens
        tokens.yesToken.mint(msg.sender, amount);
        tokens.noToken.mint(msg.sender, amount);

        emit Split(msg.sender, market, amount, amount);
    }

    /**
     * @inheritdoc ICollateralizer
     */
    function merge(address market, uint256 amount) external override {
        require(amount > 0, "Collateralizer: zero amount");
        MarketTokens memory tokens = _getTokens(market);

        // Burn equal YES and NO tokens
        tokens.yesToken.burn(msg.sender, amount);
        tokens.noToken.burn(msg.sender, amount);

        // Return USDC to user
        usdc.safeTransfer(msg.sender, _wadToUsdc(amount));

        emit Merged(msg.sender, market, amount, amount);
    }

    // ============================================
    // Redemption (Post-Settlement)
    // ============================================

    /**
     * @inheritdoc ICollateralizer
     */
    function redeem(address market, uint256 amount)
        external
        override
        returns (uint256 usdcAmount)
    {
        require(amount > 0, "Collateralizer: zero amount");
        require(isMarketSettled(market), "Collateralizer: not settled");

        MarketTokens memory tokens = _getTokens(market);
        ITruthMarket truthMarket = ITruthMarket(market);

        // Get winning outcome
        uint8 winningOutcome = truthMarket.winningOutcome();
        require(winningOutcome <= 1, "Collateralizer: invalid outcome");

        // Burn winning tokens
        if (winningOutcome == 1) {
            tokens.yesToken.burn(msg.sender, amount);
        } else {
            tokens.noToken.burn(msg.sender, amount);
        }

        // Get redemption value (binary convenience; INVALID should use redeemOutcome for explicit side)
        uint256 redemptionValue = truthMarket.getRedemptionValue(winningOutcome);
        usdcAmount = (amount * redemptionValue) / WAD;

        // Transfer USDC
        usdc.safeTransfer(msg.sender, _wadToUsdc(usdcAmount));

        emit Redeemed(msg.sender, market, winningOutcome, amount, usdcAmount);
    }

    /**
     * @inheritdoc ICollateralizer
     */
    function redeemOutcome(
        address market,
        uint8 outcome,
        uint256 amount
    ) external override returns (uint256 usdcAmount) {
        require(amount > 0, "Collateralizer: zero amount");
        require(outcome <= 1, "Collateralizer: invalid outcome");
        require(isMarketSettled(market), "Collateralizer: not settled");

        MarketTokens memory tokens = _getTokens(market);
        ITruthMarket truthMarket = ITruthMarket(market);

        // Burn specified outcome tokens
        if (outcome == 1) {
            tokens.yesToken.burn(msg.sender, amount);
        } else {
            tokens.noToken.burn(msg.sender, amount);
        }

        // Get redemption value for this outcome
        uint256 redemptionValue = truthMarket.getRedemptionValue(outcome);
        usdcAmount = (amount * redemptionValue) / WAD;

        // Transfer USDC
        usdc.safeTransfer(msg.sender, _wadToUsdc(usdcAmount));

        emit Redeemed(msg.sender, market, outcome, amount, usdcAmount);
    }

    // ============================================
    // View Functions
    // ============================================

    /**
     * @inheritdoc ICollateralizer
     */
    function getOutcomeTokens(address market)
        external
        view
        override
        returns (address yesToken, address noToken)
    {
        MarketTokens memory tokens = _marketTokens[market];
        require(tokens.registered, "Collateralizer: not registered");
        return (address(tokens.yesToken), address(tokens.noToken));
    }

    /**
     * @inheritdoc ICollateralizer
     */
    function getBalances(address market, address user)
        external
        view
        override
        returns (uint256 yesBalance, uint256 noBalance)
    {
        MarketTokens memory tokens = _getTokens(market);
        return (tokens.yesToken.balanceOf(user), tokens.noToken.balanceOf(user));
    }

    /**
     * @inheritdoc ICollateralizer
     */
    function getTotalCollateral(address market)
        external
        view
        override
        returns (uint256)
    {
        MarketTokens memory tokens = _getTokens(market);
        // Total collateral = total YES supply (should equal NO supply)
        return tokens.yesToken.totalSupply();
    }

    /**
     * @inheritdoc ICollateralizer
     */
    function isMarketSettled(address market) public view override returns (bool) {
        return ITruthMarket(market).isSettled();
    }

    /**
     * @inheritdoc ICollateralizer
     */
    function getRedemptionValue(address market, uint8 outcome)
        external
        view
        override
        returns (uint256)
    {
        return ITruthMarket(market).getRedemptionValue(outcome);
    }

    /**
     * @inheritdoc ICollateralizer
     */
    function isMarketRegistered(address market) external view override returns (bool) {
        return _marketTokens[market].registered;
    }

    // ============================================
    // Internal Helpers
    // ============================================

    function _getTokens(address market) private view returns (MarketTokens memory) {
        MarketTokens memory tokens = _marketTokens[market];
        require(tokens.registered, "Collateralizer: not registered");
        return tokens;
    }

    // ============================================
    // Decimal-Aware WAD ↔ USDC Helpers
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
