# Uniswap V3/V4 Research Notes

**Purpose:** Document learnings from Uniswap that can improve TickBookV2
**Date:** 2025-12-28

---

## Uniswap V3 Architecture

### Concentrated Liquidity

The core innovation of Uniswap V3 is concentrated liquidity - LPs can allocate capital to specific price ranges instead of the entire curve.

**Key insight for TickBookV2:** Our range order system already implements this pattern. Each range order is equivalent to a Uniswap V3 position.

```
Uniswap V3:                    TickBookV2:
├── Position                   ├── RangeOrder
│   ├── tickLower             │   ├── tickLower
│   ├── tickUpper             │   ├── tickUpper
│   ├── liquidity             │   ├── liquidity (density)
│   └── feeGrowthInside       │   └── filledShares
```

### Tick Math

Uniswap uses logarithmic tick spacing: each tick represents a 0.01% price change.

```
price = 1.0001^tick
tick = log_{1.0001}(price)
```

**TickBookV2 difference:** We use linear ticks (0-999 = 0-99.9% probability). This is simpler for prediction markets where probability is the natural unit.

### Fee Growth Tracking

V3 tracks fees using per-liquidity accumulator pattern:

```solidity
// Global accumulator
uint256 feeGrowthGlobal0X128;

// Per-position delta
feeGrowthInside = feeGrowthGlobal - feeGrowthOutside_lower - feeGrowthOutside_upper
feesOwed = (feeGrowthInside - feeGrowthInsideLast) * liquidity / Q128
```

**TickBookV2 equivalent:** Our `_fillGrowthGlobalX128` and `_collateralUsedGrowthGlobalX128` implement the same pattern for maker attribution.

### Tick Bitmap

V3 uses 256-bit words for efficient tick discovery:

```solidity
// Word position and bit position
function position(int24 tick) private pure returns (int16 wordPos, uint8 bitPos) {
    wordPos = int16(tick >> 8);
    bitPos = uint8(tick % 256);
}
```

**Learning applied:** Our original 100-bit words were suboptimal. Switched to 256-bit for EVM efficiency.

### BitMath LSB/MSB

V3 uses binary search in assembly for finding set bits:

```solidity
function leastSignificantBit(uint256 x) internal pure returns (uint8 r) {
    // Binary search: check 128, 64, 32, 16, 8, 4, 2, 1 bit ranges
    if (x & type(uint128).max == 0) { r += 128; x >>= 128; }
    // ...
}
```

**Benchmark results:**
- Original (branching Solidity): 4,480 gas
- Optimized (assembly): 1,570 gas
- **Savings: 65%**

---

## Uniswap V4 Architecture

### Singleton Pattern

V4 uses a single PoolManager contract for all pools:

```solidity
contract PoolManager {
    mapping(PoolId => Pool.State) public pools;

    function initialize(PoolKey memory key) external {
        // Create pool as state, not new contract
        pools[key.toId()] = Pool.State({...});
    }
}
```

**Benefits:**
- 99% cheaper pool creation (no contract deployment)
- Efficient multi-hop routing (no external calls)
- Shared liquidity infrastructure

**TickBookV2 consideration:** We could create `TickBookV2Manager` singleton if market count grows significantly. Current per-market registration is simpler for now.

### Hooks System

V4's most powerful feature - externally deployed contracts that execute at key points:

```solidity
interface IHooks {
    function beforeSwap(address, PoolKey, IPoolManager.SwapParams, bytes)
        external returns (bytes4, BeforeSwapDelta, uint24);

    function afterSwap(address, PoolKey, IPoolManager.SwapParams, BalanceDelta, bytes)
        external returns (bytes4, int128);
}
```

**Permission encoding:** Hook permissions are encoded in the contract address itself:

```solidity
// Last 14 bits of address indicate permissions
uint256 constant BEFORE_SWAP_FLAG = 1 << 7;

function hasPermission(address hooks, uint256 flag) internal pure returns (bool) {
    return uint160(hooks) & flag != 0;
}
```

**Benefits:**
- No storage reads for permission checks
- Permissions immutable (address-based)
- Easy to verify hook capabilities

**Applied to TickBookV2:** Created `ITickBookHooks` with 13 hook points:
- beforePlaceOrder / afterPlaceOrder
- beforeExecuteOrder / afterExecuteOrder
- beforeCancelOrder / afterCancelOrder
- beforeCross / afterCross
- beforeClaim / afterClaim
- beforeSpotSell / afterSpotSell
- getDynamicFee

### Flash Accounting (EIP-1153)

V4 uses transient storage for balance tracking within a transaction:

```solidity
// Standard storage: 20,000 gas
sstore(slot, value)

// Transient storage: 100 gas
tstore(slot, value)
```

