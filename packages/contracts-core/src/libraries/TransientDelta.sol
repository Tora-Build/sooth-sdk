// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TransientDelta
 * @notice Flash accounting using EIP-1153 transient storage (Uniswap V4 pattern)
 * @dev Tracks token balance changes (deltas) within a single transaction.
 *      Changes are automatically cleared at transaction end.
 *
 * Benefits:
 * - TSTORE costs 100 gas vs SSTORE's 20,000 gas (200x cheaper)
 * - No need to clear storage after transaction
 * - Enables efficient multi-hop swaps without intermediate transfers
 *
 * Usage Pattern:
 * 1. At start of operation: record expected balance changes
 * 2. During operation: accumulate deltas
 * 3. At end: verify all deltas are settled (sum to zero)
 */
library TransientDelta {
    // ============================================
    // Errors
    // ============================================

    error DeltaNotSettled(address account, int256 remaining);
    error NonzeroDeltas(uint256 count);

    // ============================================
    // Constants
    // ============================================

    // Slot for counting non-zero deltas (enables O(1) settlement check)
    bytes32 private constant NONZERO_DELTA_COUNT_SLOT =
        keccak256("TickBookV2.TransientDelta.nonzeroDeltaCount");

    // ============================================
    // Core Functions
    // ============================================

    /**
     * @notice Get the current delta for an account
     * @param account The account to check
     * @return delta The current balance delta (positive = owed to protocol, negative = owed to account)
     */
    function getDelta(address account) internal view returns (int256 delta) {
        bytes32 slot = _deltaSlot(account);
        assembly ("memory-safe") {
            delta := tload(slot)
        }
    }

    /**
     * @notice Add to an account's delta
     * @param account The account to update
     * @param amount The amount to add (positive or negative)
     */
    function addDelta(address account, int256 amount) internal {
        if (amount == 0) return;

        bytes32 slot = _deltaSlot(account);
        int256 prev;
        int256 next;

        assembly ("memory-safe") {
            prev := tload(slot)
            next := add(prev, amount)
            tstore(slot, next)
        }

        // Update non-zero delta count
        _updateNonzeroCount(prev, next);
    }

    /**
     * @notice Set an account's delta to a specific value
     * @param account The account to update
     * @param amount The new delta value
     */
    function setDelta(address account, int256 amount) internal {
        bytes32 slot = _deltaSlot(account);
        int256 prev;

        assembly ("memory-safe") {
            prev := tload(slot)
            tstore(slot, amount)
        }

        _updateNonzeroCount(prev, amount);
    }

    /**
     * @notice Clear an account's delta (set to zero)
     * @param account The account to clear
     * @return prev The previous delta value
     */
    function clearDelta(address account) internal returns (int256 prev) {
        bytes32 slot = _deltaSlot(account);

        assembly ("memory-safe") {
            prev := tload(slot)
            tstore(slot, 0)
        }

        if (prev != 0) {
            _decrementNonzeroCount();
        }
    }

    // ============================================
    // Settlement Tracking
    // ============================================

    /**
     * @notice Get the count of accounts with non-zero deltas
     * @return count Number of unsettled accounts
     */
    function getNonzeroDeltaCount() internal view returns (uint256 count) {
        bytes32 slot = NONZERO_DELTA_COUNT_SLOT;
        assembly ("memory-safe") {
            count := tload(slot)
        }
    }

    /**
     * @notice Check if all deltas are settled
     * @return True if all deltas are zero
     */
    function isSettled() internal view returns (bool) {
        return getNonzeroDeltaCount() == 0;
    }

    /**
     * @notice Require that all deltas are settled
     * @dev Reverts if any account has non-zero delta
     */
    function requireSettled() internal view {
        uint256 count = getNonzeroDeltaCount();
        if (count != 0) revert NonzeroDeltas(count);
    }

    // ============================================
    // Internal Helpers
    // ============================================

    /**
     * @notice Calculate the transient storage slot for an account's delta
     * @param account The account address
     * @return slot The storage slot
     */
    function _deltaSlot(address account) private pure returns (bytes32 slot) {
        // Use account address as key, hashed to avoid collisions
        slot = keccak256(abi.encode("TickBookV2.TransientDelta.delta", account));
    }

    /**
     * @notice Update the non-zero delta count when a delta changes
     * @param prev Previous delta value
     * @param next New delta value
     */
    function _updateNonzeroCount(int256 prev, int256 next) private {
        bool wasZero = prev == 0;
        bool isZero = next == 0;

        if (wasZero && !isZero) {
            // Became non-zero: increment count
            _incrementNonzeroCount();
        } else if (!wasZero && isZero) {
            // Became zero: decrement count
            _decrementNonzeroCount();
        }
    }

    function _incrementNonzeroCount() private {
        bytes32 slot = NONZERO_DELTA_COUNT_SLOT;
        assembly ("memory-safe") {
            let count := tload(slot)
            tstore(slot, add(count, 1))
        }
    }

    function _decrementNonzeroCount() private {
        bytes32 slot = NONZERO_DELTA_COUNT_SLOT;
        assembly ("memory-safe") {
            let count := tload(slot)
            tstore(slot, sub(count, 1))
        }
    }
}

/**
 * @title TransientMarketDelta
 * @notice Extended delta tracking for market-specific balances
 * @dev Tracks deltas per (market, account, outcome) tuple
 */
library TransientMarketDelta {
    /**
     * @notice Get delta for a specific market position
     * @param market The market address
     * @param account The account
     * @param outcome The outcome (0 or 1)
     * @return delta The balance delta
     */
    function getMarketDelta(
        address market,
        address account,
        uint8 outcome
    ) internal view returns (int256 delta) {
        bytes32 slot = _marketDeltaSlot(market, account, outcome);
        assembly ("memory-safe") {
            delta := tload(slot)
        }
    }

    /**
     * @notice Add to a market position delta
     */
    function addMarketDelta(
        address market,
        address account,
        uint8 outcome,
        int256 amount
    ) internal {
        if (amount == 0) return;

        bytes32 slot = _marketDeltaSlot(market, account, outcome);
        assembly ("memory-safe") {
            let prev := tload(slot)
            tstore(slot, add(prev, amount))
        }
    }

    /**
     * @notice Clear a market position delta
     */
    function clearMarketDelta(
        address market,
        address account,
        uint8 outcome
    ) internal returns (int256 prev) {
        bytes32 slot = _marketDeltaSlot(market, account, outcome);
        assembly ("memory-safe") {
            prev := tload(slot)
            tstore(slot, 0)
        }
    }

    function _marketDeltaSlot(
        address market,
        address account,
        uint8 outcome
    ) private pure returns (bytes32) {
        return keccak256(abi.encode("TickBookV2.MarketDelta", market, account, outcome));
    }
}
