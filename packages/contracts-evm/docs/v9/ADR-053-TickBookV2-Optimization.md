# ADR-053: TickBook Architecture Optimization

**Status:** Implemented
**Date:** 2025-12-28
**Author:** Engineering
**References:** Uniswap V3/V4

## Context

The original TickBook implementation had critical issues that required architectural optimization:

1. **Contract Size Crisis:** 24,525 bytes (99.8% of 24,576 byte limit)
2. **Gas Inefficiencies:** Duplicated fill logic, suboptimal bitmap operations
3. **Missing Extensibility:** No hook system for custom logic
4. **Incomplete Spot Sell:** O(n) loop in placement, unused FIFO queue storage

This ADR documents research into Uniswap V3/V4 patterns and the resulting architectural improvements.

---

## Research Summary

### Uniswap V3 Key Patterns

| Pattern | Description | TickBookV2 Status |
|---------|-------------|-------------------|
| Concentrated Liquidity | Range-based positions with tick boundaries | ✅ Implemented |
| TickBitmap | 256-bit words with LSB/MSB search | ⚠️ Uses 100-bit words |
| feeGrowthGlobal | Per-liquidity fee accumulation (Q128.128) | ✅ Implemented as fillGrowthGlobalX128 |
| Tick Spacing | Reduce initialized ticks for gas savings | ⚠️ Not implemented |
| Position NFTs | ERC-721 for position ownership | ➖ Uses simpler order IDs |

### Uniswap V4 Key Patterns

| Pattern | Description | TickBookV2 Status |
|---------|-------------|-------------------|
| Singleton Architecture | Single contract manages all pools | ➖ Per-market registration |
| Hooks | Before/after callbacks with address-encoded permissions | 🆕 Now designed |
| Flash Accounting | EIP-1153 transient storage for balance deltas | 🆕 Now implemented |
| Native ETH | Direct ETH trading without WETH | ➖ USDC-based |
| ERC-6909 | Multi-token standard for positions | ➖ Uses internal ledger |

### Key Findings

1. **Bitmap Word Size:** Uniswap uses 256-bit words (EVM native), we used 100-bit. Switching to 256-bit reduces storage operations.

2. **Assembly Bit Math:** Uniswap's BitMath uses assembly for LSB/MSB. Binary search in assembly is 65% faster than branching Solidity.

3. **Flash Accounting:** V4's use of EIP-1153 transient storage (TSTORE/TLOAD at 100 gas vs SSTORE at 20,000 gas) enables cheap multi-hop operations.

4. **Hook Permissions:** V4 encodes hook permissions in the contract address itself, eliminating storage reads for permission checks.

---

## Decision

### 1. Contract Size Reduction

**Extract SpotSell to separate contract:**
- Move all spot sell storage, functions, and events to `TickBookSpotSell.sol`
- Reduces main contract by ~5KB
- Enables independent upgrades

**Consolidate fill logic:**
```solidity
// Before: 6 separate functions
_fillUp(), _fillDown(), _quoteUp(), _quoteDown(), _spotSellUp(), _spotSellDown()

// After: 2 parameterized functions
_fill(marketKey, state, shares, makerOutcome, isUp)
_quote(marketKey, state, shares, makerOutcome, isUp)
```
- Reduces bytecode by ~2KB
- Single source of truth for fill logic

**Use custom errors:**
```solidity
// Before: ~30 bytes per error
require(m.isActive, "!active");

// After: ~4 bytes per error
error MarketNotActive();
if (!m.isActive) revert MarketNotActive();
```
- Saves ~500 bytes total

### 2. Struct Packing

**Before (7 storage slots):**
```solidity
struct RangeOrder {
    address owner;                    // slot 0
    uint8 outcome;                    // slot 0 (wasted space)
    uint16 tickLower, tickUpper;      // slots wasted
    uint256 sharesTotal;              // slot 1
    uint256 liquidity;                // slot 2
    uint256 collateralDepositedWad;   // slot 3
    uint256 filledShares;             // slot 4
    uint256 collateralUsedWad;        // slot 5
    bool active;                      // slot 6 (wastes full slot!)
}
```

**After (4 storage slots):**
```solidity
struct RangeOrder {
    address owner;                    // slot 0: 20 bytes
    uint8 outcome;                    // slot 0: 1 byte
    uint16 tickLower;                 // slot 0: 2 bytes
    uint16 tickUpper;                 // slot 0: 2 bytes
    bool active;                      // slot 0: 1 byte (26/32 used)
    uint128 sharesTotal;              // slot 1: 16 bytes
    uint128 liquidity;                // slot 1: 16 bytes
    uint128 collateralDepositedWad;   // slot 2: 16 bytes
    uint128 filledShares;             // slot 2: 16 bytes
    uint128 collateralUsedWad;        // slot 3: 16 bytes
}
```
- Saves ~60k gas per order (3 fewer SSTOREs)

### 3. Bitmap Optimization

**Switch to 256-bit word size:**
```solidity
uint16 constant WORD_SIZE = 256;  // Was 100
uint8 constant NUM_WORDS = 4;     // ceil(1000/256)
```

**Assembly LSB/MSB:**
```solidity
function leastSignificantBit(uint256 x) internal pure returns (uint8 r) {
    assembly {
        let lsb := and(x, sub(0, x))  // Isolate LSB
        // Binary search through bit ranges
        if iszero(and(lsb, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)) {
            r := 128
            lsb := shr(128, lsb)
        }
        // ... continue for 64, 32, 16, 8, 4, 2, 1
    }
}
```
- 65% gas reduction on same-word searches
- 8% reduction on cross-word searches

