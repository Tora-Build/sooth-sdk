# V6 Interface Naming Proposal

## Current Issue

`ISoothGovernorVault` is misleading in V6 context:
- **"Governor"** suggests governance/authority, but the interface is about **liquidity/asset management**
- In V6, **Market itself** implements this (not a separate "Governor" contract)
- V6 renamed "Governor" role → "Creator" for Launchpad markets
- The interface manages: assets, locks, LP operations, market reserves

## Current Usage

The interface is used by:
1. **`SoothLiquidityVault`** (global vault for TraderVault's locked proceeds tracking) - not for market liquidity
2. **`LaunchpadMarket`** (Current: Market implements interface directly, is its own vault)
3. **`MarketLPVault`** (V5 archived: per-market vault) - merged into Market in current version

## Proposed Options

### Option 1: `ISoothLiquidityVault` ⭐ (Recommended)
**Pros:**
- Accurately describes functionality (liquidity management)
- No governance connotation
- Clear and descriptive
- Works for both global and per-market contexts

**Cons:**
- Breaking change (requires updating all references)
- "Liquidity" might be confused with AMM liquidity depth (`b`)

### Option 2: `ISoothMarketVault`
**Pros:**
- Emphasizes per-market nature (V6 direction)
- Clear separation from global vault

**Cons:**
- Less accurate for global `SoothGovernorVault` usage
- "Market" might be confused with `SoothMarketV4`

### Option 3: `ISoothAssetVault`
**Pros:**
- Focuses on asset management (USDC storage, transfers)
- Generic enough for all contexts

**Cons:**
- Doesn't convey LP/liquidity aspects
- "Asset" is too generic

### Option 4: `ISoothLPVault`
**Pros:**
- Emphasizes LP functionality
- Clear purpose

**Cons:**
- Doesn't cover lock-on-sell (non-LP feature)
- Less accurate for V6 where Market holds assets directly

### Option 5: Keep `ISoothGovernorVault` (No Change)
**Pros:**
- No breaking changes
- Already established in codebase
- Can update comments/docs to clarify it's about liquidity, not governance

**Cons:**
- Confusing name in V6 context
- "Governor" terminology conflicts with V6 role definitions

## Recommendation

**Option 1: `ISoothLiquidityVault`**

### Migration Path

1. **Create alias** (backward compatibility):
   ```solidity
   interface ISoothLiquidityVault {
       // ... same functions ...
   }
   
   // Alias for backward compatibility
   interface ISoothGovernorVault is ISoothLiquidityVault {}
   ```

2. **Update new code** to use `ISoothLiquidityVault`

3. **Gradually migrate** existing code

4. **Deprecate** `ISoothGovernorVault` in future version

### Alternative: Update Comments Only

If breaking changes are not acceptable:

```solidity
/// @notice Liquidity Vault interface for asset and LP management.
/// @dev Historically named "GovernorVault" but manages liquidity, not governance.
///      In V6, LaunchpadMarket implements this interface directly.
/// @dev Legacy name retained for backward compatibility.
interface ISoothGovernorVault {
    // ... functions ...
}
```

## Decision Needed

- **Rename to `ISoothLiquidityVault`** (breaking change, but clearer)
- **Keep name, update comments** (no breaking change, but confusing)
- **Other suggestion?**
