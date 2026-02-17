// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {TickBitmap} from "./libraries/TickBitmap.sol";
import {OutcomeToken} from "./OutcomeToken.sol";

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
 *
 *      YES/NO positions are ERC20 OutcomeTokens — transferable and composable.
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
    error MarketAlreadyExists();
    error InsufficientBalance();
    error OrderNotActive();
    error SlippageExceeded();
    error MarketNotFinalized();
    error NothingToRedeem();

    // ============================================
    // Types
    // ============================================

    struct Market {
        IERC20 collateral;
        OutcomeToken yesToken;
        OutcomeToken noToken;
        bool active;
        bool finalized;
        uint8 outcome; // 0 = NO wins, 1 = YES wins, 2 = invalid (50/50)
    }

    struct Order {
        uint64 id;
        address maker;
        uint128 amount;    // shares remaining
        bool escrow;       // true = escrowing opposite tokens for exit
    }

    struct OrderPointer {
        bytes32 marketKey;
        uint8 side;
        uint16 tick;
        uint32 index;
        bool exists;
    }

    // ============================================
    // Storage
    // ============================================

    // Market state
    mapping(bytes32 => Market) public markets;

    // Order books: marketKey => side (0=NO, 1=YES) => tick => orders (FIFO queue)
    mapping(bytes32 => mapping(uint8 => mapping(uint16 => Order[]))) private _orders;
    // Head pointer for FIFO (avoid shifting arrays)
    mapping(bytes32 => mapping(uint8 => mapping(uint16 => uint256))) private _orderHead;

    // Bitmaps: marketKey => side => bitmap
    mapping(bytes32 => mapping(uint8 => TickBitmap.Bitmap)) private _bitmaps;

    // Collateral backing: marketKey => total collateral held
    mapping(bytes32 => uint256) private _collateralBacking;

    // Order pointers for stable id-based cancel/lookups
    mapping(uint64 => OrderPointer) private _orderPointers;
    uint64 private _nextOrderId;

    // Escrowed tokens for orders: marketKey => side => tick => order index => escrowed
    // (tracked implicitly via Order.escrow + amount — tokens burned on order placement)

    // Fee
    uint24 public feeBps;
    address public feeRecipient;

    // ============================================
    // Events
    // ============================================

    event MarketCreated(bytes32 indexed marketKey, address collateral, address yesToken, address noToken);
    event OrderPlaced(bytes32 indexed marketKey, uint8 side, uint16 tick, address indexed maker, uint128 amount, bool escrow);
    event OrderPlacedV2(bytes32 indexed marketKey, uint8 side, uint16 tick, address indexed maker, uint128 amount, bool escrow, uint64 orderId);
    event OrderFilled(bytes32 indexed marketKey, uint8 takerSide, uint16 yesTick, uint16 noTick, address indexed taker, address indexed maker, uint128 amount, uint256 surplus);
    event OrderFilledV2(bytes32 indexed marketKey, uint8 takerSide, uint16 yesTick, uint16 noTick, address indexed taker, address indexed maker, uint128 amount, uint256 surplus, uint64 makerOrderId);
    event OrderCancelled(bytes32 indexed marketKey, uint8 side, uint16 tick, address indexed maker, uint128 amount);
    event OrderCancelledV2(bytes32 indexed marketKey, uint8 side, uint16 tick, address indexed maker, uint128 amount, uint64 orderId);
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

    function createMarket(
        bytes32 marketKey,
        address collateral,
        string calldata name
    ) external onlyOwner returns (address yesToken, address noToken) {
        if (markets[marketKey].active) revert MarketAlreadyExists();

        // Factory: auto-deploy YES/NO tokens with SoothBook as collateralizer
        OutcomeToken yes = new OutcomeToken(
            string.concat(name, " - YES"),
            string.concat("SOOTH-YES"),
            address(this),
            address(this),
            1
        );
        OutcomeToken no = new OutcomeToken(
            string.concat(name, " - NO"),
            string.concat("SOOTH-NO"),
            address(this),
            address(this),
            0
        );

        markets[marketKey] = Market({
            collateral: IERC20(collateral),
            yesToken: yes,
            noToken: no,
            active: true,
            finalized: false,
            outcome: 0
        });

        yesToken = address(yes);
        noToken = address(no);
        emit MarketCreated(marketKey, collateral, yesToken, noToken);
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
        if (!m.active || m.finalized) revert MarketNotActive();

        m.collateral.safeTransferFrom(msg.sender, address(this), amount);
        _collateralBacking[marketKey] += amount;

        m.yesToken.mint(msg.sender, amount);
        m.noToken.mint(msg.sender, amount);

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

        // Burn both tokens from user (reverts if insufficient)
        m.yesToken.burn(msg.sender, amount);
        m.noToken.burn(msg.sender, amount);

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

        _cancelAtIndex(marketKey, side, tick, idx);
    }

    /**
     * @notice Cancel a specific resting order by unique order id
     * @param orderId Unique protocol order id emitted in OrderPlacedV2
     */
    function cancelById(uint64 orderId) external nonReentrant {
        OrderPointer memory pointer = _orderPointers[orderId];
        if (!pointer.exists) revert OrderNotActive();

        Order[] storage queue = _orders[pointer.marketKey][pointer.side][pointer.tick];
        uint256 idx = uint256(pointer.index);
        if (idx >= queue.length) revert OrderNotActive();

        Order storage order = queue[idx];
        if (order.id != orderId || order.maker != msg.sender || order.amount == 0) revert OrderNotActive();

        _cancelAtIndex(pointer.marketKey, pointer.side, pointer.tick, idx);
    }

    function _cancelAtIndex(bytes32 marketKey, uint8 side, uint16 tick, uint256 idx) internal {
        Order[] storage queue = _orders[marketKey][side][tick];

        Order storage order = queue[idx];
        uint128 refundAmount = order.amount;
        bool wasEscrow = order.escrow;
        uint64 orderId = order.id;
        order.amount = 0;

        // Advance head if possible
        _advanceHead(marketKey, side, tick);

        // Clear bitmap if tick is empty
        if (_tickEmpty(marketKey, side, tick)) {
            _bitmaps[marketKey][side].clearBit(tick);
        }

        Market storage m = markets[marketKey];

        if (wasEscrow) {
            // Return escrowed opposite tokens (re-mint them)
            uint8 opposite = side == 1 ? 0 : 1;
            _mintOutcome(m, msg.sender, opposite, refundAmount);
        } else {
            // Return collateral: price = tick/1000
            uint256 refund = (uint256(refundAmount) * uint256(tick)) / NUM_TICKS;
            _collateralBacking[marketKey] -= refund;
            m.collateral.safeTransfer(msg.sender, refund);
        }

        emit OrderCancelled(marketKey, side, tick, msg.sender, refundAmount);
        emit OrderCancelledV2(marketKey, side, tick, msg.sender, refundAmount, orderId);
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

        uint256 yesBal = m.yesToken.balanceOf(msg.sender);
        uint256 noBal = m.noToken.balanceOf(msg.sender);
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

        // Burn all tokens
        if (yesBal > 0) m.yesToken.burn(msg.sender, yesBal);
        if (noBal > 0) m.noToken.burn(msg.sender, noBal);

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
            // Burn opposite tokens (escrow for exit)
            uint8 opposite = side == 1 ? 0 : 1;
            _burnOutcome(m, msg.sender, opposite, amount);
        } else {
            // Deposit collateral
            m.collateral.safeTransferFrom(msg.sender, address(this), cost);
            _collateralBacking[marketKey] += cost;
        }

        // Try to match against opposite side
        uint128 remaining = _match(marketKey, side, tick, amount, escrow);

        // Rest goes on the book
        if (remaining > 0) {
            uint64 orderId = ++_nextOrderId;
            uint32 orderIndex = uint32(_orders[marketKey][side][tick].length);
            _orders[marketKey][side][tick].push(Order({
                id: orderId,
                maker: msg.sender,
                amount: remaining,
                escrow: escrow
            }));
            _orderPointers[orderId] = OrderPointer({
                marketKey: marketKey,
                side: side,
                tick: tick,
                index: orderIndex,
                exists: true
            });
            _bitmaps[marketKey][side].setBit(tick);
            emit OrderPlaced(marketKey, side, tick, msg.sender, remaining, escrow);
            emit OrderPlacedV2(marketKey, side, tick, msg.sender, remaining, escrow, orderId);
        }
    }

    /**
     * @dev Match a taker order against the opposite book
     *      YES buyer at tick Y matches NO bids where Y + N >= 1000
     *      i.e., NO tick >= (1000 - Y)
     *
     *      Matching traverses from best (highest) opposite tick downward.
     *      Surplus = (yesTick + noTick - 1000) goes to taker as collateral.
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
        if (minOppTick > MAX_TICK) return remaining;

        // Find highest opposite tick
        uint16 oppTick = _bitmaps[marketKey][makerSide].findNextDown(MAX_TICK + 1);
        if (oppTick > MAX_TICK) return remaining;

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
                uint256 surplusTicks = uint256(yesTick) + uint256(noTick) - NUM_TICKS;
                uint256 surplus = (surplusTicks * uint256(fill)) / NUM_TICKS;

                // --- Settle maker ---
                if (maker.escrow) {
                    // Maker escrowed opposite tokens to exit position
                    // Their opposite tokens were burned on order placement
                    // They get collateral back at their price
                    uint256 makerPayout = (uint256(oppTick) * uint256(fill)) / NUM_TICKS;
                    _collateralBacking[marketKey] -= makerPayout;
                    m.collateral.safeTransfer(maker.maker, makerPayout);
                } else {
                    // Normal maker: gets their outcome tokens
                    _mintOutcome(m, maker.maker, makerSide, fill);
                }

                // --- Settle taker ---
                if (takerEscrow) {
                    // Taker escrowed opposite tokens to exit
                    // Their opposite tokens were burned in _buy
                    // They get collateral back at their price
                    uint256 takerPayout = (uint256(takerTick) * uint256(fill)) / NUM_TICKS;
                    _collateralBacking[marketKey] -= takerPayout;
                    m.collateral.safeTransfer(msg.sender, takerPayout);
                } else {
                    // Normal taker: gets their outcome tokens
                    _mintOutcome(m, msg.sender, takerSide, fill);
                }

                // Surplus to taker
                if (surplus > 0) {
                    _collateralBacking[marketKey] -= surplus;
                    m.collateral.safeTransfer(msg.sender, surplus);
                }

                emit OrderFilled(marketKey, takerSide, yesTick, noTick, msg.sender, maker.maker, fill, surplus);
                emit OrderFilledV2(marketKey, takerSide, yesTick, noTick, msg.sender, maker.maker, fill, surplus, maker.id);

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
    // Internal: Token Helpers
    // ============================================

    function _mintOutcome(Market storage m, address to, uint8 outcome, uint256 amount) internal {
        if (outcome == 1) {
            m.yesToken.mint(to, amount);
        } else {
            m.noToken.mint(to, amount);
        }
    }

    function _burnOutcome(Market storage m, address from, uint8 outcome, uint256 amount) internal {
        if (outcome == 1) {
            m.yesToken.burn(from, amount);
        } else {
            m.noToken.burn(from, amount);
        }
    }

    // ============================================
    // Internal: Book Helpers
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
        Market storage m = markets[marketKey];
        return (m.yesToken.balanceOf(user), m.noToken.balanceOf(user));
    }

    function getCollateralBacking(bytes32 marketKey) external view returns (uint256) {
        return _collateralBacking[marketKey];
    }

    function getBestTick(bytes32 marketKey, uint8 side) external view returns (uint16) {
        return _findBestActiveTick(marketKey, side);
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
        uint16 bestYes = _findBestActiveTick(marketKey, 1);
        uint16 bestNo = _findBestActiveTick(marketKey, 0);

        if (bestYes <= MAX_TICK) {
            yesPrice = (uint256(bestYes) * WAD) / NUM_TICKS;
        }
        if (bestNo <= MAX_TICK) {
            noPrice = (uint256(bestNo) * WAD) / NUM_TICKS;
        }
    }

    function _findBestActiveTick(bytes32 marketKey, uint8 side) internal view returns (uint16) {
        uint16 tick = _bitmaps[marketKey][side].findNextDown(MAX_TICK + 1);
        while (tick <= MAX_TICK && _tickEmpty(marketKey, side, tick)) {
            if (tick == 0) return MAX_TICK + 1;
            tick = _bitmaps[marketKey][side].findNextDown(tick);
        }
        return tick;
    }
}