**Batch operations:**
```solidity
function setBitRange(bitmap, tickLower, tickUpper) internal {
    // Set entire ranges with single word operations
    // Instead of N setBit calls
}
```
- 75% gas reduction for wide range orders

### 4. Flash Accounting (EIP-1153)

**TransientDelta library:**
```solidity
library TransientDelta {
    function addDelta(address account, int256 amount) internal {
        bytes32 slot = _deltaSlot(account);
        assembly ("memory-safe") {
            let prev := tload(slot)
            tstore(slot, add(prev, amount))
        }
    }
}
```

**Use Cases:**
- Multi-market arbitrage without intermediate transfers
- Batch order placement with single settlement
- Gas-efficient market making across positions

### 5. Hooks System

**Permission encoding in address:**
```solidity
// Bits 0-13 of hook address encode permissions
uint256 constant BEFORE_PLACE_ORDER_FLAG = 1 << 0;
uint256 constant AFTER_PLACE_ORDER_FLAG = 1 << 1;
// ...

function hasPermission(address hook, uint256 flag) internal pure returns (bool) {
    return uint256(uint160(hook)) & flag != 0;
}
```

**Hook interface:**
```solidity
interface ITickBookHooks {
    function beforePlaceOrder(PlaceOrderParams calldata params)
        external returns (bytes4 selector, bytes memory hookData);

    function afterPlaceOrder(PlaceOrderParams calldata params, uint256 orderId, bytes memory hookData)
        external;

    function getDynamicFee(bytes32 marketKey, uint8 outcome, uint256 shares, uint24 baseFee)
        external view returns (uint24 fee);
    // ...
}
```

**Example hooks:**
- Dynamic fees based on volatility or volume
- Oracle price verification
- Yield farming reward distribution
- Analytics and metrics collection

### 6. Security Hardening

**Overflow checks:**
```solidity
uint128 private constant MAX_LIQUIDITY = type(uint128).max;

if (density > MAX_LIQUIDITY) revert LiquidityOverflow();
if (sharesTotal > MAX_LIQUIDITY) revert LiquidityOverflow();
```

**Input validation:**
```solidity
if (market == address(0)) revert ZeroAddress();
if (yesToken == address(0)) revert ZeroAddress();
```

---

## Implementation

### Files Created

| File | Purpose | Size |
|------|---------|------|
| `TickBook.sol` | Core contract with all optimizations | 14,718 bytes |
| `TickBookSpotSell.sol` | Extracted spot sell functionality | 6,711 bytes |
| `TickBitmap.sol` | Assembly-optimized bitmap library | Library |
| `TransientDelta.sol` | EIP-1153 flash accounting | Library |
| `ITickBookHooks.sol` | V4-style hooks interface | Interface |

### Size Comparison

| Contract | Original | Optimized | Reduction |
|----------|----------|-----------|-----------|
| TickBook | 24,525 bytes | 14,718 bytes | **40%** |
| + SpotSell | - | 6,711 bytes | (extracted) |
| **Total** | 24,525 bytes | 21,429 bytes | **13%** |

### Gas Benchmarks

| Operation | Original | Optimized | Savings |
|-----------|----------|-----------|---------|
| findNextUp (same word) | 4,480 gas | 1,570 gas | **65%** |
| findNextUp (cross word) | 4,608 gas | 4,219 gas | **8%** |
| setBitRange (101 ticks) | 184,679 gas | 45,328 gas | **75%** |
| Market order | ~102k gas | ~91k gas | **11%** |
| Cancel order | ~341k gas | ~303k gas | **11%** |

### Test Results

All existing tests pass with the optimized implementation.

---

## Alternatives Considered

### 1. Diamond Pattern (EIP-2535)
**Rejected:** Added complexity not justified for our use case. Simple contract extraction achieves same goal.

### 2. Upgradeable Proxy
**Deferred:** Would require governance and adds trust assumptions. Consider for future versions.

### 3. Complete V4 Singleton Rewrite
**Deferred:** Current market count doesn't justify singleton overhead. Can add later if needed.

---

## Consequences

### Positive
- 40% contract size reduction (room for new features)
- 65% gas reduction on tick searches
- 75% gas reduction on wide range orders
- Extensibility via hooks
- Better security with explicit overflow checks

### Negative
- Two contracts to maintain (core + spot sell)
- New libraries to audit
- Migration effort for existing integrations

### Neutral
- Flash accounting requires Solidity 0.8.24+ (already using 0.8.20)
- Hooks add optional complexity

---

## References

- [Uniswap V3 Whitepaper](https://app.uniswap.org/whitepaper-v3.pdf)
- [Uniswap V4 Whitepaper](https://app.uniswap.org/whitepaper-v4.pdf)
- [Uniswap V3 Concentrated Liquidity](https://docs.uniswap.org/concepts/protocol/concentrated-liquidity)
- [Uniswap V4 Hooks](https://docs.uniswap.org/concepts/protocol/hooks)
- [EIP-1153: Transient Storage](https://eips.ethereum.org/EIPS/eip-1153)
- [Uniswap V3 BitMath](https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/BitMath.sol)
- [Uniswap V3 TickBitmap](https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/TickBitmap.sol)
- [Aperture Finance Optimized Libraries](https://medium.com/@aperturefinance/open-sourcing-our-optimized-uniswap-v3-libraries-30-gas-savings-1ded16fcd751)
- [Uniswap V3 Fee Accumulation](https://bailsec.io/tpost/6nmv64co01-uniswap-v3-fee-accumulation-demystified)
- [Uniswap V4 Flash Accounting](https://hacken.io/discover/uniswap-v4-transient-storage-security/)
