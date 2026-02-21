// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {LMSRMath} from "@core/libraries/LMSRMath.sol";
import {IPostAction, KeyValue} from "./IPostAction.sol";

/**
 * @title SoothPostAction
 * @notice LMSR prediction market as a Lens V3 Post Action
 * @dev Each Lens post becomes a binary prediction market.
 *      Creator configures market params on post creation.
 *      Users buy/sell YES/NO shares at LMSR prices using WGHO.
 *      Creator resolves the outcome after the deadline.
 *
 *      Actions via execute():
 *        0 = BUY    (outcome, amount)
 *        1 = SELL   (outcome, shares)
 *        2 = RESOLVE (winningOutcome)
 *        3 = REDEEM  ()
 */
contract SoothPostAction is IPostAction, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    // ============================================
    // Constants
    // ============================================

    uint256 private constant WAD = 1e18;
    uint8 private constant ACTION_BUY = 0;
    uint8 private constant ACTION_SELL = 1;
    uint8 private constant ACTION_RESOLVE = 2;
    uint8 private constant ACTION_REDEEM = 3;

    uint8 private constant OUTCOME_NO = 0;
    uint8 private constant OUTCOME_YES = 1;
    uint8 private constant OUTCOME_INVALID = 2;

    // KeyValue keys (precomputed keccak256)
    bytes32 private constant KEY_B = keccak256("sooth.param.b");
    bytes32 private constant KEY_DEADLINE = keccak256("sooth.param.deadline");
    bytes32 private constant KEY_FEE_BPS = keccak256("sooth.param.feeBps");
    bytes32 private constant KEY_ACTION = keccak256("sooth.param.action");
    bytes32 private constant KEY_OUTCOME = keccak256("sooth.param.outcome");
    bytes32 private constant KEY_AMOUNT = keccak256("sooth.param.amount");
    bytes32 private constant KEY_MAX_COST = keccak256("sooth.param.maxCost");

    // ============================================
    // State
    // ============================================

    IERC20 public immutable wgho;
    address public immutable actionHub;
    address public treasury;

    struct Market {
        address resolver;
        uint64 deadline;
        uint256 b;            // LMSR liquidity parameter
        uint256 qYes;         // YES quantity (WAD)
        uint256 qNo;          // NO quantity (WAD)
        uint256 totalCollateral;
        uint8 winningOutcome;
        bool resolved;
        bool paused;
        uint16 feeBps;
    }

    struct Position {
        uint256 yesShares;
        uint256 noShares;
    }

    /// @notice feed => postId => Market
    mapping(address => mapping(uint256 => Market)) public markets;

    /// @notice feed => postId => user => Position
    mapping(address => mapping(uint256 => mapping(address => Position))) public positions;

    // ============================================
    // Events
    // ============================================

    event MarketCreated(
        address indexed feed, uint256 indexed postId,
        address resolver, uint256 b, uint64 deadline, uint16 feeBps
    );
    event SharesBought(
        address indexed feed, uint256 indexed postId,
        address indexed user, uint8 outcome, uint256 shares, uint256 cost
    );
    event SharesSold(
        address indexed feed, uint256 indexed postId,
        address indexed user, uint8 outcome, uint256 shares, uint256 proceeds
    );
    event MarketResolved(
        address indexed feed, uint256 indexed postId,
        uint8 winningOutcome
    );
    event SharesRedeemed(
        address indexed feed, uint256 indexed postId,
        address indexed user, uint256 payout
    );

    // ============================================
    // Errors
    // ============================================

    error NotActionHub();
    error MarketAlreadyExists();
    error MarketNotActive();
    error MarketNotResolved();
    error AlreadyResolved();
    error NotResolver();
    error TooEarly();
    error InvalidOutcome();
    error ZeroAmount();
    error InsufficientShares();
    error SlippageExceeded();
    error NothingToRedeem();
    error InvalidAction();
    error MarketPaused();

    // ============================================
    // Constructor
    // ============================================

    constructor(address _wgho, address _actionHub, address _owner) Ownable(_owner) {
        wgho = IERC20(_wgho);
        actionHub = _actionHub;
        treasury = _owner;
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

    /// @notice Configure a new prediction market for a Lens post
    /// @dev Called by ActionHub when post author attaches this action
    /// @param originalMsgSender Post creator (becomes resolver)
    /// @param feed Feed address the post belongs to
    /// @param postId Unique post identifier
    /// @param params Configuration: b (liquidity), deadline, feeBps
    function configure(
        address originalMsgSender,
        address feed,
        uint256 postId,
        KeyValue[] calldata params
    ) external payable onlyActionHub nonReentrant returns (bytes memory) {
        Market storage m = markets[feed][postId];
        if (m.resolver != address(0)) revert MarketAlreadyExists();

        uint256 b = 100 * WAD;  // default
        uint64 deadline = 0;
        uint16 feeBps = 200;    // 2% default

        for (uint256 i = 0; i < params.length; i++) {
            if (params[i].key == KEY_B) {
                b = abi.decode(params[i].value, (uint256));
            } else if (params[i].key == KEY_DEADLINE) {
                deadline = uint64(abi.decode(params[i].value, (uint256)));
            } else if (params[i].key == KEY_FEE_BPS) {
                feeBps = uint16(abi.decode(params[i].value, (uint256)));
            }
        }

        require(deadline > block.timestamp, "SoothPostAction: deadline in past");
        require(b > 0, "SoothPostAction: zero liquidity");
        require(feeBps <= 1000, "SoothPostAction: fee too high"); // max 10%

        // LMSR requires initial subsidy = b * ln(2) ≈ b * 0.693
        // This is the creator's "market maker deposit" that guarantees solvency
        uint256 subsidy = (b * 693147180559945309) / WAD; // b * ln(2)
        wgho.safeTransferFrom(originalMsgSender, address(this), subsidy);

        m.resolver = originalMsgSender;
        m.deadline = deadline;
        m.b = b;
        m.feeBps = feeBps;
        m.totalCollateral = subsidy;
        // qYes, qNo start at 0 → 50/50 price

        emit MarketCreated(feed, postId, originalMsgSender, b, deadline, feeBps);
        return "";
    }

    /// @notice Execute an action on the market (buy/sell/resolve/redeem)
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
        uint8 action = _decodeAction(params);

        if (action == ACTION_BUY) {
            return _buy(originalMsgSender, feed, postId, params);
        } else if (action == ACTION_SELL) {
            return _sell(originalMsgSender, feed, postId, params);
        } else if (action == ACTION_RESOLVE) {
            return _resolve(originalMsgSender, feed, postId, params);
        } else if (action == ACTION_REDEEM) {
            return _redeem(originalMsgSender, feed, postId);
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
        Market storage m = markets[feed][postId];
        require(
            originalMsgSender == m.resolver || originalMsgSender == owner(),
            "SoothPostAction: not authorized"
        );
        m.paused = isDisabled;
        return "";
    }

    // ============================================
    // Internal Actions
    // ============================================

    function _buy(
        address user,
        address feed,
        uint256 postId,
        KeyValue[] calldata params
    ) internal returns (bytes memory) {
        Market storage m = markets[feed][postId];
        if (m.resolver == address(0)) revert MarketNotActive();
        if (m.resolved) revert AlreadyResolved();
        if (m.paused) revert MarketPaused();
        if (block.timestamp >= m.deadline) revert TooEarly(); // past deadline

        (uint8 outcome, uint256 shares, uint256 maxCost) = _decodeBuyParams(params);
        if (outcome > OUTCOME_YES) revert InvalidOutcome();
        if (shares == 0) revert ZeroAmount();

        // Calculate new quantities
        uint256 newQYes = m.qYes;
        uint256 newQNo = m.qNo;
        if (outcome == OUTCOME_YES) {
            newQYes += shares;
        } else {
            newQNo += shares;
        }

        // LMSR cost
        uint256 cost = LMSRMath.calculateCost(m.b, m.qYes, m.qNo, newQYes, newQNo);

        // Apply fee
        uint256 fee = (cost * m.feeBps) / 10000;
        uint256 totalCost = cost + fee;

        if (maxCost > 0 && totalCost > maxCost) revert SlippageExceeded();

        // Transfer WGHO from user
        wgho.safeTransferFrom(user, address(this), totalCost);
        if (fee > 0) {
            wgho.safeTransfer(treasury, fee);
        }

        // Update state
        m.qYes = newQYes;
        m.qNo = newQNo;
        m.totalCollateral += cost;

        // Credit shares
        Position storage pos = positions[feed][postId][user];
        if (outcome == OUTCOME_YES) {
            pos.yesShares += shares;
        } else {
            pos.noShares += shares;
        }

        emit SharesBought(feed, postId, user, outcome, shares, totalCost);
        return abi.encode(totalCost);
    }

    function _sell(
        address user,
        address feed,
        uint256 postId,
        KeyValue[] calldata params
    ) internal returns (bytes memory) {
        Market storage m = markets[feed][postId];
        if (m.resolver == address(0)) revert MarketNotActive();
        if (m.resolved) revert AlreadyResolved();
        if (m.paused) revert MarketPaused();

        (uint8 outcome, uint256 shares,) = _decodeBuyParams(params); // reuse decoder
        if (outcome > OUTCOME_YES) revert InvalidOutcome();
        if (shares == 0) revert ZeroAmount();

        Position storage pos = positions[feed][postId][user];
        if (outcome == OUTCOME_YES) {
            if (pos.yesShares < shares) revert InsufficientShares();
        } else {
            if (pos.noShares < shares) revert InsufficientShares();
        }

        // Calculate new quantities (reverse: remove shares)
        uint256 newQYes = m.qYes;
        uint256 newQNo = m.qNo;
        if (outcome == OUTCOME_YES) {
            newQYes -= shares;
        } else {
            newQNo -= shares;
        }

        // LMSR proceeds = C(old) - C(new)
        uint256 proceeds = LMSRMath.calculateCost(m.b, newQYes, newQNo, m.qYes, m.qNo);

        // Apply fee
        uint256 fee = (proceeds * m.feeBps) / 10000;
        uint256 userProceeds = proceeds - fee;

        // Update state
        m.qYes = newQYes;
        m.qNo = newQNo;
        m.totalCollateral -= proceeds;

        // Debit shares
        if (outcome == OUTCOME_YES) {
            pos.yesShares -= shares;
        } else {
            pos.noShares -= shares;
        }

        // Transfer proceeds
        wgho.safeTransfer(user, userProceeds);
        if (fee > 0) {
            wgho.safeTransfer(treasury, fee);
        }

        emit SharesSold(feed, postId, user, outcome, shares, userProceeds);
        return abi.encode(userProceeds);
    }

    function _resolve(
        address user,
        address feed,
        uint256 postId,
        KeyValue[] calldata params
    ) internal returns (bytes memory) {
        Market storage m = markets[feed][postId];
        if (m.resolver == address(0)) revert MarketNotActive();
        if (m.resolved) revert AlreadyResolved();
        if (user != m.resolver) revert NotResolver();

        uint8 outcome = _decodeOutcome(params);
        if (outcome > OUTCOME_INVALID) revert InvalidOutcome();

        m.resolved = true;
        m.winningOutcome = outcome;

        emit MarketResolved(feed, postId, outcome);
        return abi.encode(outcome);
    }

    function _redeem(
        address user,
        address feed,
        uint256 postId
    ) internal returns (bytes memory) {
        Market storage m = markets[feed][postId];
        if (!m.resolved) revert MarketNotResolved();

        Position storage pos = positions[feed][postId][user];
        uint256 payout;

        if (m.winningOutcome == OUTCOME_YES) {
            payout = pos.yesShares;
            pos.yesShares = 0;
            pos.noShares = 0;
        } else if (m.winningOutcome == OUTCOME_NO) {
            payout = pos.noShares;
            pos.yesShares = 0;
            pos.noShares = 0;
        } else {
            // INVALID: 50% of both
            payout = (pos.yesShares + pos.noShares) / 2;
            pos.yesShares = 0;
            pos.noShares = 0;
        }

        if (payout == 0) revert NothingToRedeem();

        // Each winning share is worth 1 WGHO
        wgho.safeTransfer(user, payout);

        emit SharesRedeemed(feed, postId, user, payout);
        return abi.encode(payout);
    }

    // ============================================
    // View Functions
    // ============================================

    /// @notice Get current YES probability (0-1e18)
    function getPrice(address feed, uint256 postId) external view returns (uint256) {
        Market memory m = markets[feed][postId];
        if (m.b == 0) return 5e17; // 50% if not initialized
        return LMSRMath.calculateProbability(m.b, m.qYes, m.qNo);
    }

    /// @notice Quote cost to buy shares
    function quoteBuy(
        address feed, uint256 postId, uint8 outcome, uint256 shares
    ) external view returns (uint256 cost, uint256 fee, uint256 total) {
        Market memory m = markets[feed][postId];
        uint256 newQYes = m.qYes;
        uint256 newQNo = m.qNo;
        if (outcome == OUTCOME_YES) newQYes += shares;
        else newQNo += shares;

        cost = LMSRMath.calculateCost(m.b, m.qYes, m.qNo, newQYes, newQNo);
        fee = (cost * m.feeBps) / 10000;
        total = cost + fee;
    }

    /// @notice Quote proceeds from selling shares
    function quoteSell(
        address feed, uint256 postId, uint8 outcome, uint256 shares
    ) external view returns (uint256 proceeds, uint256 fee, uint256 total) {
        Market memory m = markets[feed][postId];
        uint256 newQYes = m.qYes;
        uint256 newQNo = m.qNo;
        if (outcome == OUTCOME_YES) newQYes -= shares;
        else newQNo -= shares;

        proceeds = LMSRMath.calculateCost(m.b, newQYes, newQNo, m.qYes, m.qNo);
        fee = (proceeds * m.feeBps) / 10000;
        total = proceeds - fee;
    }

    /// @notice Get user position
    function getPosition(
        address feed, uint256 postId, address user
    ) external view returns (uint256 yesShares, uint256 noShares) {
        Position memory pos = positions[feed][postId][user];
        return (pos.yesShares, pos.noShares);
    }

    // ============================================
    // Admin
    // ============================================

    function setTreasury(address _treasury) external onlyOwner {
        treasury = _treasury;
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
        revert InvalidOutcome();
    }
}
