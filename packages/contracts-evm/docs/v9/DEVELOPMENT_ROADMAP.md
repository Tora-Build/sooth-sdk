# V9 Development Roadmap

**Status:** Active
**Last Updated:** 2025-12-29
**Version:** 9.0

---

## Executive Summary

V9 introduces a **Uniswap V4-style singleton architecture** with:
- **TickBookPoolManager**: Single contract manages ALL markets
- **Flash Accounting**: EIP-1153 transient storage (200x cheaper batch ops)
- **Hooks System**: 13 extensible callback points
- **Permissionless Claims**: Anyone can settle maker fills

---

## Current State (V9.0)

### Production-Ready

| Contract | Size | Status | Tests |
|----------|------|--------|-------|
| **TickBookPoolManager** | ~40KB | Complete | ✅ 22/22 |
| **DynamicFeeHook** | ~12KB | Complete | ✅ |
| **TickBookVault** | ~14KB | Complete | ✅ |
| **LaunchpadEngine** | ~20KB | Complete (ITickBook compat) | ✅ |
| **AMMEngine** | ~21KB | Complete | ✅ |
| **Collateralizer** | ~10KB | Complete | ✅ |
| **TruthMarket** | ~5KB | Complete | ✅ |

### Archived (V8)

| Contract | Location | Status |
|----------|----------|--------|
| TickBook.sol | `archive_tests/v8/` | Superseded by TickBookPoolManager |
| TickBookSpotSell.sol | `archive_tests/v8/` | To be integrated into PoolManager |
| V8 Tests | `archive_tests/v8/` | Preserved for reference |

---

## V9 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND / KEEPERS                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  TickBookPoolManager (Singleton)            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Market 1    │  │ Market 2    │  │ Market N           │ │
│  │ - Orders    │  │ - Orders    │  │ - Orders           │ │
│  │ - Bitmap    │  │ - Bitmap    │  │ - Bitmap           │ │
│  │ - State     │  │ - State     │  │ - State            │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                              │
│  Flash Accounting (EIP-1153)  │  Hooks (13 callback points) │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────────┐
│     TickBookVault       │     │         Hooks               │
│  - USDC custody         │     │  - DynamicFeeHook           │
│  - Internal balances    │     │  - Custom implementations   │
│  - Outcome credits      │     │  - Permission encoding      │
└─────────────────────────┘     └─────────────────────────────┘
```

---

## Key Features

### 1. Singleton Architecture
- **Before (V8)**: Deploy new TickBook per market
- **After (V9)**: Single TickBookPoolManager for ALL markets
- **Benefits**: Simpler deployment, cross-market arbitrage, unified state

### 2. Flash Accounting (EIP-1153)
```solidity
// TSTORE: 100 gas vs SSTORE: 20,000 gas (200x cheaper)
function lock(bytes calldata data) external returns (bytes memory result) {
    // Set locker
    // Execute callback
    // Verify deltas settled
    // Clear locker
}
```

### 3. Hooks System
13 callback points with address-encoded permissions:
```
Bit 0:  beforePlaceOrder     Bit 7:  afterCross
Bit 1:  afterPlaceOrder      Bit 8:  getDynamicFee
Bit 2:  beforeExecuteOrder   Bit 9:  beforeClaim
Bit 3:  afterExecuteOrder    Bit 10: afterClaim
Bit 4:  beforeCancelOrder    Bit 11: beforeSpotSell
Bit 5:  afterCancelOrder     Bit 12: afterSpotSell
Bit 6:  beforeCross
```

### 4. Permissionless Claims
```solidity
// Anyone can trigger claims (keepers, takers, etc.)
function claimFillsFor(bytes32 marketKey, uint256 orderId) external;

// Batch claim for gas efficiency
function batchClaimFills(bytes32 marketKey, uint256[] calldata orderIds) external;
```

---

## Deployment Checklist

### Pre-Deployment
- [x] All tests passing (22/22)
- [x] ABIs exported to `abi/v9/`
- [x] Frontend spec documented
- [ ] Gas benchmarks documented
- [ ] Security review

### Deployment Steps
1. Deploy TickBookVault
2. Deploy TickBookPoolManager(vault)
3. Call vault.setTickBook(poolManager)
4. Deploy LaunchpadEngine (with poolManager as tickBook)
5. Register existing markets

### Post-Deployment
- [ ] Verify contracts on block explorer
- [ ] Update frontend config
- [ ] Monitor first trades

---

## Future Work (V9.x)

### SpotSell Integration
- Extract from archived TickBookSpotSell.sol
- Add to TickBookPoolManager or as separate hook
- Enable selling outcome tokens for USDC

### Guardian System
- Multi-sig oversight for market settlements
- Emergency pause functionality
- Dispute resolution

### Gas Optimizations
- Assembly optimization for hot paths
- Storage packing improvements
- Bitmap search optimizations

### Yield Integration
- USDC idle yield strategies
- LP staking rewards

---

## File Structure

```
contracts/
├── TickBookPoolManager.sol  # Singleton manager (NEW)
├── TickBookVault.sol        # USDC custody
├── LaunchpadEngine.sol      # Market creation
├── AMMEngine.sol            # Bonding curve
├── Collateralizer.sol       # Token operations
├── TruthMarket.sol          # Market lifecycle
├── hooks/
│   └── DynamicFeeHook.sol   # Fee hook example
├── interfaces/
│   ├── ITickBookHooks.sol   # Hook interface
│   ├── ITickBookVault.sol
│   └── ...
└── libraries/
    ├── TransientDelta.sol   # Flash accounting
    ├── TickBitmap.sol       # Tick tracking
    └── TickMath.sol         # Price math

docs/v9/
├── DEVELOPMENT_ROADMAP.md   # This file
├── FRONTEND_INTEGRATION_SPEC.md
├── ADR-053-TickBookV2-Optimization.md
└── UNISWAP-RESEARCH-NOTES.md

abi/v9/
├── TickBookPoolManager.json
├── TickBookVault.json
├── DynamicFeeHook.json
└── ...
```

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 9.0 | 2025-12-29 | Singleton PoolManager, Flash Accounting, Hooks |
| 8.12 | 2025-12-28 | Limit order crossing fix |
| 8.11 | 2025-12-27 | Monad Testnet integration |
| 8.9 | 2025-12-26 | Pending fills display, short sell fix |
