# V11 Implementation - Unified Prediction Market Protocol

**Status**: Production Alpha  
**Build**: All Tests Passing (237/237)  
**Version**: V11.0  
**Date**: 2026-01-23

## V11 Features

| Feature | Contract | Description |
|---------|----------|-------------|
| Trial Period | `LaunchpadEngine` | 7-day trial with dismissMarket/claimRefund |
| ERC20 LP Token | `LaunchpadLPToken` | Transferable pre-settlement, locked post-settlement |
| Validated Adjudicator | `ValidatedAdjudicator` | TEE attestation-based settlement |
| Protocol Config | `ProtocolConfig` | Guardian list + global pause |
| Adjudicator-only finalize | `TruthMarket` | Guardians can veto but not finalize |

---

## Core Contracts

### Market Lifecycle
- `TruthMarket.sol` - Canonical lifecycle & settlement authority

### Trading Infrastructure
- `LaunchpadEngine.sol` - Creator economics, fee distribution, graduation mechanics
- `AMMEngine.sol` - LMSR position domain for pre-graduation markets
- `TickBookPoolManager.sol` - Unified orderbook with spot-first crossing (V10)
- `TickBookVault.sol` - USDC + outcome token custody

### Token Management
- `Collateralizer.sol` - Split/merge/redeem (1 USDC = 1 YES + 1 NO)
- `OutcomeToken.sol` - ERC20 YES/NO tokens

### Libraries
- `libraries/LMSRMath.sol` - LMSR pricing with log-sum-exp
- `libraries/TickBitmap.sol` - O(1) tick discovery
- `libraries/TickMath.sol` - Probability & swap math

---

## Architecture (V10 Unified Crossing)

```
                    TruthMarket (Lifecycle + Settlement)
                            ↑ queries
                    LaunchpadEngine (Creator Economics)
                    ├── createMarket()
                    ├── registerMarket()
                    └── graduate()
                            ↓ delegates
    ┌───────────────────────┴───────────────────────┐
    │                                               │
AMMEngine                              TickBookPoolManager
(Pre-graduation LMSR)                  (Post-graduation Orderbook)
    │                                               │
    │                                               ↓
    │                                       TickBookVault
    │                                       (USDC + Token Custody)
    │                                               │
    └───────────────────────┬───────────────────────┘
                            ↓
                    Collateralizer
                    (Split/Merge/Redeem)
```

### Data Flow

1. **Market Creation**: User deposits via LaunchpadEngine → deploys TruthMarket
2. **Pre-Graduation**: Trading via AMMEngine (LMSR pricing, 5% fee)
3. **Graduation**: When fees accumulate, market graduates to orderbook
4. **Post-Graduation**: Trading via TickBookPoolManager (1% fee)
5. **Settlement**: TruthMarket resolves → Collateralizer redeems winning tokens

---

## Key Design Decisions

### Unified Crossing (V10)
V10 introduces unified crossing where `placeOrder()` natively crosses both:
- **Spot Sells** - Direct token sales at market price
- **Range Orders** - Concentrated liquidity across tick ranges

Priority: Spot fills first (better price), then range liquidity.

### Vault-Based Custody
Unlike V8's isolated domains, V10 uses `TickBookVault` for unified custody:
- USDC deposits/withdrawals
- Outcome token tracking (internal shares, not ERC20)
- Atomic settlement on order fills

### Pull-Based Lifecycle
All contracts query `TruthMarket.isLive()` and `isSettled()`:
- No callbacks or hooks
- No centralized coordinator
- Each venue enforces its own rules

---

## Features

### LaunchpadEngine
- Creator deposits (100 USDC default)
- Fee accumulation toward graduation (5% bonding fee)
- Automatic graduation when threshold reached
- Symbol auto-derived from market address

### AMMEngine
- LMSR continuous pricing (log-sum-exp)
- WAD precision (1e18)
- Non-transferable positions
- Pre-graduation only (routed via LaunchpadEngine)
- MarketInitialized event on first trade

### TickBookPoolManager
- 1000 linear probability ticks (0.1% precision)
- Two-level bitmap (O(1) tick discovery)
- Unified spot + range crossing
- Batch operations (claim, cancel)
- Gas-optimized with unchecked arithmetic

### TickBookVault
- USDC reserve/release for order collateral
- Outcome share credit/lock/unlock/transfer
- Fee handling
- Redemption (YES wins, NO wins, INVALID)
- Access control (onlyTickBook modifier)

### Collateralizer
- Split: 1 USDC to 1 YES + 1 NO
- Merge: 1 YES + 1 NO to 1 USDC
- Redeem: Winning tokens to USDC
- Non-binary outcomes (INVALID = 50/50)

### TruthMarket
- Lifecycle: CREATED -> LIVE -> SETTLED
- Adjudicator-based settlement
- YES/NO/INVALID outcomes
- Guardian veto mechanism

---

## Testing

**Status**: 124/124 tests passing

