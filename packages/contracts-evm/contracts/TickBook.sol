// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ITickBook} from "./interfaces/ITickBook.sol";
import {ITruthMarket} from "./interfaces/ITruthMarket.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {TickBitmap} from "./libraries/TickBitmap.sol";
import {TickMath} from "./libraries/TickMath.sol";

/**
 * @title TickBook
 * @notice Continuous Linear Tick orderbook with 10,000 probability ticks
 * @dev Token-based venue with concentrated liquidity ranges (Uniswap V3 style)
 */
contract TickBook is ITickBook {
    using SafeERC20 for IERC20;
    using TickBitmap for TickBitmap.Bitmap;

    // ============================================
    // Constants
    // ============================================

    uint256 private constant WAD = 1e18;
    uint256 private constant TAKER_FEE_BPS = 20; // 0.2%
    uint16 private constant MAX_TICK = 9999;

    // ============================================
    // State Variables
    // ============================================

    /// @notice Market registry
    mapping(bytes32 => Market) private _markets;

    /// @notice Total depth L at each tick
    mapping(bytes32 => mapping(uint16 => uint128)) private _tickDepth;

    /// @notice Maker active order size at each tick
    mapping(bytes32 => mapping(uint16 => mapping(address => uint128))) private _makerOrders;

    /// @notice Tick bitmaps per market
    mapping(bytes32 => TickBitmap.Bitmap) private _bitmaps;

    /// @notice Current tick per market
    mapping(bytes32 => uint16) private _currentTick;

    struct Market {
        address truthMarket;
        address yesToken;
        address noToken;
        bool isActive;
    }

    // ============================================
    // Market Registration
    // ============================================

    /**
     * @inheritdoc ITickBook
     */
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

        // Initialize at 50/50 (tick 5000)
        _currentTick[marketKey] = 5000;

        return marketKey;
    }

    // ============================================
    // Trading
    // ============================================

    /**
     * @inheritdoc ITickBook
     */
    function executeMarketOrder(
        bytes32 marketKey,
        bool isBuy,
        uint256 amountIn,
        uint16 limitTick
    ) external override returns (uint256 amountOut) {
        Market memory market = _markets[marketKey];
        require(market.isActive, "TickBook: not active");
        require(ITruthMarket(market.truthMarket).isLive(), "TickBook: not live");
        require(amountIn > 0, "TickBook: zero amount");

        uint16 startTick = _currentTick[marketKey];
        uint256 remainingIn = amountIn;
        uint256 totalOut = 0;
        uint256 totalFee = 0;
        uint16 currentTick = startTick;

        while (remainingIn > 0) {
            uint16 nextTick;
            if (_bitmaps[marketKey].isSet(currentTick)) {
                nextTick = currentTick;
            } else {
                nextTick = isBuy 
                    ? _bitmaps[marketKey].findNextUp(currentTick)
                    : _bitmaps[marketKey].findNextDown(currentTick);
            }

            if (nextTick > MAX_TICK) break;
            if (isBuy && nextTick > limitTick) break;
            if (!isBuy && nextTick < limitTick) break;

            uint128 L = _tickDepth[marketKey][nextTick];
            if (L == 0) {
                currentTick = isBuy ? nextTick + 1 : (nextTick == 0 ? MAX_TICK + 1 : nextTick - 1);
                continue;
            }

            // Virtual reserves at tick i
            uint256 xv = TickMath.getVirtualReserveYES(L, nextTick);
            uint256 yv = TickMath.getVirtualReserveNO(L, nextTick);

            uint256 reserveIn = isBuy ? yv : xv;
            uint256 reserveOut = isBuy ? xv : yv;
            
            // Max real tokens available in this tick
            uint256 maxOut;
            if (isBuy) {
                uint256 xvNext = (nextTick == MAX_TICK) ? 0 : TickMath.getVirtualReserveYES(L, nextTick + 1);
                maxOut = xv - xvNext;
            } else {
                uint256 yvNext = (nextTick == 0) ? 0 : TickMath.getVirtualReserveNO(L, nextTick - 1);
                maxOut = yv - yvNext;
            }

            if (maxOut == 0) {
                _bitmaps[marketKey].clearBit(nextTick);
                currentTick = isBuy ? nextTick + 1 : (nextTick == 0 ? MAX_TICK + 1 : nextTick - 1);
                continue;
            }

            uint256 amountInAtTick;
            uint256 amountOutAtTick;
            uint256 potentialOut = TickMath.getAmountOut(reserveIn, reserveOut, remainingIn);

            if (potentialOut < maxOut) {
                amountInAtTick = remainingIn;
                amountOutAtTick = potentialOut;
            } else {
                amountOutAtTick = maxOut;
                amountInAtTick = TickMath.getAmountIn(reserveIn, reserveOut, amountOutAtTick);
                
                if (amountInAtTick > remainingIn) {
                    amountInAtTick = remainingIn;
                    amountOutAtTick = TickMath.getAmountOut(reserveIn, reserveOut, amountInAtTick);
                }
            }

            uint256 fee = (amountOutAtTick * TAKER_FEE_BPS) / 10000;
            amountOutAtTick -= fee;

            totalOut += amountOutAtTick;
            totalFee += fee;
            remainingIn -= amountInAtTick;

            if (amountOutAtTick + fee >= maxOut) {
                // Simplified: clear bit and assume entire depth at this tick was used.
                _bitmaps[marketKey].clearBit(nextTick);
                currentTick = isBuy ? nextTick + 1 : (nextTick == 0 ? MAX_TICK + 1 : nextTick - 1);
            } else {
                currentTick = nextTick;
                break; 
            }
        }

        require(totalOut > 0, "TickBook: insufficient depth");
        _currentTick[marketKey] = currentTick;

        IERC20 tokenIn = isBuy ? IERC20(market.noToken) : IERC20(market.yesToken);
        IERC20 tokenOut = isBuy ? IERC20(market.yesToken) : IERC20(market.noToken);

        tokenIn.safeTransferFrom(msg.sender, address(this), amountIn);
        tokenOut.safeTransfer(msg.sender, totalOut);

        emit MarketOrderExecuted(msg.sender, marketKey, isBuy, amountIn, totalOut, startTick, currentTick, totalFee);
        return totalOut;
    }

    /**
     * @inheritdoc ITickBook
     */
    function getQuote(
        bytes32 marketKey,
        bool isBuy,
        uint256 amountIn,
        uint16 limitTick
    ) external view override returns (SwapResult memory result) {
        uint256 remainingIn = amountIn;
        uint256 totalOut = 0;
        uint256 totalFee = 0;
        uint16 currentTick = _currentTick[marketKey];

        while (remainingIn > 0) {
            uint16 nextTick;
            if (_bitmaps[marketKey].isSet(currentTick)) {
                nextTick = currentTick;
            } else {
                nextTick = isBuy 
                    ? _bitmaps[marketKey].findNextUp(currentTick)
                    : _bitmaps[marketKey].findNextDown(currentTick);
            }

            if (nextTick > MAX_TICK) break;
            if (isBuy && nextTick > limitTick) break;
            if (!isBuy && nextTick < limitTick) break;

            uint128 L = _tickDepth[marketKey][nextTick];
            if (L == 0) {
                currentTick = isBuy ? nextTick + 1 : (nextTick == 0 ? MAX_TICK + 1 : nextTick - 1);
                continue;
            }

            uint256 xv = TickMath.getVirtualReserveYES(L, nextTick);
            uint256 yv = TickMath.getVirtualReserveNO(L, nextTick);
            uint256 reserveIn = isBuy ? yv : xv;
            uint256 reserveOut = isBuy ? xv : yv;
            
            uint256 maxOut;
            if (isBuy) {
                uint256 xvNext = (nextTick == MAX_TICK) ? 0 : TickMath.getVirtualReserveYES(L, nextTick + 1);
                maxOut = xv - xvNext;
            } else {
                uint256 yvNext = (nextTick == 0) ? 0 : TickMath.getVirtualReserveNO(L, nextTick - 1);
                maxOut = yv - yvNext;
            }

            if (maxOut == 0) {
                currentTick = isBuy ? nextTick + 1 : (nextTick == 0 ? MAX_TICK + 1 : nextTick - 1);
                continue;
            }

            uint256 amountInAtTick;
            uint256 amountOutAtTick;
            uint256 potentialOut = TickMath.getAmountOut(reserveIn, reserveOut, remainingIn);

            if (potentialOut < maxOut) {
                amountInAtTick = remainingIn;
                amountOutAtTick = potentialOut;
            } else {
                amountOutAtTick = maxOut;
                amountInAtTick = TickMath.getAmountIn(reserveIn, reserveOut, amountOutAtTick);
                if (amountInAtTick > remainingIn) {
                    amountInAtTick = remainingIn;
                    amountOutAtTick = TickMath.getAmountOut(reserveIn, reserveOut, amountInAtTick);
                }
            }

            uint256 fee = (amountOutAtTick * TAKER_FEE_BPS) / 10000;
            totalOut += amountOutAtTick - fee;
            totalFee += fee;
            remainingIn -= amountInAtTick;

            if (amountOutAtTick >= maxOut) {
                currentTick = isBuy ? nextTick + 1 : (nextTick == 0 ? MAX_TICK + 1 : nextTick - 1);
            } else {
                currentTick = nextTick;
                break;
            }
        }

        return SwapResult(totalOut, currentTick, totalFee);
    }

    // ============================================
    // Maker Order Management
    // ============================================

    /**
     * @inheritdoc ITickBook
     */
    function placeLimitOrder(
        bytes32 marketKey,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 amount
    ) public override returns (uint256 yesAmount, uint256 noAmount) {
        require(amount > 0, "TickBook: zero amount");
        require(tickLower <= tickUpper && tickUpper <= MAX_TICK, "TickBook: invalid range");
        Market memory market = _markets[marketKey];
        require(market.isActive, "TickBook: not active");

        uint16 currentTick = _currentTick[marketKey];

        if (currentTick <= tickLower) {
            uint256 xvUpperPlus1 = (tickUpper == MAX_TICK) ? 0 : TickMath.getVirtualReserveYES(amount, tickUpper + 1);
            yesAmount = TickMath.getVirtualReserveYES(amount, tickLower) - xvUpperPlus1;
        } else if (currentTick > tickUpper) {
            uint256 yvLowerMinus1 = (tickLower == 0) ? 0 : TickMath.getVirtualReserveNO(amount, tickLower - 1);
            noAmount = TickMath.getVirtualReserveNO(amount, tickUpper) - yvLowerMinus1;
        } else {
            uint256 xvUpperPlus1 = (tickUpper == MAX_TICK) ? 0 : TickMath.getVirtualReserveYES(amount, tickUpper + 1);
            uint256 yvLowerMinus1 = (tickLower == 0) ? 0 : TickMath.getVirtualReserveNO(amount, tickLower - 1);
            yesAmount = TickMath.getVirtualReserveYES(amount, currentTick) - xvUpperPlus1;
            noAmount = TickMath.getVirtualReserveNO(amount, currentTick - 1) - yvLowerMinus1;
        }

        if (yesAmount > 0) IERC20(market.yesToken).safeTransferFrom(msg.sender, address(this), yesAmount);
        if (noAmount > 0) IERC20(market.noToken).safeTransferFrom(msg.sender, address(this), noAmount);

        for (uint16 i = tickLower; i <= tickUpper; i++) {
            _tickDepth[marketKey][i] += uint128(amount);
            _makerOrders[marketKey][i][msg.sender] += uint128(amount);
            _bitmaps[marketKey].setBit(i);
        }

        emit LimitOrderPlaced(msg.sender, marketKey, tickLower, tickUpper, amount, yesAmount, noAmount);
    }

    /**
     * @inheritdoc ITickBook
     */
    function cancelLimitOrder(
        bytes32 marketKey,
        uint16 tickLower,
        uint16 tickUpper,
        uint256 amount
    ) public override returns (uint256 yesAmount, uint256 noAmount) {
        require(amount > 0, "TickBook: zero amount");
        Market memory market = _markets[marketKey];

        uint16 currentTick = _currentTick[marketKey];
        
        if (currentTick <= tickLower) {
            uint256 xvUpperPlus1 = (tickUpper == MAX_TICK) ? 0 : TickMath.getVirtualReserveYES(amount, tickUpper + 1);
            yesAmount = TickMath.getVirtualReserveYES(amount, tickLower) - xvUpperPlus1;
        } else if (currentTick > tickUpper) {
            uint256 yvLowerMinus1 = (tickLower == 0) ? 0 : TickMath.getVirtualReserveNO(amount, tickLower - 1);
            noAmount = TickMath.getVirtualReserveNO(amount, tickUpper) - yvLowerMinus1;
        } else {
            uint256 xvUpperPlus1 = (tickUpper == MAX_TICK) ? 0 : TickMath.getVirtualReserveYES(amount, tickUpper + 1);
            uint256 yvLowerMinus1 = (tickLower == 0) ? 0 : TickMath.getVirtualReserveNO(amount, tickLower - 1);
            yesAmount = TickMath.getVirtualReserveYES(amount, currentTick) - xvUpperPlus1;
            noAmount = TickMath.getVirtualReserveNO(amount, currentTick - 1) - yvLowerMinus1;
        }

        for (uint16 i = tickLower; i <= tickUpper; i++) {
            require(_makerOrders[marketKey][i][msg.sender] >= amount, "TickBook: insufficient order size");
            _tickDepth[marketKey][i] -= uint128(amount);
            _makerOrders[marketKey][i][msg.sender] -= uint128(amount);
            if (_tickDepth[marketKey][i] == 0) {
                _bitmaps[marketKey].clearBit(i);
            }
        }

        if (yesAmount > 0) IERC20(market.yesToken).safeTransfer(msg.sender, yesAmount);
        if (noAmount > 0) IERC20(market.noToken).safeTransfer(msg.sender, noAmount);

        emit LimitOrderCancelled(msg.sender, marketKey, tickLower, tickUpper, amount, yesAmount, noAmount);
    }

    // ============================================
    // View Functions
    // ============================================

    function getTick(bytes32 marketKey, uint16 tickIndex) external view override returns (TickData memory data) {
        uint128 L = _tickDepth[marketKey][tickIndex];
        return TickData({
            liquidityYES: uint128(TickMath.getVirtualReserveYES(L, tickIndex)),
            liquidityNO: uint128(TickMath.getVirtualReserveNO(L, tickIndex))
        });
    }

    function getCurrentTick(bytes32 marketKey) public view override returns (uint16 tickIndex, uint256 probability) {
        tickIndex = _currentTick[marketKey];
        probability = TickMath.tickToProbability(tickIndex);
    }

    function findNextActiveTick(bytes32 marketKey, uint16 startTick, bool isBuy) external view override returns (uint16 nextTick) {
        return isBuy ? _bitmaps[marketKey].findNextUp(startTick) : _bitmaps[marketKey].findNextDown(startTick);
    }

    function getMarketInfo(bytes32 marketKey) external view override returns (address market, address yesToken, address noToken, bool isActive) {
        Market memory m = _markets[marketKey];
        return (m.truthMarket, m.yesToken, m.noToken, m.isActive);
    }

    function getLimitOrder(bytes32 marketKey, uint16 tickLower, uint16 tickUpper, address maker) external view override returns (uint256 amount) {
        // For simplicity, we currently track liquidity per-tick in _makerOrders.
        // Returning depth at the lower tick as a proxy for the range order.
        return uint256(_makerOrders[marketKey][tickLower][maker]);
    }

    function getAccruedFees(bytes32 marketKey, address recipient) external pure override returns (uint256 amount) { return 0; }
    function claimFees(bytes32 marketKey) external pure override returns (uint256 amount) { return 0; }
}
