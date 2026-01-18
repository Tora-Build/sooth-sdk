# V10 Implementation - Unified Prediction Market Protocol

**Status**: Production Alpha  
**Build**: All Tests Passing (124/124)  
**Version**: V10.8.3  
**Date**: 2026-01-18

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

## Current Deployments (V10.8.3)

### Base Sepolia (chainId: 84532)
| Contract | Address |
|----------|---------|
| LaunchpadEngine | `0xdc51a2beb6ed2e65f1ee4cfa87a228b77e697a21` |
| TickBookPoolManager | `0x463759fa866e6045c97cb37c25bcd74d23aa9b34` |
| TickBookVault | `0x3727d8d586bd37cd716c1bdbc05c6c2c6b8adc5d` |
| AMMEngine | `0x95c0a48c38a19dcdd9b8d21b0c304154230b56b9` |
| Collateralizer | `0x3aeeedd2e749c6d7bbabafdfd76ad84ad6c414f1` |

### Monad Testnet (chainId: 10143)
| Contract | Address |
|----------|---------|
| LaunchpadEngine | `0x9ca66ac4a00e7c380db41a714be470493bc2eee1` |
| TickBookPoolManager | `0xaa3daf93c823258fe025b26be90e8a08d2abf84f` |
| TickBookVault | `0xb3ea593be1a834650e2955cc8f038921f4571ffa` |
| AMMEngine | `0xd18e6e7489d07e38f903e301c19f6a43650a0178` |
| Collateralizer | `0x7cbabf4a2dad48f7b5180b54adb8038a42663cb7` |

### MegaETH Testnet (chainId: 6343)
| Contract | Address |
|----------|---------|
| LaunchpadEngine | `0x2de2f2e6aad4f310dc72acc6f896412ceb4706f3` |
| TickBookPoolManager | `0x7f7a84196dc38b054a6f31b2efcd7142860b37c6` |
| TickBookVault | `0xb80a06cc6813c03f1b04bc969942740b7483b447` |
| AMMEngine | `0xed1ffac79bfe9a13715774d2694a0f55ed392656` |
| Collateralizer | `0x86437735e952ec47884e3ff202594d8789943a81` |

### Arc Testnet (chainId: 5042002)
| Contract | Address |
|----------|---------|
| LaunchpadEngine | `0x7015ea4bdada102969f5d9eb9457e087a559cedc` |
| TickBookPoolManager | `0xb4240ac6cc3a082d5819e9410f0eb90209a4a3f3` |
| TickBookVault | `0xadd058a6bd2bce6f1fe1cbd3c9e21250c055e242` |
| AMMEngine | `0x3c01829ddac95f1f143c04afdcf0c2689aa979f0` |
| Collateralizer | `0xed16d73f5879ccf8ca1a16cfda46615fa98ef30c` |

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