**Flash accounting pattern:**
```solidity
function swap(PoolKey key, SwapParams params) external {
    // Record delta in transient storage
    _accountDelta(currency0, -amount0);
    _accountDelta(currency1, amount1);
}

function settle() external {
    // At end, verify all deltas are zero
    require(TransientStorage.getNonzeroDeltaCount() == 0);
}
```

**Applied to TickBookV2:** Created `TransientDelta` library:
```solidity
library TransientDelta {
    function addDelta(address account, int256 amount) internal {
        bytes32 slot = _deltaSlot(account);
        assembly ("memory-safe") {
            let prev := tload(slot)
            tstore(slot, add(prev, amount))
        }
    }

    function requireSettled() internal view {
        if (getNonzeroDeltaCount() != 0) revert NonzeroDeltas(count);
    }
}
```

### Dynamic Fees

V4 supports hooks that can adjust fees per-swap:

```solidity
function getDynamicFee(PoolKey key) external view returns (uint24 fee) {
    // Could be based on:
    // - Volatility
    // - Time of day
    // - Volume
    // - Oracle price deviation
    return calculateFee(key);
}
```

**TickBookV2 application:**
```solidity
function getDynamicFee(
    bytes32 marketKey,
    uint8 outcome,
    uint256 shares,
    uint24 baseFee
) external view returns (uint24 fee) {
    // Example: increase fee near market close
    if (isNearClose(marketKey)) {
        return baseFee * 2;
    }
    return baseFee;
}
```

---

## Patterns NOT Applicable to TickBookV2

### 1. x*y=k AMM Curve
Uniswap uses constant product. TickBookV2 uses orderbook with complete-set mechanics.

### 2. Fee Tiers
Uniswap has 0.01%, 0.05%, 0.30%, 1.00% tiers with per-pool selection. Our system has:
- **TickBookV2 (Orderbook)**: 0.1% (10 bps) global fee, configurable via `SoothFeeController`
- **LaunchpadEngine (AMM)**: 5% pre-graduation / 1% post-graduation
- **SoothMarket (LMSR)**: Per-market `feeLMSR` set by Governor

Unlike Uniswap's per-pool tier selection, our fees are set globally (orderbook) or by market governance (LMSR).

### 3. Oracle Integration (TWAP)
Uniswap provides time-weighted average price. TickBookV2 markets resolve based on real-world outcomes.

### 4. Native ETH
Uniswap V4 supports native ETH trading. TickBookV2 uses USDC exclusively.

### 5. ERC-6909 (Multi-token)
Uniswap V4 uses ERC-6909 for position tracking. TickBookV2 uses internal ledger in vault.

---

## Key Takeaways

### Applied Immediately
1. **256-bit bitmap words** - EVM native size, fewer storage ops
2. **Assembly LSB/MSB** - 65% gas reduction
3. **Struct packing** - 7 slots → 4 slots
4. **Custom errors** - ~500 bytes saved

### Ready to Integrate
1. **Transient storage** - For batch operations
2. **Hooks interface** - For extensibility
3. **Permission encoding** - In hook addresses

### Future Consideration
1. **Singleton architecture** - If market count grows
2. **Dynamic fees** - Based on volatility/volume
3. **Tick spacing** - For high-volume markets

---

## References

### Uniswap V3
- [Whitepaper](https://app.uniswap.org/whitepaper-v3.pdf)
- [Concentrated Liquidity](https://docs.uniswap.org/concepts/protocol/concentrated-liquidity)
- [TickBitmap.sol](https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/TickBitmap.sol)
- [BitMath.sol](https://github.com/Uniswap/v3-core/blob/main/contracts/libraries/BitMath.sol)
- [Fee Growth](https://bailsec.io/tpost/6nmv64co01-uniswap-v3-fee-accumulation-demystified)
- [Development Book](https://uniswapv3book.com/)

### Uniswap V4
- [Whitepaper](https://app.uniswap.org/whitepaper-v4.pdf)
- [Hooks Overview](https://docs.uniswap.org/concepts/protocol/hooks)
- [V4 vs V3](https://docs.uniswap.org/contracts/v4/concepts/v4-vs-v3)
- [Flash Accounting](https://hacken.io/discover/uniswap-v4-transient-storage-security/)
- [Architecture Explained](https://metalamp.io/magazine/article/uniswap-v4-architecture-understanding-the-basics-of-the-protocol)

### EIPs
- [EIP-1153: Transient Storage](https://eips.ethereum.org/EIPS/eip-1153)
- [EIP-6909: Minimal Multi-Token](https://eips.ethereum.org/EIPS/eip-6909)

### Optimizations
- [Aperture Finance Libraries](https://medium.com/@aperturefinance/open-sourcing-our-optimized-uniswap-v3-libraries-30-gas-savings-1ded16fcd751)
- [RareSkills Gas Optimization](https://rareskills.io/post/gas-optimization)
