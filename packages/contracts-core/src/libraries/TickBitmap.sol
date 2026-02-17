// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TickBitmap
 * @notice Gas-optimized two-level bitmap for tick discovery
 * @dev Architecture: 1,000 ticks in 4 words (256 bits each)
 *      - Level 1: 4 bits (one per word)
 *      - Level 2: 4 words × 256 bits each (only ~250 bits used per word)
 *
 *      Optimizations:
 *      1. Assembly-optimized LSB/MSB (Uniswap V3 pattern)
 *      2. Unchecked arithmetic where overflow is impossible
 *      3. Custom errors instead of require strings
 *      4. 256-bit word size (EVM native)
 */
library TickBitmap {
    // ============================================
    // Errors
    // ============================================

    error TickOutOfRange();
    error ZeroValue();

    // ============================================
    // Constants
    // ============================================

    uint16 constant MAX_TICK = 999;
    uint16 constant WORD_SIZE = 256; // bits per word (standard EVM word)
    uint8 constant NUM_WORDS = 4;    // ceil(1000/256) = 4 words

    // ============================================
    // Structs
    // ============================================

    struct Bitmap {
        uint256 level1;                       // 4 bits indicating which words have liquidity
        mapping(uint8 => uint256) level2;     // 4 words of 256 bits each
    }

    // ============================================
    // Core Functions
    // ============================================

    /**
     * @notice Set bit for tick (mark as having liquidity)
     * @dev Uses unchecked arithmetic - tick bounds verified at entry
     */
    function setBit(Bitmap storage bitmap, uint16 tick) internal {
        if (tick > MAX_TICK) revert TickOutOfRange();

        unchecked {
            uint8 wordIndex = uint8(tick >> 8);  // tick / 256
            uint8 bitIndex = uint8(tick & 0xFF); // tick % 256
            uint256 bitMask = uint256(1) << uint256(bitIndex);

            // Set level 2 bit
            bitmap.level2[wordIndex] |= bitMask;

            // Set level 1 bit
            bitmap.level1 |= (uint256(1) << uint256(wordIndex));
        }
    }

    /**
     * @notice Clear bit for tick (mark as no liquidity)
     */
    function clearBit(Bitmap storage bitmap, uint16 tick) internal {
        if (tick > MAX_TICK) revert TickOutOfRange();

        unchecked {
            uint8 wordIndex = uint8(tick >> 8);
            uint8 bitIndex = uint8(tick & 0xFF);
            uint256 bitMask = uint256(1) << uint256(bitIndex);

            // Clear level 2 bit
            bitmap.level2[wordIndex] &= ~bitMask;

            // If word is now empty, clear level 1 bit
            if (bitmap.level2[wordIndex] == 0) {
                bitmap.level1 &= ~(uint256(1) << uint256(wordIndex));
            }
        }
    }

    /**
     * @notice Check if tick has liquidity
     */
    function isSet(Bitmap storage bitmap, uint16 tick) internal view returns (bool) {
        if (tick > MAX_TICK) revert TickOutOfRange();

        unchecked {
            uint8 wordIndex = uint8(tick >> 8);
            uint8 bitIndex = uint8(tick & 0xFF);
            uint256 bitMask = uint256(1) << uint256(bitIndex);
            return (bitmap.level2[wordIndex] & bitMask) != 0;
        }
    }

    /**
     * @notice Find next tick with liquidity (upward search)
     * @param bitmap Bitmap storage reference
     * @param startTick Starting tick (exclusive)
     * @return nextTick Next tick with liquidity (returns MAX_TICK+1 if none)
     */
    function findNextUp(Bitmap storage bitmap, uint16 startTick)
        internal
        view
        returns (uint16 nextTick)
    {
        if (startTick >= MAX_TICK) return MAX_TICK + 1;

        unchecked {
            uint16 searchTick = startTick + 1;
            uint8 wordIndex = uint8(searchTick >> 8);
            uint8 bitIndex = uint8(searchTick & 0xFF);

            // Search within current word first
            uint256 word = bitmap.level2[wordIndex];
            uint256 mask = ~((uint256(1) << uint256(bitIndex)) - 1); // Mask bits >= bitIndex
            uint256 masked = word & mask;

            if (masked != 0) {
                uint8 bit = leastSignificantBit(masked);
                nextTick = uint16(wordIndex) * WORD_SIZE + bit;
                return nextTick > MAX_TICK ? MAX_TICK + 1 : nextTick;
            }

            // Search level 1 for next non-empty word
            uint256 level1Mask = ~((uint256(1) << (uint256(wordIndex) + 1)) - 1);
            uint256 level1Masked = bitmap.level1 & level1Mask;

            if (level1Masked == 0) {
                return MAX_TICK + 1;
            }

            // Find next non-empty word
            uint8 nextWordIndex = leastSignificantBit(level1Masked);

            // Find first bit in that word
            uint256 nextWord = bitmap.level2[nextWordIndex];
            uint8 nextBit = leastSignificantBit(nextWord);

            nextTick = uint16(nextWordIndex) * WORD_SIZE + nextBit;
            return nextTick > MAX_TICK ? MAX_TICK + 1 : nextTick;
        }
    }

    /**
     * @notice Find next tick with liquidity (downward search)
     * @param bitmap Bitmap storage reference
     * @param startTick Starting tick (exclusive)
     * @return nextTick Next tick with liquidity (returns MAX_TICK+1 if none found)
     */
    function findNextDown(Bitmap storage bitmap, uint16 startTick)
        internal
        view
        returns (uint16 nextTick)
    {
        if (startTick == 0) return MAX_TICK + 1;

        unchecked {
            uint16 searchTick = startTick - 1;
            uint8 wordIndex = uint8(searchTick >> 8);
            uint8 bitIndex = uint8(searchTick & 0xFF);

            // Search within current word first
            uint256 word = bitmap.level2[wordIndex];
            uint256 mask = (uint256(1) << (uint256(bitIndex) + 1)) - 1; // Mask bits <= bitIndex
            uint256 masked = word & mask;

            if (masked != 0) {
                uint8 bit = mostSignificantBit(masked);
                return uint16(wordIndex) * WORD_SIZE + bit;
            }

            // Search level 1 for previous non-empty word
            if (wordIndex == 0) {
                return MAX_TICK + 1;
            }

            uint256 level1Mask = (uint256(1) << uint256(wordIndex)) - 1;
            uint256 level1Masked = bitmap.level1 & level1Mask;

            if (level1Masked == 0) {
                return MAX_TICK + 1;
            }

            // Find previous non-empty word
            uint8 prevWordIndex = mostSignificantBit(level1Masked);

            // Find last bit in that word
            uint256 prevWord = bitmap.level2[prevWordIndex];
            uint8 prevBit = mostSignificantBit(prevWord);

            return uint16(prevWordIndex) * WORD_SIZE + prevBit;
        }
    }

    // ============================================
    // Assembly-Optimized Bit Math (Uniswap V3/V4 Pattern)
    // ============================================

    /**
     * @notice Find least significant bit using binary search
     * @dev Matches Uniswap V3 BitMath.leastSignificantBit pattern
     */
    function leastSignificantBit(uint256 x) internal pure returns (uint8 r) {
        if (x == 0) revert ZeroValue();

        assembly {
            // Binary search for LSB position
            // x & -x isolates the LSB
            let lsb := and(x, sub(0, x))

            // Check each power of 2 range
            r := 0

            // If no bits in lower 128, LSB is in upper 128
            if iszero(and(lsb, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)) {
                r := 128
                lsb := shr(128, lsb)
            }

            if iszero(and(lsb, 0xFFFFFFFFFFFFFFFF)) {
                r := add(r, 64)
                lsb := shr(64, lsb)
            }

            if iszero(and(lsb, 0xFFFFFFFF)) {
                r := add(r, 32)
                lsb := shr(32, lsb)
            }

            if iszero(and(lsb, 0xFFFF)) {
                r := add(r, 16)
                lsb := shr(16, lsb)
            }

            if iszero(and(lsb, 0xFF)) {
                r := add(r, 8)
                lsb := shr(8, lsb)
            }

            if iszero(and(lsb, 0xF)) {
                r := add(r, 4)
                lsb := shr(4, lsb)
            }

            if iszero(and(lsb, 0x3)) {
                r := add(r, 2)
                lsb := shr(2, lsb)
            }

            if iszero(and(lsb, 0x1)) {
                r := add(r, 1)
            }
        }
    }

    /**
     * @notice Find most significant bit using binary search
     * @dev Matches Uniswap V3 BitMath.mostSignificantBit
     */
    function mostSignificantBit(uint256 x) internal pure returns (uint8 r) {
        if (x == 0) revert ZeroValue();

        unchecked {
            if (x >= 2 ** 128) {
                x >>= 128;
                r += 128;
            }
            if (x >= 2 ** 64) {
                x >>= 64;
                r += 64;
            }
            if (x >= 2 ** 32) {
                x >>= 32;
                r += 32;
            }
            if (x >= 2 ** 16) {
                x >>= 16;
                r += 16;
            }
            if (x >= 2 ** 8) {
                x >>= 8;
                r += 8;
            }
            if (x >= 2 ** 4) {
                x >>= 4;
                r += 4;
            }
            if (x >= 2 ** 2) {
                x >>= 2;
                r += 2;
            }
            if (x >= 2 ** 1) {
                r += 1;
            }
        }
    }

    // ============================================
    // Batch Operations (Gas Optimization)
    // ============================================

    /**
     * @notice Set multiple bits at once
     * @dev Useful when placing wide range orders
     */
    function setBitRange(Bitmap storage bitmap, uint16 tickLower, uint16 tickUpper) internal {
        if (tickLower > tickUpper || tickUpper > MAX_TICK) revert TickOutOfRange();

        unchecked {
            uint8 wordLower = uint8(tickLower >> 8);
            uint8 wordUpper = uint8(tickUpper >> 8);

            if (wordLower == wordUpper) {
                // Same word - single update
                uint8 bitLower = uint8(tickLower & 0xFF);
                uint8 bitUpper = uint8(tickUpper & 0xFF);
                uint256 mask = ((uint256(1) << (uint256(bitUpper) - uint256(bitLower) + 1)) - 1) << bitLower;
                bitmap.level2[wordLower] |= mask;
                bitmap.level1 |= (uint256(1) << uint256(wordLower));
            } else {
                // Multiple words
                // First word: set bits from bitLower to 255
                uint8 bitLower = uint8(tickLower & 0xFF);
                bitmap.level2[wordLower] |= ~((uint256(1) << uint256(bitLower)) - 1);
                bitmap.level1 |= (uint256(1) << uint256(wordLower));

                // Middle words: set all bits
                for (uint8 w = wordLower + 1; w < wordUpper; w++) {
                    bitmap.level2[w] = type(uint256).max;
                    bitmap.level1 |= (uint256(1) << uint256(w));
                }

                // Last word: set bits from 0 to bitUpper
                uint8 bitUpper = uint8(tickUpper & 0xFF);
                bitmap.level2[wordUpper] |= (uint256(1) << (uint256(bitUpper) + 1)) - 1;
                bitmap.level1 |= (uint256(1) << uint256(wordUpper));
            }
        }
    }

    /**
     * @notice Get population count (number of set bits) in a word
     * @dev Useful for analytics
     */
    function popCount(uint256 x) internal pure returns (uint256 count) {
        assembly {
            // Brian Kernighan's algorithm
            for {} x {} {
                x := and(x, sub(x, 1))
                count := add(count, 1)
            }
        }
    }
}
