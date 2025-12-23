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
 * @dev Token-based venue with fungible concentrated liquidity
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

    /// @notice Tick data per market
    mapping(bytes32 => mapping(uint16 => TickData)) private _ticks;

    /// @notice User liquidity positions
    mapping(bytes32 => mapping(uint16 => mapping(address => uint256))) private _userLiquidity;

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
    function swap(
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

        // Execute swap across ticks
        while (remainingIn > 0) {
            // Find next tick with liquidity (including current tick)
            uint16 nextTick;
            
            // First, check if current tick has liquidity
            if (_bitmaps[marketKey].isSet(currentTick)) {
                nextTick = currentTick;
            } else {
                // Search for next tick
                nextTick = isBuy 
                    ? _bitmaps[marketKey].findNextUp(currentTick)
                    : _bitmaps[marketKey].findNextDown(currentTick);
            }

            if (nextTick > MAX_TICK) break; // No more liquidity
            if (isBuy && nextTick > limitTick) break; // Hit limit
            if (!isBuy && nextTick < limitTick) break; // Hit limit

            // Get tick data
            TickData storage tickData = _ticks[marketKey][nextTick];
            
            // Calculate reserves
            uint256 reserveIn = isBuy ? tickData.liquidityNO : tickData.liquidityYES;
            uint256 reserveOut = isBuy ? tickData.liquidityYES : tickData.liquidityNO;

            if (reserveOut == 0) {
                currentTick = nextTick;
                continue;
            }

            // Determine how much we can swap at this tick
            uint256 maxOut = reserveOut; // Maximum output available
            uint256 amountInAtTick;
            uint256 amountOutAtTick;
            
            // Check if we can fill entire order at this tick
            uint256 potentialOut = TickMath.getAmountOut(reserveIn, reserveOut, remainingIn);
            
            if (potentialOut < maxOut) {
                // Partial fill - consume all remaining input
                amountInAtTick = remainingIn;
                amountOutAtTick = potentialOut;
            } else {
                // Full tick consumption - calculate input needed
                amountOutAtTick = maxOut - 1; // Leave 1 wei to avoid division by zero
                amountInAtTick = TickMath.getAmountIn(reserveIn, reserveOut, amountOutAtTick);
                
                // Ensure we don't exceed remaining input
                if (amountInAtTick > remainingIn) {
                    amountInAtTick = remainingIn;
                    amountOutAtTick = TickMath.getAmountOut(reserveIn, reserveOut, amountInAtTick);
                }
            }

            // Apply fee (0.2% taker fee)
            uint256 fee = (amountOutAtTick * TAKER_FEE_BPS) / 10000;
            amountOutAtTick -= fee;

            // Update tick liquidity
            if (isBuy) {
                tickData.liquidityNO = uint128(reserveIn + amountInAtTick);
                tickData.liquidityYES = uint128(reserveOut - amountOutAtTick - fee);
            } else {
                tickData.liquidityYES = uint128(reserveIn + amountInAtTick);
                tickData.liquidityNO = uint128(reserveOut - amountOutAtTick - fee);
            }

            // Check if tick is exhausted
            if (tickData.liquidityYES <= 1 || tickData.liquidityNO <= 1) {
                _bitmaps[marketKey].clearBit(nextTick);
            }

            totalOut += amountOutAtTick;
            totalFee += fee;
            remainingIn -= amountInAtTick;

            // Move to next tick for next iteration
            if (remainingIn > 0) {
                currentTick = isBuy 
                    ? _bitmaps[marketKey].findNextUp(nextTick)
                    : _bitmaps[marketKey].findNextDown(nextTick);
                    
                if (currentTick > MAX_TICK) break; // No more ticks
            } else {
                currentTick = nextTick;
            }
        }

        require(totalOut > 0, "TickBook: insufficient liquidity");

        // Update current tick
        _currentTick[marketKey] = currentTick;

        // Transfer tokens
        IERC20 tokenIn = isBuy ? IERC20(market.noToken) : IERC20(market.yesToken);
        IERC20 tokenOut = isBuy ? IERC20(market.yesToken) : IERC20(market.noToken);

        tokenIn.safeTransferFrom(msg.sender, address(this), amountIn);
        tokenOut.safeTransfer(msg.sender, totalOut);

        emit Swap(
            msg.sender,
            marketKey,
            isBuy,
            amountIn,
            totalOut,
            startTick,
            currentTick,
            totalFee
        );

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
        // Simplified quote calculation
        // In production, would walk ticks like swap()
        uint16 currentTick = _currentTick[marketKey];
        TickData memory tickData = _ticks[marketKey][currentTick];

        uint256 reserveIn = isBuy ? tickData.liquidityNO : tickData.liquidityYES;
        uint256 reserveOut = isBuy ? tickData.liquidityYES : tickData.liquidityNO;

        if (reserveOut == 0) {
            return SwapResult(0, currentTick, 0);
        }

        uint256 amountOut = TickMath.getAmountOut(reserveIn, reserveOut, amountIn);
        uint256 fee = (amountOut * TAKER_FEE_BPS) / 10000;

        result = SwapResult({
            amountOut: amountOut - fee,
            finalTick: currentTick,
            feeAmount: fee
        });
    }

    // ============================================
    // Liquidity Management
    // ============================================

    /**
     * @inheritdoc ITickBook
     */
    function addLiquidity(
        bytes32 marketKey,
        uint16 tickIndex,
        uint256 amount
    ) external override {
        require(amount > 0, "TickBook: zero amount");
        require(tickIndex <= MAX_TICK, "TickBook: tick out of range");

        Market memory market = _markets[marketKey];
        require(market.isActive, "TickBook: not active");

        // Transfer tokens from user (equal YES and NO)
        IERC20(market.yesToken).safeTransferFrom(msg.sender, address(this), amount);
        IERC20(market.noToken).safeTransferFrom(msg.sender, address(this), amount);

        // Update tick data
        TickData storage tickData = _ticks[marketKey][tickIndex];
        tickData.liquidityYES += uint128(amount);
        tickData.liquidityNO += uint128(amount);

        // Update bitmap
        _bitmaps[marketKey].setBit(tickIndex);

        // Track user position
        _userLiquidity[marketKey][tickIndex][msg.sender] += amount;

        emit LiquidityAdded(msg.sender, marketKey, tickIndex, amount);
    }

    /**
     * @inheritdoc ITickBook
     */
    function removeLiquidity(
        bytes32 marketKey,
        uint16 tickIndex,
        uint256 amount
    ) external override returns (uint256 yesAmount, uint256 noAmount) {
        require(amount > 0, "TickBook: zero amount");
        require(_userLiquidity[marketKey][tickIndex][msg.sender] >= amount, "TickBook: insufficient liquidity");

        Market memory market = _markets[marketKey];
        TickData storage tickData = _ticks[marketKey][tickIndex];

        // Calculate proportional withdrawal
        uint256 totalLiquidity = _userLiquidity[marketKey][tickIndex][msg.sender];
        yesAmount = (uint256(tickData.liquidityYES) * amount) / totalLiquidity;
        noAmount = (uint256(tickData.liquidityNO) * amount) / totalLiquidity;

        // Update tick data
        tickData.liquidityYES -= uint128(yesAmount);
        tickData.liquidityNO -= uint128(noAmount);

        // Update user position
        _userLiquidity[marketKey][tickIndex][msg.sender] -= amount;

        // Update bitmap if tick is empty
        if (tickData.liquidityYES == 0 && tickData.liquidityNO == 0) {
            _bitmaps[marketKey].clearBit(tickIndex);
        }

        // Transfer tokens to user
        IERC20(market.yesToken).safeTransfer(msg.sender, yesAmount);
        IERC20(market.noToken).safeTransfer(msg.sender, noAmount);

        emit LiquidityRemoved(msg.sender, marketKey, tickIndex, amount, yesAmount, noAmount);
    }

    // ============================================
    // View Functions
    // ============================================

    /**
     * @inheritdoc ITickBook
     */
    function getTick(bytes32 marketKey, uint16 tickIndex)
        external
        view
        override
        returns (TickData memory data)
    {
        return _ticks[marketKey][tickIndex];
    }

    /**
     * @inheritdoc ITickBook
     */
    function getCurrentTick(bytes32 marketKey)
        external
        view
        override
        returns (uint16 tickIndex, uint256 probability)
    {
        tickIndex = _currentTick[marketKey];
        probability = TickMath.tickToProbability(tickIndex);
    }

    /**
     * @inheritdoc ITickBook
     */
    function findNextActiveTick(
        bytes32 marketKey,
        uint16 startTick,
        bool isBuy
    ) external view override returns (uint16 nextTick) {
        return isBuy
            ? _bitmaps[marketKey].findNextUp(startTick)
            : _bitmaps[marketKey].findNextDown(startTick);
    }

    /**
     * @inheritdoc ITickBook
     */
    function getMarketInfo(bytes32 marketKey)
        external
        view
        override
        returns (
            address market,
            address yesToken,
            address noToken,
            bool isActive
        )
    {
        Market memory m = _markets[marketKey];
        return (m.truthMarket, m.yesToken, m.noToken, m.isActive);
    }

    /**
     * @inheritdoc ITickBook
     */
    function getUserLiquidity(
        bytes32 marketKey,
        uint16 tickIndex,
        address provider
    ) external view override returns (uint256 liquidity) {
        return _userLiquidity[marketKey][tickIndex][provider];
    }

    /**
     * @inheritdoc ITickBook
     */
    function getAccruedFees(bytes32 marketKey, address recipient)
        external
        view
        override
        returns (uint256 amount)
    {
        // Fee tracking not implemented in this version
        return 0;
    }

    /**
     * @inheritdoc ITickBook
     */
    function claimFees(bytes32 marketKey) external override returns (uint256 amount) {
        // Fee claiming not implemented in this version
        return 0;
    }
}
