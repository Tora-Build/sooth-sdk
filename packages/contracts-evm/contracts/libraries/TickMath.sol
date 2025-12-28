// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TickMath
 * @notice Math library for Continuous Linear Tick calculations
 * @dev 1,000 ticks linear in probability space (0.1% precision)
 */
library TickMath {
    // ============================================
    // Constants
    // ============================================

    uint256 private constant WAD = 1e18;
    uint16 constant MAX_TICK = 999;
    uint16 constant NUM_TICKS = 1000;

    // ============================================
    // Tick ↔ Probability
    // ============================================

    /**
     * @notice Convert tick to probability
     * @dev p = tick / 1000
     * @param tick Tick index (0-999)
     * @return probability Probability in WAD (0-1e18)
     */
    function tickToProbability(uint16 tick) internal pure returns (uint256 probability) {
        require(tick <= MAX_TICK, "TickMath: tick out of range");
        return (uint256(tick) * WAD) / NUM_TICKS;
    }

    /**
     * @notice Convert probability to tick
     * @dev tick = floor(p * 1000)
     * @param probability Probability in WAD (0-1e18)
     * @return tick Tick index (0-999)
     */
    function probabilityToTick(uint256 probability) internal pure returns (uint16 tick) {
        require(probability <= WAD, "TickMath: probability out of range");
        uint256 tickRaw = (probability * NUM_TICKS) / WAD;
        if (tickRaw > MAX_TICK) tickRaw = MAX_TICK;
        return uint16(tickRaw);
    }

    // ============================================
    // Virtual Reserves
    // ============================================

    /**
     * @notice Calculate virtual YES reserves at tick
     * @dev x_YES = L * sqrt((1-p)/p) = L * sqrt((N-i)/i)
     * @param liquidity Liquidity amount L (WAD)
     * @param tick Tick index (0-999)
     * @return reserveYES Virtual YES reserves (WAD)
     */
    function getVirtualReserveYES(uint256 liquidity, uint16 tick)
        internal
        pure
        returns (uint256 reserveYES)
    {
        require(tick <= MAX_TICK && tick > 0, "TickMath: invalid tick");
        
        // sqrt((N-i)/i) where N=1000
        uint256 numerator = NUM_TICKS - uint256(tick);
        uint256 denominator = uint256(tick);
        
        // reserveYES = L * sqrt(numerator/denominator)
        uint256 ratio = (numerator * WAD) / denominator;
        uint256 sqrtRatio = sqrt(ratio);
        
        reserveYES = (liquidity * sqrtRatio) / WAD;
    }

    /**
     * @notice Calculate virtual NO reserves at tick
     * @dev y_NO = L * sqrt(p/(1-p)) = L * sqrt(i/(N-i))
     * @param liquidity Liquidity amount L (WAD)
     * @param tick Tick index (0-999)
     * @return reserveNO Virtual NO reserves (WAD)
     */
    function getVirtualReserveNO(uint256 liquidity, uint16 tick)
        internal
        pure
        returns (uint256 reserveNO)
    {
        require(tick <= MAX_TICK && tick < MAX_TICK, "TickMath: invalid tick");
        
        // sqrt(i/(N-i)) where N=1000
        uint256 numerator = uint256(tick);
        uint256 denominator = NUM_TICKS - uint256(tick);
        
        // reserveNO = L * sqrt(numerator/denominator)
        uint256 ratio = (numerator * WAD) / denominator;
        uint256 sqrtRatio = sqrt(ratio);
        
        reserveNO = (liquidity * sqrtRatio) / WAD;
    }

    // ============================================
    // Swap Math
    // ============================================

    /**
     * @notice Calculate output amount for swap at single tick
     * @dev Uses constant product: x * y = k
     * @param reserveIn Input token reserve (WAD)
     * @param reserveOut Output token reserve (WAD)
     * @param amountIn Input amount (WAD)
     * @return amountOut Output amount (WAD)
     */
    function getAmountOut(
        uint256 reserveIn,
        uint256 reserveOut,
        uint256 amountIn
    ) internal pure returns (uint256 amountOut) {
        require(amountIn > 0, "TickMath: zero input");
        require(reserveIn > 0 && reserveOut > 0, "TickMath: zero reserves");
        
        // amountOut = (reserveOut * amountIn) / (reserveIn + amountIn)
        uint256 numerator = reserveOut * amountIn;
        uint256 denominator = reserveIn + amountIn;
        
        amountOut = numerator / denominator;
    }

    /**
     * @notice Calculate input amount needed for desired output
     * @param reserveIn Input token reserve (WAD)
     * @param reserveOut Output token reserve (WAD)
     * @param amountOut Desired output amount (WAD)
     * @return amountIn Required input amount (WAD)
     */
    function getAmountIn(
        uint256 reserveIn,
        uint256 reserveOut,
        uint256 amountOut
    ) internal pure returns (uint256 amountIn) {
        require(amountOut > 0, "TickMath: zero output");
        require(amountOut < reserveOut, "TickMath: insufficient liquidity");
        require(reserveIn > 0 && reserveOut > 0, "TickMath: zero reserves");
        
        // amountIn = (reserveIn * amountOut) / (reserveOut - amountOut)
        uint256 numerator = reserveIn * amountOut;
        uint256 denominator = reserveOut - amountOut;
        
        amountIn = numerator / denominator + 1; // Round up
    }

    // ============================================
    // Math Helpers
    // ============================================

    /**
     * @notice Square root using Babylonian method
     * @param x Input value (WAD)
     * @return Square root (WAD)
     */
    function sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        
        // Initial guess
        uint256 z = (x + WAD) / 2;
        uint256 y = x;
        
        // Iterate until convergence
        while (z < y) {
            y = z;
            z = ((x * WAD) / z + z) / 2;
        }
        
        return y;
    }

    /**
     * @notice Calculate price impact for swap
     * @param reserveIn Input reserve before swap (WAD)
     * @param reserveOut Output reserve before swap (WAD)
     * @param amountIn Input amount (WAD)
     * @return priceImpact Price impact in basis points (0-10000)
     */
    function calculatePriceImpact(
        uint256 reserveIn,
        uint256 reserveOut,
        uint256 amountIn
    ) internal pure returns (uint256 priceImpact) {
        // Price before = reserveOut / reserveIn
        // Price after = (reserveOut - amountOut) / (reserveIn + amountIn)
        uint256 amountOut = getAmountOut(reserveIn, reserveOut, amountIn);
        
        uint256 priceBefore = (reserveOut * WAD) / reserveIn;
        uint256 priceAfter = ((reserveOut - amountOut) * WAD) / (reserveIn + amountIn);
        
        if (priceAfter >= priceBefore) return 0;
        
        // Impact = (priceBefore - priceAfter) / priceBefore * 10000
        uint256 delta = priceBefore - priceAfter;
        priceImpact = (delta * 10000) / priceBefore;
    }
}
