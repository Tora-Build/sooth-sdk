// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {TickBitmap} from "./libraries/TickBitmap.sol";

/**
 * @title SoothBook V12
 * @notice 4-atomic-action prediction market orderbook
 * @dev Only 4 user actions: buyYes, buyNo, mint, merge
 *      Matching engine auto-mints when buyYes.price + buyNo.price >= 1
 *      Surplus (price improvement) goes to taker
 *
 *      Ticks: 1-999 (0.1% to 99.9% probability)
 *      Price = tick / 1000 (in WAD: tick * 1e15)
 *
 *      No sell action. Selling = buying opposite side.
 *      With escrow flag: lock existing tokens, auto-merge on fill.
 */
contract SoothBook is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;
    using TickBitmap for TickBitmap.Bitmap;

    // ============================================
    // Constants
    // ============================================

    uint256 private constant WAD = 1e18;
    uint16 private constant MIN_TICK = 1;
    uint16 private constant MAX_TICK = 999;
    uint16 private constant NUM_TICKS = 1000;

    // ============================================
    // Errors
    // ============================================

    error InvalidTick();
    error ZeroAmount();
    error MarketNotActive();
    error MarketNotLive();
    error MarketAlreadyExists();
    error InsufficientBalance();
    error OrderNotActive();
    error NotOrderOwner();
    error SlippageExceeded();
    error MarketNotFinalized();
    error NothingToRedeem();

    // ============================================
    // Types
    // ============================================

    struct Market {
        IERC20 collateral;
        bool active;
        bool finalized;
        uint8 outcome; // 0 = NO wins, 1 = YES wins, 2 = invalid (50/50)
    }

    struct Order {
        address maker;
        uint128 amount;    // shares remaining
        bool escrow;       // true = escrowing opposite tokens for exit
    }

    // ============================================
    // Storage
    // ============================================

    // Market state
    mapping(bytes32 => Market) public markets;

    // Order books: marketKey => side (0=YES, 1=NO) => tick => orders (FIFO queue)
    mapping(bytes32 => mapping(uint8 => mapping(uint16 => Order[]))) private _orders;
    // Head pointer for FIFO (avoid shifting arrays)
    mapping(bytes32 => mapping(uint8 => mapping(uint16 => uint256))) private _orderHead;

    // Bitmaps: marketKey => side => bitmap
    mapping(bytes32 => mapping(uint8 => TickBitmap.Bitmap)) private _bitmaps;

    // Balances: marketKey => user => outcome => shares (WAD)
    mapping(bytes32 => mapping(address => mapping(uint8 => uint256))) public balances;

    // Collateral backing: marketKey => total collateral held
    mapping(bytes32 => uint256) private _collateralBacking;

    // Fee
    uint24 public feeBps; // taker fee in bps (applied to surplus only)
    address public feeRecipient;

    // ============================================
    // Events
    // ============================================

    event MarketCreated(bytes32 indexed marketKey, address collateral);
    event OrderPlaced(bytes32 indexed marketKey, uint8 side, uint16 tick, address indexed maker, uint128 amount, bool escrow);
    event OrderFilled(bytes32 indexed marketKey, uint8 takerSide, uint16 yesTick, uint16 noTick, address indexed taker, address indexed maker, uint128 amount, uint256 surplus);
    event OrderCancelled(bytes32 indexed marketKey, uint8 side, uint16 tick, address indexed maker, uint128 amount);
    event Minted(bytes32 indexed marketKey, address indexed user, uint256 amount);
    event Merged(bytes32 indexed marketKey, address indexed user, uint256 amount);
    event Redeemed(bytes32 indexed marketKey, address indexed user, uint256 payout);
    event MarketResolved(bytes32 indexed marketKey, uint8 outcome);

    // ============================================
    // Constructor
    // ============================================

    constructor() Ownable(msg.sender) {}

    // ============================================
    // Admin
    // ============================================

    function createMarket(bytes32 marketKey, address collateral) external onlyOwner {
        if (markets[marketKey].active) revert MarketAlreadyExists();
        markets[marketKey] = Market({
            collateral: IERC20(collateral),
            active: true,
            finalized: false,
            outcome: 0
        });
        emit MarketCreated(marketKey, collateral);
    }

    function resolveMarket(bytes32 marketKey, uint8 outcome) external onlyOwner {
        Market storage m = markets[marketKey];
        if (!m.active) revert MarketNotActive();
        m.finalized = true;
        m.outcome = outcome;
        emit MarketResolved(marketKey, outcome);
    }

    function setFee(uint24 _feeBps, address _feeRecipient) external onlyOwner {
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
    }

    // ============================================
    // Core Action 1: buyYes
    // ============================================

    /**
     * @notice Buy YES outcome tokens
     * @param marketKey Market identifier
     * @param tick Price tick (1-999). Price = tick/1000
     * @param amount Number of shares
     * @param escrow If true, escrow NO tokens for exit (sell NO position)
     * @param maxCost Max collateral willing to spend (slippage protection, 0 = no limit)
     */
    function buyYes(
        bytes32 marketKey,
        uint16 tick,
        uint128 amount,
        bool escrow,
        uint256 maxCost
    ) external nonReentrant {
        _buy(marketKey, 1, tick, amount, escrow, maxCost);
    }

    // ============================================
    // Core Action 2: buyNo
    // ============================================

    /**
     * @notice Buy NO outcome tokens
     * @param marketKey Market identifier
     * @param tick Price tick (1-999). Price = tick/1000
     * @param amount Number of shares
     * @param escrow If true, escrow YES tokens for exit (sell YES position)
     * @param maxCost Max collateral willing to spend (slippage protection, 0 = no limit)
     */
    function buyNo(
        bytes32 marketKey,
        uint16 tick,
        uint128 amount,
        bool escrow,
        uint256 maxCost
    ) external nonReentrant {
        _buy(marketKey, 0, tick, amount, escrow, maxCost);
    }

    // ============================================
    // Core Action 3: mint
    // ============================================

    /**
     * @notice Mint complete sets: deposit collateral, get 1 YES + 1 NO
     * @param marketKey Market identifier
     * @param amount Number of sets to mint (WAD)
     */
    function mint(bytes32 marketKey, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Market storage m = markets[marketKey];
        if (!m.active) revert MarketNotActive();

        m.collateral.safeTransferFrom(msg.sender, address(this), amount);
        _collateralBacking[marketKey] += amount;

        balances[marketKey][msg.sender][1] += amount; // YES
        balances[marketKey][msg.sender][0] += amount; // NO

        emit Minted(marketKey, msg.sender, amount);
    }

    // ============================================
    // Core Action 4: merge
    // ============================================

    /**
     * @notice Merge complete sets: return 1 YES + 1 NO, get collateral back
     * @param marketKey Market identifier
     * @param amount Number of sets to merge (WAD)
     */
    function merge(bytes32 marketKey, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Market storage m = markets[marketKey];

        uint256 yesBal = balances[marketKey][msg.sender][1];
        uint256 noBal = balances[marketKey][msg.sender][0];
        if (yesBal < amount || noBal < amount) revert InsufficientBalance();

        balances[marketKey][msg.sender][1] -= amount;
        balances[marketKey][msg.sender][0] -= amount;
        _collateralBacking[marketKey] -= amount;

        m.collateral.safeTransfer(msg.sender, amount);

        emit Merged(marketKey, msg.sender, amount);
    }

    // ============================================
    // Cancel
    // ============================================

    /**
     * @notice Cancel a resting order at a specific tick
     * @dev Cancels the caller's oldest order at that tick
     * @param marketKey Market identifier
     * @param side 0 = NO bid, 1 = YES bid
     * @param tick Price tick
     */
    function cancel(bytes32 marketKey, uint8 side, uint16 tick) external nonReentrant {
        Order[] storage queue = _orders[marketKey][side][tick];
        uint256 head = _orderHead[marketKey][side][tick];

        // Find caller's first active order
        bool found;
        uint256 idx;
        for (uint256 i = head; i < queue.length; i++) {
            if (queue[i].maker == msg.sender && queue[i].amount > 0) {
                found = true;
                idx = i;
                break;
            }
        }
        if (!found) revert OrderNotActive();

        Order storage order = queue[idx];
        uint128 refundAmount = order.amount;
        bool wasEscrow = order.escrow;
        order.amount = 0;

        // Advance head if possible
        _advanceHead(marketKey, side, tick);

        // Clear bitmap if tick is empty
        if (_tickEmpty(marketKey, side, tick)) {
            _bitmaps[marketKey][side].clearBit(tick);
        }

        Market storage m = markets[marketKey];

        if (wasEscrow) {
            // Return escrowed opposite tokens
            uint8 opposite = side == 1 ? 0 : 1;
            balances[marketKey][msg.sender][opposite] += refundAmount;
        } else {
            // Return collateral: price = tick/1000
            uint256 refund = (uint256(refundAmount) * uint256(tick)) / NUM_TICKS;
            _collateralBacking[marketKey] -= refund;
            m.collateral.safeTransfer(msg.sender, refund);
        }

        emit OrderCancelled(marketKey, side, tick, msg.sender, refundAmount);
    }

    // ============================================
    // Redeem (post-resolution)
    // ============================================

    /**
     * @notice Redeem winning tokens for collateral after market resolution
     * @param marketKey Market identifier
     */
    function redeem(bytes32 marketKey) external nonReentrant {
        Market storage m = markets[marketKey];
        if (!m.finalized) revert MarketNotFinalized();

        uint256 yesBal = balances[marketKey][msg.sender][1];
        uint256 noBal = balances[marketKey][msg.sender][0];
        if (yesBal == 0 && noBal == 0) revert NothingToRedeem();

        uint256 payout;
        if (m.outcome == 2) {
            // Invalid: 50/50 split
            payout = (yesBal + noBal) / 2;
        } else if (m.outcome == 1) {
            payout = yesBal;
        } else {
            payout = noBal;
        }

        balances[marketKey][msg.sender][1] = 0;
        balances[marketKey][msg.sender][0] = 0;

        if (payout > 0) {
            _collateralBacking[marketKey] -= payout;
            m.collateral.safeTransfer(msg.sender, payout);
        }

        emit Redeemed(marketKey, msg.sender, payout);
    }

    // ============================================
    // Internal: Unified Buy Logic
    // ============================================

    /**
     * @dev Core buy logic for both YES and NO sides
     * @param side 1 = buying YES, 0 = buying NO
     * @param tick The buyer's price tick
     */
    function _buy(
        bytes32 marketKey,
        uint8 side,
        uint16 tick,
        uint128 amount,
        bool escrow,
        uint256 maxCost
    ) internal {
        if (tick < MIN_TICK || tick > MAX_TICK) revert InvalidTick();
        if (amount == 0) revert ZeroAmount();
        Market storage m = markets[marketKey];
        if (!m.active || m.finalized) revert MarketNotActive();

        // Collect payment
        uint256 cost = (uint256(amount) * uint256(tick)) / NUM_TICKS;
        if (maxCost > 0 && cost > maxCost) revert SlippageExceeded();

        if (escrow) {
            // Escrow opposite tokens
            uint8 opposite = side == 1 ? 0 : 1;
            if (balances[marketKey][msg.sender][opposite] < amount) revert InsufficientBalance();
            balances[marketKey][msg.sender][opposite] -= amount;
        } else {
            // Deposit collateral
            m.collateral.safeTransferFrom(msg.sender, address(this), cost);
            _collateralBacking[marketKey] += cost;
        }

        // Try to match against opposite side
        uint128 remaining = _match(marketKey, side, tick, amount, escrow);

        // Rest goes on the book
        if (remaining > 0) {
            _orders[marketKey][side][tick].push(Order({
                maker: msg.sender,
                amount: remaining,
                escrow: escrow
            }));
            if (!_bitmaps[marketKey][side].isSet(tick)) {
                _bitmaps[marketKey][side].setBit(tick);
            }
            emit OrderPlaced(marketKey, side, tick, msg.sender, remaining, escrow);
        }
    }

    /**
     * @dev Match a taker order against the opposite book
     *      YES buyer at tick Y matches NO bids where Y + N >= 1000
     *      i.e., NO tick >= (1000 - Y)
     *
     *      Matching traverses from best (highest) opposite tick downward.
     *      Surplus = (yesTick + noTick - 1000) goes to taker.
     *
     * @return remaining Unfilled amount
     */
    function _match(
        bytes32 marketKey,
        uint8 takerSide,
        uint16 takerTick,
        uint128 amount,
        bool takerEscrow
    ) internal returns (uint128 remaining) {
        remaining = amount;

        uint8 makerSide = takerSide == 1 ? 0 : 1;
        // Minimum opposite tick needed: 1000 - takerTick
        uint16 minOppTick = NUM_TICKS - takerTick;
        if (minOppTick > MAX_TICK) return remaining; // taker price too low to match anything

        // Find highest opposite tick
        uint16 oppTick = _bitmaps[marketKey][makerSide].findNextDown(MAX_TICK + 1);
        if (oppTick > MAX_TICK) return remaining; // no opposite orders

        Market storage m = markets[marketKey];

        while (remaining > 0 && oppTick >= minOppTick && oppTick <= MAX_TICK) {
            // Fill orders at this tick (FIFO)
            Order[] storage queue = _orders[marketKey][makerSide][oppTick];
            uint256 head = _orderHead[marketKey][makerSide][oppTick];

            while (remaining > 0 && head < queue.length) {
                Order storage maker = queue[head];
                if (maker.amount == 0) {
                    head++;
                    continue;
                }

                uint128 fill = remaining < maker.amount ? remaining : maker.amount;

                // Calculate ticks
                uint16 yesTick;
                uint16 noTick;
                if (takerSide == 1) {
                    yesTick = takerTick;
                    noTick = oppTick;
                } else {
                    yesTick = oppTick;
                    noTick = takerTick;
                }

                // Surplus per share (in ticks): yesTick + noTick - 1000
                uint256 surplusPerShare = uint256(yesTick) + uint256(noTick) - NUM_TICKS;
                uint256 surplus = (surplusPerShare * uint256(fill)) / NUM_TICKS;

                // Settlement: auto-mint a complete set, distribute tokens
                // YES token → YES buyer, NO token → NO buyer
                balances[marketKey][msg.sender][takerSide] += fill;

                if (maker.escrow) {
                    // Maker escrowed opposite tokens — they want to exit
                    // Auto-merge: their escrowed tokens + newly minted = collateral back
                    uint256 makerPayout = (uint256(oppTick) * uint256(fill)) / NUM_TICKS;
                    _collateralBacking[marketKey] -= makerPayout;
                    m.collateral.safeTransfer(maker.maker, makerPayout);
                } else {
                    // Normal fill: maker gets their outcome tokens
                    balances[marketKey][maker.maker][makerSide == 1 ? 1 : 0] += fill;
                }

                // Taker gets surplus as collateral refund
                if (surplus > 0) {
                    if (takerEscrow) {
                        // Taker was escrowing — surplus is extra collateral back
                        _collateralBacking[marketKey] -= surplus;
                        m.collateral.safeTransfer(msg.sender, surplus);
                    } else {
                        _collateralBacking[marketKey] -= surplus;
                        m.collateral.safeTransfer(msg.sender, surplus);
                    }
                }

                // Handle taker escrow: auto-merge taker's escrowed + received
                if (takerEscrow) {
                    // Taker escrowed opposite tokens and just received `fill` of their side
                    // Merge: reduce both balances, return collateral
                    // Actually the opposite tokens were already deducted in _buy
                    // And we just credited takerSide above
                    // So we need to merge: deduct the takerSide tokens we just gave, return collateral
                    uint256 takerPayout = (uint256(takerTick) * uint256(fill)) / NUM_TICKS;
                    balances[marketKey][msg.sender][takerSide] -= fill;
                    _collateralBacking[marketKey] -= takerPayout;
                    m.collateral.safeTransfer(msg.sender, takerPayout);
                }

                emit OrderFilled(marketKey, takerSide, yesTick, noTick, msg.sender, maker.maker, fill, surplus);

                maker.amount -= fill;
                remaining -= fill;

                if (maker.amount == 0) head++;
            }

            _orderHead[marketKey][makerSide][oppTick] = head;

            // Clear bitmap if tick exhausted
            if (_tickEmpty(marketKey, makerSide, oppTick)) {
                _bitmaps[marketKey][makerSide].clearBit(oppTick);
            }

            // Next lower opposite tick
            if (oppTick == 0) break;
            oppTick = _bitmaps[marketKey][makerSide].findNextDown(oppTick);
            if (oppTick > MAX_TICK) break;
        }
    }

    // ============================================
    // Internal Helpers
    // ============================================

    function _tickEmpty(bytes32 marketKey, uint8 side, uint16 tick) internal view returns (bool) {
        Order[] storage queue = _orders[marketKey][side][tick];
        uint256 head = _orderHead[marketKey][side][tick];
        for (uint256 i = head; i < queue.length; i++) {
            if (queue[i].amount > 0) return false;
        }
        return true;
    }

    function _advanceHead(bytes32 marketKey, uint8 side, uint16 tick) internal {
        Order[] storage queue = _orders[marketKey][side][tick];
        uint256 head = _orderHead[marketKey][side][tick];
        while (head < queue.length && queue[head].amount == 0) {
            head++;
        }
        _orderHead[marketKey][side][tick] = head;
    }

    // ============================================
    // Views
    // ============================================

    function getBalance(bytes32 marketKey, address user) external view returns (uint256 yes, uint256 no) {
        return (balances[marketKey][user][1], balances[marketKey][user][0]);
    }

    function getCollateralBacking(bytes32 marketKey) external view returns (uint256) {
        return _collateralBacking[marketKey];
    }

    function getBestTick(bytes32 marketKey, uint8 side) external view returns (uint16) {
        return _bitmaps[marketKey][side].findNextDown(MAX_TICK + 1);
    }

    function getOrdersAtTick(bytes32 marketKey, uint8 side, uint16 tick) 
        external view returns (uint256 totalAmount, uint256 orderCount) 
    {
        Order[] storage queue = _orders[marketKey][side][tick];
        uint256 head = _orderHead[marketKey][side][tick];
        for (uint256 i = head; i < queue.length; i++) {
            if (queue[i].amount > 0) {
                totalAmount += queue[i].amount;
                orderCount++;
            }
        }
    }

    function getImpliedPrice(bytes32 marketKey) external view returns (uint256 yesPrice, uint256 noPrice) {
        uint16 bestYes = _bitmaps[marketKey][1].findNextDown(MAX_TICK + 1);
        uint16 bestNo = _bitmaps[marketKey][0].findNextDown(MAX_TICK + 1);

        if (bestYes <= MAX_TICK) {
            yesPrice = (uint256(bestYes) * WAD) / NUM_TICKS;
        }
        if (bestNo <= MAX_TICK) {
            noPrice = (uint256(bestNo) * WAD) / NUM_TICKS;
        }
    }
}
