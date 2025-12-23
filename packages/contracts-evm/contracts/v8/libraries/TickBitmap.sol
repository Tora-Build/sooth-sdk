// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title TickBitmap
 * @notice Two-level bitmap for O(1) tick discovery in TickBook
 * @dev 10,000 ticks organized as 100 words × 100 bits
 *      Level 1: 100 bits (one per word)
 *      Level 2: 100 words × 100 bits each
 */
library TickBitmap {
    // ============================================
    // Constants
    // ============================================

    uint16 constant MAX_TICK = 9999;
    uint8 constant WORD_SIZE = 100; // bits per word

    // ============================================
    // Structs
    // ============================================

    struct Bitmap {
        uint256 level1;              // 100 bits indicating which words have liquidity
        mapping(uint8 => uint256) level2; // 100 words of 100 bits each
    }

    // ============================================
    // Core Functions
    // ============================================

    /**
     * @notice Set bit for tick (mark as having liquidity)
     * @param bitmap Bitmap storage reference
     * @param tick Tick index (0-9999)
     */
    function setBit(Bitmap storage bitmap, uint16 tick) internal {
        require(tick <= MAX_TICK, "TickBitmap: tick out of range");
        
        (uint8 wordIndex, uint8 bitIndex) = _position(tick);
        
        // Set level 2 bit
        bitmap.level2[wordIndex] |= (1 << bitIndex);
        
        // Set level 1 bit
        bitmap.level1 |= (1 << wordIndex);
    }

    /**
     * @notice Clear bit for tick (mark as no liquidity)
     * @param bitmap Bitmap storage reference
     * @param tick Tick index (0-9999)
     */
    function clearBit(Bitmap storage bitmap, uint16 tick) internal {
        require(tick <= MAX_TICK, "TickBitmap: tick out of range");
        
        (uint8 wordIndex, uint8 bitIndex) = _position(tick);
        
        // Clear level 2 bit
        bitmap.level2[wordIndex] &= ~(1 << bitIndex);
        
        // If word is now empty, clear level 1 bit
        if (bitmap.level2[wordIndex] == 0) {
            bitmap.level1 &= ~(1 << wordIndex);
        }
    }

    /**
     * @notice Check if tick has liquidity
     * @param bitmap Bitmap storage reference
     * @param tick Tick index (0-9999)
     * @return True if tick has liquidity
     */
    function isSet(Bitmap storage bitmap, uint16 tick) internal view returns (bool) {
        require(tick <= MAX_TICK, "TickBitmap: tick out of range");
        
        (uint8 wordIndex, uint8 bitIndex) = _position(tick);
        
        return (bitmap.level2[wordIndex] & (1 << bitIndex)) != 0;
    }

    /**
     * @notice Find next tick with liquidity (upward search for buys)
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
        
        (uint8 wordIndex, uint8 bitIndex) = _position(startTick + 1);
        
        // Search within current word first
        uint256 word = bitmap.level2[wordIndex];
        uint256 mask = ~((1 << bitIndex) - 1); // Mask bits >= bitIndex
        uint256 masked = word & mask;
        
        if (masked != 0) {
            // Found in current word
            uint8 bit = _leastSignificantBit(masked);
            return uint16(wordIndex) * WORD_SIZE + bit;
        }
        
        // Search level 1 for next non-empty word
        uint256 level1Mask = ~((1 << (wordIndex + 1)) - 1);
        uint256 level1Masked = bitmap.level1 & level1Mask;
        
        if (level1Masked == 0) {
            return MAX_TICK + 1; // No more ticks
        }
        
        // Find next non-empty word
        uint8 nextWordIndex = _leastSignificantBit(level1Masked);
        
        // Find first bit in that word
        uint256 nextWord = bitmap.level2[nextWordIndex];
        uint8 nextBit = _leastSignificantBit(nextWord);
        
        return uint16(nextWordIndex) * WORD_SIZE + nextBit;
    }

    /**
     * @notice Find next tick with liquidity (downward search for sells)
     * @param bitmap Bitmap storage reference
     * @param startTick Starting tick (exclusive)
     * @return nextTick Next tick with liquidity (returns 0 if none, wraps to MAX_TICK+1)
     */
    function findNextDown(Bitmap storage bitmap, uint16 startTick)
        internal
        view
        returns (uint16 nextTick)
    {
        if (startTick == 0) return MAX_TICK + 1;
        
        (uint8 wordIndex, uint8 bitIndex) = _position(startTick - 1);
        
        // Search within current word first
        uint256 word = bitmap.level2[wordIndex];
        uint256 mask = (1 << (bitIndex + 1)) - 1; // Mask bits <= bitIndex
        uint256 masked = word & mask;
        
        if (masked != 0) {
            // Found in current word
            uint8 bit = _mostSignificantBit(masked);
            return uint16(wordIndex) * WORD_SIZE + bit;
        }
        
        // Search level 1 for previous non-empty word
        if (wordIndex == 0) {
            return MAX_TICK + 1; // No more ticks
        }
        
        uint256 level1Mask = (1 << wordIndex) - 1;
        uint256 level1Masked = bitmap.level1 & level1Mask;
        
        if (level1Masked == 0) {
            return MAX_TICK + 1; // No more ticks
        }
        
        // Find previous non-empty word
        uint8 prevWordIndex = _mostSignificantBit(level1Masked);
        
        // Find last bit in that word
        uint256 prevWord = bitmap.level2[prevWordIndex];
        uint8 prevBit = _mostSignificantBit(prevWord);
        
        return uint16(prevWordIndex) * WORD_SIZE + prevBit;
    }

    // ============================================
    // Internal Helpers
    // ============================================

    /**
     * @notice Get word and bit position for tick
     * @param tick Tick index (0-9999)
     * @return wordIndex Word index (0-99)
     * @return bitIndex Bit index within word (0-99)
     */
    function _position(uint16 tick) private pure returns (uint8 wordIndex, uint8 bitIndex) {
        wordIndex = uint8(tick / WORD_SIZE);
        bitIndex = uint8(tick % WORD_SIZE);
    }

    /**
     * @notice Find least significant bit (rightmost 1)
     * @param x Input value (must be non-zero)
     * @return Position of LSB (0-255)
     */
    function _leastSignificantBit(uint256 x) private pure returns (uint8) {
        require(x != 0, "TickBitmap: zero value");
        
        uint8 pos = 0;
        if (x & type(uint128).max == 0) { pos += 128; x >>= 128; }
        if (x & type(uint64).max == 0) { pos += 64; x >>= 64; }
        if (x & type(uint32).max == 0) { pos += 32; x >>= 32; }
        if (x & type(uint16).max == 0) { pos += 16; x >>= 16; }
        if (x & type(uint8).max == 0) { pos += 8; x >>= 8; }
        if (x & 0xf == 0) { pos += 4; x >>= 4; }
        if (x & 0x3 == 0) { pos += 2; x >>= 2; }
        if (x & 0x1 == 0) { pos += 1; }
        
        return pos;
    }

    /**
     * @notice Find most significant bit (leftmost 1)
     * @param x Input value (must be non-zero)
     * @return Position of MSB (0-255)
     */
    function _mostSignificantBit(uint256 x) private pure returns (uint8) {
        require(x != 0, "TickBitmap: zero value");
        
        uint8 pos = 0;
        if (x >= 0x100000000000000000000000000000000) { pos += 128; x >>= 128; }
        if (x >= 0x10000000000000000) { pos += 64; x >>= 64; }
        if (x >= 0x100000000) { pos += 32; x >>= 32; }
        if (x >= 0x10000) { pos += 16; x >>= 16; }
        if (x >= 0x100) { pos += 8; x >>= 8; }
        if (x >= 0x10) { pos += 4; x >>= 4; }
        if (x >= 0x4) { pos += 2; x >>= 2; }
        if (x >= 0x2) { pos += 1; }
        
        return pos;
    }
}
