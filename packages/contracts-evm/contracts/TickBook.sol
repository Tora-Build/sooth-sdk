// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ITickBook} from "./interfaces/ITickBook.sol";
import {ITickBookVault} from "./interfaces/ITickBookVault.sol";
import {ITruthMarket} from "./interfaces/ITruthMarket.sol";
import {TickBitmap} from "./libraries/TickBitmap.sol";
import {TickMath} from "./libraries/TickMath.sol";

/**
 * @title TickBook
 * @notice Vault-native TickBook orderbook (ADR-051)
 * @dev Orders are funded by internal USDC balances in TickBookVault.
 *      This contract does NOT transfer/mint/burn ERC20 outcome tokens.
 */
contract TickBook is ITickBook {
    using TickBitmap for TickBitmap.Bitmap;

    uint256 private constant WAD = 1e18;

    uint16 private constant MIN_TICK = 1;
    uint16 private constant MAX_TICK = TickMath.MAX_TICK;
    uint16 private constant MAX_ORDER_TICK = TickMath.MAX_TICK; // ticks 1..999 (0.1% to 99.9%)

    ITickBookVault public immutable vault;

    struct Market {
        address truthMarket;
        address yesToken; // boundary-only metadata (Phase 2)
        address noToken;  // boundary-only metadata (Phase 2)
        bool isActive;
    }

    struct Order {
        address owner;
        uint8 outcome;      // 0 = NO, 1 = YES
        uint16 tick;        // YES probability tick (1..999)
        uint256 remaining;  // shares remaining (WAD)
        uint256 next;       // linked-list pointer
        bool active;
    }

    mapping(bytes32 => Market) private _markets;
    mapping(bytes32 => uint16) private _lastTick;

    // marketKey => outcome => tick => remaining shares depth
    mapping(bytes32 => mapping(uint8 => mapping(uint16 => uint128))) private _depth;
    mapping(bytes32 => mapping(uint8 => TickBitmap.Bitmap)) private _bitmaps;

    // marketKey => outcome => tick => linked list of order ids
    mapping(bytes32 => mapping(uint8 => mapping(uint16 => uint256))) private _head;
    mapping(bytes32 => mapping(uint8 => mapping(uint16 => uint256))) private _tail;

    // marketKey => orderId => Order
    mapping(bytes32 => mapping(uint256 => Order)) private _orders;
    mapping(bytes32 => mapping(address => uint256[])) private _userOrders;

    uint256 private _nextOrderId;

    constructor(address _vault) {
        require(_vault != address(0), "TickBook: zero vault");
        vault = ITickBookVault(_vault);
    }

    // ============================================
    // Market Registration
    // ============================================

    function registerMarket(
        address market,
        address yesToken,
        address noToken
    ) external override returns (bytes32 marketKey) {
        require(market != address(0), "TickBook: zero market");
        require(yesToken != address(0), "TickBook: zero yes token");
        require(noToken != address(0), "TickBook: zero no token");

        marketKey = keccak256(abi.encodePacked(market, yesToken, noToken));
        require(!_markets[marketKey].isActive, "TickBook: already registered");

        _markets[marketKey] = Market({
            truthMarket: market,
            yesToken: yesToken,
            noToken: noToken,
            isActive: true
        });

        // Initialize at ~50/50 (tick 500 on 1,000-tick scale)
        _lastTick[marketKey] = 500;
        return marketKey;
    }

    // ============================================
    // Orders
    // ============================================

    function placeLimitOrder(
        bytes32 marketKey,
        uint8 outcome,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 sharesPerTick
    ) external override returns (uint256 firstOrderId, uint256 orderCount) {
        Market memory m = _markets[marketKey];
        require(m.isActive, "TickBook: not active");
        require(ITruthMarket(m.truthMarket).isLive(), "TickBook: not live");
        require(outcome <= 1, "TickBook: invalid outcome");
        require(sharesPerTick > 0, "TickBook: zero shares");
        require(tickLower <= tickUpper, "TickBook: invalid range");
        require(tickLower >= MIN_TICK && tickUpper <= MAX_ORDER_TICK, "TickBook: tick out of range");

        uint256 totalReserve;
        firstOrderId = _nextOrderId + 1;
        orderCount = uint256(tickUpper) - uint256(tickLower) + 1;

        for (uint16 tick = tickLower; tick <= tickUpper; tick++) {
            uint256 orderId = ++_nextOrderId;

            // Append to per-tick queue
            uint256 tail = _tail[marketKey][outcome][tick];
            if (tail == 0) {
                _head[marketKey][outcome][tick] = orderId;
            } else {
                _orders[marketKey][tail].next = orderId;
            }
            _tail[marketKey][outcome][tick] = orderId;

            _orders[marketKey][orderId] = Order({
                owner: msg.sender,
                outcome: outcome,
                tick: tick,
                remaining: sharesPerTick,
                next: 0,
                active: true
            });
            _userOrders[marketKey][msg.sender].push(orderId);

            // Depth + bitmap
            _depth[marketKey][outcome][tick] += uint128(sharesPerTick);
            _bitmaps[marketKey][outcome].setBit(tick);

            totalReserve += _collateralFor(outcome, tick, sharesPerTick);

            // Prevent infinite loop on uint16
            if (tick == tickUpper) break;
        }

        vault.reserveUsdc(msg.sender, totalReserve);
        emit RangeOrderPlaced(msg.sender, marketKey, outcome, tickLower, tickUpper, sharesPerTick, totalReserve, firstOrderId, orderCount);
    }

    function cancelOrder(bytes32 marketKey, uint256 orderId)
        external
        override
        returns (uint256 remainingShares, uint256 collateralReleasedUsdcWad)
    {
        Order storage o = _orders[marketKey][orderId];
        require(o.active, "TickBook: inactive");
        require(o.owner == msg.sender, "TickBook: not owner");
        require(o.remaining > 0, "TickBook: empty");

        remainingShares = o.remaining;
        collateralReleasedUsdcWad = _collateralFor(o.outcome, o.tick, remainingShares);

        // Update depth/bitmap
        _depth[marketKey][o.outcome][o.tick] -= uint128(remainingShares);
        if (_depth[marketKey][o.outcome][o.tick] == 0) {
            _bitmaps[marketKey][o.outcome].clearBit(o.tick);
        }

        // Mark inactive and release collateral back to user (reserved → available)
        o.remaining = 0;
        o.active = false;
        vault.releaseUsdc(msg.sender, collateralReleasedUsdcWad);

        emit OrderCancelled(msg.sender, marketKey, orderId, o.outcome, o.tick, remainingShares, collateralReleasedUsdcWad);
    }

    // ============================================
    // Market Orders
    // ============================================

    function executeMarketOrder(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares,
        uint16 limitTick
    ) external override returns (uint256 sharesFilled, uint16 finalTick) {
        Market memory m = _markets[marketKey];
        require(m.isActive, "TickBook: not active");
        require(ITruthMarket(m.truthMarket).isLive(), "TickBook: not live");
        require(outcome <= 1, "TickBook: invalid outcome");
        require(shares > 0, "TickBook: zero shares");
        require(limitTick >= MIN_TICK && limitTick <= MAX_ORDER_TICK, "TickBook: tick out of range");

        uint16 startTick = _lastTick[marketKey];
        uint256 remaining = shares;

        if (outcome == 1) {
            // Buy YES: consume NO orders from lowest tick upward (best price first)
            uint16 cursor = 0;
            while (remaining > 0) {
                uint16 nextTick = _bitmaps[marketKey][0].findNextUp(cursor);
                if (nextTick > MAX_ORDER_TICK) break;
                if (nextTick > limitTick) break;

                uint256 filledAt = _fillAtTick(marketKey, m.truthMarket, nextTick, 1, remaining);
                sharesFilled += filledAt;
                remaining -= filledAt;
                finalTick = nextTick;

                cursor = nextTick;
                if (filledAt == 0) {
                    // If bitmap lied due to inactive head orders, advance cursor
                    cursor = nextTick;
                }
            }
        } else {
            // Buy NO: consume YES orders from highest tick downward (best price first for NO)
            uint16 cursor = MAX_TICK; // exclusive upper bound; findNextDown will start at MAX_TICK-1
            while (remaining > 0) {
                uint16 nextTick = _bitmaps[marketKey][1].findNextDown(cursor);
                if (nextTick > MAX_ORDER_TICK) break; // MAX_TICK+1 sentinel
                if (nextTick < limitTick) break;

                uint256 filledAt = _fillAtTick(marketKey, m.truthMarket, nextTick, 0, remaining);
                sharesFilled += filledAt;
                remaining -= filledAt;
                finalTick = nextTick;

                cursor = nextTick;
                if (filledAt == 0) {
                    cursor = nextTick;
                }
            }
        }

        require(sharesFilled > 0, "TickBook: insufficient depth");
        _lastTick[marketKey] = finalTick == 0 ? startTick : finalTick;
        emit MarketOrderExecuted(msg.sender, marketKey, outcome, shares, sharesFilled, startTick, _lastTick[marketKey]);
    }

    function getQuote(
        bytes32 marketKey,
        uint8 outcome,
        uint256 shares,
        uint16 limitTick
    ) external view override returns (QuoteResult memory result) {
        require(outcome <= 1, "TickBook: invalid outcome");
        require(shares > 0, "TickBook: zero shares");
        require(limitTick >= MIN_TICK && limitTick <= MAX_ORDER_TICK, "TickBook: tick out of range");

        uint256 remaining = shares;
        uint256 collateral;
        uint16 finalTickLocal;

        if (outcome == 1) {
            // Buy YES: consume NO depth from low → high
            for (uint16 tick = MIN_TICK; tick <= limitTick && remaining > 0; tick++) {
                uint256 available = uint256(_depth[marketKey][0][tick]);
                if (available == 0) continue;
                uint256 fill = available < remaining ? available : remaining;
                collateral += _collateralFor(1, tick, fill);
                remaining -= fill;
                finalTickLocal = tick;
            }
        } else {
            // Buy NO: consume YES depth from high → low
            for (uint16 tick = MAX_ORDER_TICK; tick >= limitTick && remaining > 0; tick--) {
                uint256 available = uint256(_depth[marketKey][1][tick]);
                if (available == 0) {
                    if (tick == limitTick) break;
                    continue;
                }
                uint256 fill = available < remaining ? available : remaining;
                collateral += _collateralFor(0, tick, fill);
                remaining -= fill;
                finalTickLocal = tick;
                if (tick == limitTick) break;
            }
        }

        result = QuoteResult({
            sharesFillable: shares - remaining,
            takerCollateralWad: collateral,
            finalTick: finalTickLocal
        });
    }

    // ============================================
    // Views
    // ============================================

    function getTick(bytes32 marketKey, uint16 tickIndex) external view override returns (TickData memory data) {
        return TickData({
            yesDepth: _depth[marketKey][1][tickIndex],
            noDepth: _depth[marketKey][0][tickIndex]
        });
    }

    function getCurrentTick(bytes32 marketKey) external view override returns (uint16 tickIndex, uint256 probability) {
        tickIndex = _lastTick[marketKey];
        probability = TickMath.tickToProbability(tickIndex);
    }

    function findNextActiveTick(
        bytes32 marketKey,
        uint16 startTick,
        bool isUp,
        uint8 outcome
    ) external view override returns (uint16 nextTick) {
        require(outcome <= 1, "TickBook: invalid outcome");
        return isUp
            ? _bitmaps[marketKey][outcome].findNextUp(startTick)
            : _bitmaps[marketKey][outcome].findNextDown(startTick);
    }

    function getMarketInfo(bytes32 marketKey) external view override returns (address market, address yesToken, address noToken, bool isActive) {
        Market memory m = _markets[marketKey];
        return (m.truthMarket, m.yesToken, m.noToken, m.isActive);
    }

    function getOrder(bytes32 marketKey, uint256 orderId) external view override returns (OrderView memory o) {
        Order memory ord = _orders[marketKey][orderId];
        return OrderView({
            owner: ord.owner,
            outcome: ord.outcome,
            tick: ord.tick,
            remaining: ord.remaining,
            active: ord.active
        });
    }

    function getUserOrders(bytes32 marketKey, address user) external view override returns (uint256[] memory orderIds) {
        return _userOrders[marketKey][user];
    }

    function getAccruedFees(bytes32, address) external pure override returns (uint256 amount) {
        return 0;
    }

    function claimFees(bytes32) external pure override returns (uint256 amount) {
        return 0;
    }

    // ============================================
    // Internal
    // ============================================

    function _fillAtTick(
        bytes32 marketKey,
        address market,
        uint16 tick,
        uint8 takerOutcome,
        uint256 maxShares
    ) internal returns (uint256 filled) {
        uint8 makerOutcome = takerOutcome == 1 ? 0 : 1;
        uint256 head = _head[marketKey][makerOutcome][tick];
        if (head == 0) {
            // Depth desync (shouldn't happen if bitmap/depth kept consistent)
            _bitmaps[marketKey][makerOutcome].clearBit(tick);
            return 0;
        }

        uint256 remaining = maxShares;
        uint256 currentId = head;

        // Ensure head points to an active order
        while (currentId != 0) {
            Order storage o = _orders[marketKey][currentId];
            if (o.active && o.remaining > 0) break;
            currentId = o.next;
        }
        _head[marketKey][makerOutcome][tick] = currentId;
        if (currentId == 0) {
            _depth[marketKey][makerOutcome][tick] = 0;
            _bitmaps[marketKey][makerOutcome].clearBit(tick);
            return 0;
        }

        uint256 pWad = TickMath.tickToProbability(tick);

        while (remaining > 0 && currentId != 0) {
            Order storage maker = _orders[marketKey][currentId];
            if (!maker.active || maker.remaining == 0) {
                currentId = maker.next;
                _head[marketKey][makerOutcome][tick] = currentId;
                continue;
            }

            uint256 fill = maker.remaining < remaining ? maker.remaining : remaining;

            // Split collateral exactly: yesPart = P * q, noPart = q - yesPart
            uint256 yesPart = (fill * pWad) / WAD;
            uint256 takerCollateral = (takerOutcome == 1) ? yesPart : (fill - yesPart);
            uint256 makerCollateral = fill - takerCollateral;

            // Consume collateral into market backing
            vault.spendAvailableToMarket(msg.sender, market, takerCollateral);
            vault.spendReservedToMarket(maker.owner, market, makerCollateral);

            // Credit internal outcome shares
            vault.creditOutcome(market, msg.sender, takerOutcome, fill);
            vault.creditOutcome(market, maker.owner, makerOutcome, fill);

            // Update order + depth
            maker.remaining -= fill;
            remaining -= fill;
            filled += fill;
            _depth[marketKey][makerOutcome][tick] -= uint128(fill);

            if (maker.remaining == 0) {
                maker.active = false;
                currentId = maker.next;
                _head[marketKey][makerOutcome][tick] = currentId;
            }
        }

        if (_depth[marketKey][makerOutcome][tick] == 0) {
            _bitmaps[marketKey][makerOutcome].clearBit(tick);
        }
    }

    function _collateralFor(uint8 outcome, uint16 tick, uint256 shares) internal pure returns (uint256) {
        uint256 pWad = TickMath.tickToProbability(tick);
        uint256 yesPart = (shares * pWad) / WAD;
        return outcome == 1 ? yesPart : (shares - yesPart);
    }
}