### Test Categories
| Category | Count | Description |
|----------|-------|-------------|
| Unit Tests | 34 | TickBookVault isolated testing |
| Integration | 45 | Full market lifecycle |
| Crossing | 25 | Unified order execution |
| Invariants | 10 | Property-based fuzzing |
| Fork Tests | 10 | Live network validation |

### Running Tests
```bash
# All tests
cd packages/contracts-testing && forge test

# Single file
forge test --match-path test/unit/TickBookVault.t.sol

# With traces
forge test --match-test test_PlaceOrder -vvvv

# Invariant tests
forge test --match-contract Invariants
```

---

## Current Deployments (V10.9)

### Base Sepolia (chainId: 84532)
| Contract | Address |
|----------|---------|
| LaunchpadEngine | `0x83fcdc807e9ddc8ea823f7d43c8d0623374a2883` |
| TickBookPoolManager | `0xb94c45ed45575b48927a21601724db57dd74a94f` |
| TickBookVault | `0x94a243ee73e3306a35642f23a92b78a5a8bdd0ee` |
| AMMEngine | `0xe19c027a9407dc0eddae2d908e263d79aaf0bbe2` |
| Collateralizer | `0x258883fb64afe22517db08f4c6e886f4967205b9` |

### Monad Testnet (chainId: 10143)
| Contract | Address |
|----------|---------|
| LaunchpadEngine | `0x3ae688354f831a6b37025e3f19744bd857005cca` |
| TickBookPoolManager | `0xdebbf3b24b3bc6ff44888b6153c64bbd569ec90e` |
| TickBookVault | `0x0d9c613ae45820dacfcd5aff85a98f2e650b09a9` |
| AMMEngine | `0x8f3e3e0309f0730c62b3fdc68bff2291308537bd` |
| Collateralizer | `0x6a6454680c547c4db7e9bb7b06cac3030ce60183` |

### MegaETH Testnet (chainId: 6343)
| Contract | Address |
|----------|---------|
| LaunchpadEngine | `0xa2b2653124cb98b4d83a8a314e5e0bef2621832f` |
| TickBookPoolManager | `0xf52a8e9f5defcc6fe0e66b523d29ad7cfc3af530` |
| TickBookVault | `0x5b9a8b49d5616326bd61ac57b429cbf84e8cc756` |
| AMMEngine | `0x61470420cc117e9460aae3bdc6cdf77c443ac09c` |
| Collateralizer | `0xe928d0cf62a98f2e24e65978ae487f562749305a` |

### Arc Testnet (chainId: 5042002)
| Contract | Address |
|----------|---------|
| LaunchpadEngine | `0x625b4b2997232380126f0aecd84867086f89b27e` |
| TickBookPoolManager | `0x8ba9751284d77ed59f46ea877577e6430bc30209` |
| TickBookVault | `0x1695ac9983f457e446d8f903d7c4061fbc7907f8` |
| AMMEngine | `0x0f0dd0be87f6ab153e732039469fe64353b95dbb` |
| Collateralizer | `0x0313af9c18e3c954f42b771a6d301fbbc6ad60a5` |

---

## File Structure

```
src/
├── TruthMarket.sol
├── LaunchpadEngine.sol
├── AMMEngine.sol
├── TickBookPoolManager.sol
├── TickBookVault.sol
├── Collateralizer.sol
├── OutcomeToken.sol
├── interfaces/
│   ├── ITruthMarket.sol
│   ├── ILaunchpadEngine.sol
│   ├── IAMMEngine.sol
│   ├── ITickBookPoolManager.sol
│   ├── ITickBookVault.sol
│   └── ICollateralizer.sol
└── libraries/
    ├── LMSRMath.sol
    ├── TickBitmap.sol
    └── TickMath.sol
```

---

## Security Considerations

### Implemented
- Pull-based lifecycle (no reentrancy risk)
- SafeERC20 for all transfers
- Access control (adjudicator, guardian, onlyTickBook)
- Overflow protection (Solidity 0.8.30)
- Input validation throughout
- Gas-optimized unchecked arithmetic (safe contexts only)

### Not Implemented
- Emergency pause mechanism
- Rate limiting
- MEV protection
- Formal verification
- External audit (planned)

---

## Usage Example

```solidity
// 1. Create market via LaunchpadEngine
usdc.approve(address(launchpad), 100e6);
address market = launchpad.createMarket(
    "Will ETH hit $5000?",
    "crypto",
    adjudicator,
    endTime,
    100e6  // creator deposit
);

// 2. Trade on AMM (pre-graduation)
usdc.approve(address(launchpad), 50e6);
launchpad.ammBuy(market, 1, 50e6); // Buy YES

// 3. After graduation, trade on orderbook
vault.depositUSDC(100e6);
poolManager.placeOrder(
    marketKey,
    0,     // YES outcome
    500,   // tick (50% probability)
    550,   // upper tick
    100e18 // shares
);

// 4. After settlement, redeem winning tokens
collateralizer.redeem(market, winningBalance);
```

---

**Built for Sooth Protocol**  
**V10: Unified Crossing, Aligned Incentives**
