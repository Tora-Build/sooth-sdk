// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ILaunchpadEngine} from "@core/interfaces/ILaunchpadEngine.sol";
import {ICollateralizer} from "@core/interfaces/ICollateralizer.sol";
import {ITruthMarket} from "@core/interfaces/ITruthMarket.sol";
import {IProtocolConfig} from "@core/interfaces/IProtocolConfig.sol";
import {IPostAction, KeyValue} from "./IPostAction.sol";

/**
 * @title SoothLensAdapter
 * @notice Lens V3 Post Action adapter that bridges to Sooth Protocol core
 * @dev Each Lens post creates a full Sooth prediction market via LaunchpadEngine.
 *      The adapter acts as the authorized adapter for createMarketFor/tradePositionsFor,
 *      pulling collateral from users, forwarding to LaunchpadEngine, and refunding excess.
 *
 *      Actions via execute():
 *        0 = BUY    (outcome, amount, maxCost)
 *        1 = SELL   (outcome, amount)
 *        2 = RESOLVE (winningOutcome)
 *        3 = REDEEM  (not supported via adapter — use Collateralizer directly)
 */
contract SoothLensAdapter is IPostAction, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ============================================
    // Constants
    // ============================================

    uint256 private constant WAD = 1e18;
    uint256 private constant LN2_WAD = 693147180559945309; // ln(2) in WAD

    uint8 private constant ACTION_BUY = 0;
    uint8 private constant ACTION_SELL = 1;
    uint8 private constant ACTION_RESOLVE = 2;
    uint8 private constant ACTION_REDEEM = 3;

    // KeyValue keys (precomputed keccak256 — must match frontend)
    bytes32 private constant KEY_B = keccak256("sooth.param.b");
    bytes32 private constant KEY_DEADLINE = keccak256("sooth.param.deadline");
    bytes32 private constant KEY_FEE_BPS = keccak256("sooth.param.feeBps");
    bytes32 private constant KEY_ACTION = keccak256("sooth.param.action");
    bytes32 private constant KEY_OUTCOME = keccak256("sooth.param.outcome");
    bytes32 private constant KEY_AMOUNT = keccak256("sooth.param.amount");
    bytes32 private constant KEY_MAX_COST = keccak256("sooth.param.maxCost");
    bytes32 private constant KEY_QUESTION = keccak256("sooth.param.question");

    // ============================================
    // Immutables
    // ============================================

    ILaunchpadEngine public immutable launchpadEngine;
    ICollateralizer public immutable collateralizer;
    IERC20 public immutable collateralToken;
    address public immutable actionHub;
    IProtocolConfig public immutable protocolConfig;

    // ============================================
    // State
    // ============================================

    /// @notice feed => postId => market address
    mapping(address => mapping(uint256 => address)) public marketOf;

    struct PostRef {
        address feed;
        uint256 postId;
    }

    /// @notice market => PostRef (reverse lookup)
    mapping(address => PostRef) public postOf;

    /// @notice feed => postId => disabled
    mapping(address => mapping(uint256 => bool)) public disabled;

    // ============================================
    // Events
    // ============================================

    event PostLinked(address indexed feed, uint256 indexed postId, address indexed market);
    event ActionExecuted(address indexed feed, uint256 indexed postId, uint8 action, address indexed user);

    // ============================================
    // Errors
    // ============================================

    error NotActionHub();
    error MarketAlreadyExists();
    error MarketNotFound();
    error MarketDisabled();
    error InvalidAction();
    error RedeemNotSupported();
    error NotResolver();

    // ============================================
    // Constructor
    // ============================================

    constructor(
        address _launchpadEngine,
        address _collateralizer,
        address _collateralToken,
        address _actionHub,
        address _protocolConfig,
        address _owner
    ) Ownable(_owner) {
        launchpadEngine = ILaunchpadEngine(_launchpadEngine);
        collateralizer = ICollateralizer(_collateralizer);
        collateralToken = IERC20(_collateralToken);
        actionHub = _actionHub;
        protocolConfig = IProtocolConfig(_protocolConfig);
    }

    // ============================================
    // Modifiers
    // ============================================

    modifier onlyActionHub() {
        if (msg.sender != actionHub) revert NotActionHub();
        _;
    }

    // ============================================
    // IPostAction Implementation
    // ============================================

    /// @notice Configure a new Sooth prediction market for a Lens post
    /// @dev Called by ActionHub when post author attaches this action.
    ///      Creates a full LaunchpadEngine market with the adapter as adjudicator.
    ///      The adapter pulls the deposit from the user, approves LaunchpadEngine,
    ///      and calls createMarketFor so the user gets creator credit + LP tokens.
    /// @param originalMsgSender Post creator (becomes market creator + resolver)
    /// @param feed Feed address the post belongs to
    /// @param postId Unique post identifier
    /// @param params Configuration: b (liquidity), deadline, question
    function configure(
        address originalMsgSender,
        address feed,
        uint256 postId,
        KeyValue[] calldata params
    ) external payable onlyActionHub nonReentrant returns (bytes memory) {
        if (marketOf[feed][postId] != address(0)) revert MarketAlreadyExists();

        // Decode params
        uint256 b = 100 * WAD; // default
        uint64 deadline = 0;
        string memory question = "Lens prediction market";

        for (uint256 i = 0; i < params.length; i++) {
            if (params[i].key == KEY_B) {
                b = abi.decode(params[i].value, (uint256));
            } else if (params[i].key == KEY_DEADLINE) {
                deadline = uint64(abi.decode(params[i].value, (uint256)));
            } else if (params[i].key == KEY_QUESTION) {
                question = abi.decode(params[i].value, (string));
            }
        }

        require(deadline > block.timestamp, "SoothLensAdapter: deadline in past");
        require(b > 0, "SoothLensAdapter: zero liquidity");

        // Calculate deposit: b * ln(2), ceiling-adjusted for USDC precision
        uint256 depositWad = (b * LN2_WAD) / WAD;
        // Pull deposit from user (user must have approved this adapter)
        // We pull the WAD-equivalent amount — LaunchpadEngine will convert internally
        // Actually, LaunchpadEngine does _wadToUsdcCeil on the deposit internally,
        // so we need to pull the same USDC amount that LaunchpadEngine will pull from us.
        // The safest approach: pull a generous amount, let LaunchpadEngine pull what it needs,
        // then refund the difference.
        uint256 depositUsdc = _wadToUsdcCeil(depositWad);
        collateralToken.safeTransferFrom(originalMsgSender, address(this), depositUsdc);

        // Approve LaunchpadEngine to pull from us
        collateralToken.forceApprove(address(launchpadEngine), depositUsdc);

        // Create market: adapter is adjudicator so it can resolve later
        // Guardian must be protocolConfig (enforced by LaunchpadEngine)
        (address market, uint256 lpTokens) = launchpadEngine.createMarketFor(
            originalMsgSender,
            question,
            0, // startTime = now
            deadline,
            address(this), // adjudicator = adapter (so we can resolve)
            address(protocolConfig), // guardian
            b,
            0, // adjudicatorAgentId (skip)
            0  // adjudicatorMinValidators (skip)
        );

        // Store mappings
        marketOf[feed][postId] = market;
        postOf[market] = PostRef(feed, postId);

        // Refund any excess collateral (if LaunchpadEngine pulled less than we transferred)
        uint256 remaining = collateralToken.balanceOf(address(this));
        if (remaining > 0) {
            collateralToken.safeTransfer(originalMsgSender, remaining);
        }

        emit PostLinked(feed, postId, market);
        return abi.encode(market, lpTokens);
    }

    /// @notice Execute an action on the market (buy/sell/resolve)
    /// @param originalMsgSender The actual user
    /// @param feed Feed address
    /// @param postId Post identifier
    /// @param params Action type + action-specific parameters
    function execute(
        address originalMsgSender,
        address feed,
        uint256 postId,
        KeyValue[] calldata params
    ) external payable onlyActionHub nonReentrant returns (bytes memory) {
        address market = marketOf[feed][postId];
        if (market == address(0)) revert MarketNotFound();
        if (disabled[feed][postId]) revert MarketDisabled();

        uint8 action = _decodeAction(params);

        if (action == ACTION_BUY) {
            return _buy(originalMsgSender, market, feed, postId, params);
        } else if (action == ACTION_SELL) {
            return _sell(originalMsgSender, market, feed, postId, params);
        } else if (action == ACTION_RESOLVE) {
            return _resolve(originalMsgSender, market, feed, postId, params);
        } else if (action == ACTION_REDEEM) {
            revert RedeemNotSupported();
        }
        revert InvalidAction();
    }

    /// @notice Pause/unpause the market
    function setDisabled(
        address originalMsgSender,
        address feed,
        uint256 postId,
        bool isDisabled,
        KeyValue[] calldata
    ) external payable onlyActionHub returns (bytes memory) {
        address market = marketOf[feed][postId];
        if (market == address(0)) revert MarketNotFound();

        // Only the market creator or contract owner can disable
        address creator = ITruthMarket(market).creator();
        require(
            originalMsgSender == creator || originalMsgSender == owner(),
            "SoothLensAdapter: not authorized"
        );

        disabled[feed][postId] = isDisabled;
        return "";
    }

    // ============================================
    // Owner Functions
    // ============================================

    /// @notice Owner backdoor to resolve a market
    /// @dev Uses the adapter's adjudicator role on the TruthMarket
    /// @param feed Feed address
    /// @param postId Post identifier
    /// @param outcome Winning outcome (0=NO, 1=YES, 2=INVALID)
    function resolveMarket(address feed, uint256 postId, uint8 outcome) external onlyOwner {
        address market = marketOf[feed][postId];
        require(market != address(0), "SoothLensAdapter: no market");

        ITruthMarket(market).settle(outcome, uint64(block.timestamp));
        ITruthMarket(market).finalize();
    }

    // ============================================
    // Internal Actions
    // ============================================

    function _buy(
        address user,
        address market,
        address feed,
        uint256 postId,
        KeyValue[] calldata params
    ) internal returns (bytes memory) {
        (uint8 outcome, uint256 shares, uint256 maxCost) = _decodeBuyParams(params);
        require(shares > 0, "SoothLensAdapter: zero shares");
        require(maxCost > 0, "SoothLensAdapter: zero maxCost");

        // Pull maxCost collateral from user
        collateralToken.safeTransferFrom(user, address(this), maxCost);

        // Approve LaunchpadEngine
        collateralToken.forceApprove(address(launchpadEngine), maxCost);

        // Execute trade: adapter pays, user gets position
        uint256 actualCost = launchpadEngine.tradePositionsFor(
            user,
            market,
            outcome,
            int256(shares),
            maxCost
        );

        // Refund unused collateral
        uint256 remaining = collateralToken.balanceOf(address(this));
        if (remaining > 0) {
            collateralToken.safeTransfer(user, remaining);
        }

        emit ActionExecuted(feed, postId, ACTION_BUY, user);
        return abi.encode(actualCost);
    }

    function _sell(
        address user,
        address market,
        address feed,
        uint256 postId,
        KeyValue[] calldata params
    ) internal returns (bytes memory) {
        (uint8 outcome, uint256 shares,) = _decodeBuyParams(params);
        require(shares > 0, "SoothLensAdapter: zero shares");

        // Sell: no collateral needed from user, proceeds locked in AMMEngine
        uint256 actualCost = launchpadEngine.tradePositionsFor(
            user,
            market,
            outcome,
            -int256(shares),
            0 // minProceeds = 0 (no slippage protection in this simple path)
        );

        emit ActionExecuted(feed, postId, ACTION_SELL, user);
        return abi.encode(actualCost);
    }

    function _resolve(
        address user,
        address market,
        address feed,
        uint256 postId,
        KeyValue[] calldata params
    ) internal returns (bytes memory) {
        // Only the market creator can resolve via the adapter
        address creator = ITruthMarket(market).creator();
        if (user != creator) revert NotResolver();

        uint8 outcome = _decodeOutcome(params);
        require(outcome <= 2, "SoothLensAdapter: invalid outcome");

        // Adapter is the adjudicator, so it can settle + finalize
        ITruthMarket(market).settle(outcome, uint64(block.timestamp));
        ITruthMarket(market).finalize();

        emit ActionExecuted(feed, postId, ACTION_RESOLVE, user);
        return abi.encode(outcome);
    }

    // ============================================
    // Internal Helpers
    // ============================================

    function _decodeAction(KeyValue[] calldata params) internal pure returns (uint8) {
        for (uint256 i = 0; i < params.length; i++) {
            if (params[i].key == KEY_ACTION) {
                return uint8(abi.decode(params[i].value, (uint256)));
            }
        }
        revert InvalidAction();
    }

    function _decodeBuyParams(
        KeyValue[] calldata params
    ) internal pure returns (uint8 outcome, uint256 amount, uint256 maxCost) {
        for (uint256 i = 0; i < params.length; i++) {
            if (params[i].key == KEY_OUTCOME) {
                outcome = uint8(abi.decode(params[i].value, (uint256)));
            } else if (params[i].key == KEY_AMOUNT) {
                amount = abi.decode(params[i].value, (uint256));
            } else if (params[i].key == KEY_MAX_COST) {
                maxCost = abi.decode(params[i].value, (uint256));
            }
        }
    }

    function _decodeOutcome(KeyValue[] calldata params) internal pure returns (uint8) {
        for (uint256 i = 0; i < params.length; i++) {
            if (params[i].key == KEY_OUTCOME) {
                return uint8(abi.decode(params[i].value, (uint256)));
            }
        }
        revert InvalidAction();
    }

    /// @dev Convert WAD (18 decimals) to USDC (6 decimals), rounding up
    function _wadToUsdcCeil(uint256 wadAmount) internal pure returns (uint256) {
        uint256 scalar = 1e12; // WAD / USDC = 1e18 / 1e6
        return (wadAmount + scalar - 1) / scalar;
    }
}
