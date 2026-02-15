# V12 — Sooth Protocol with SoothBook Orderbook

**Status**: Alpha  
**Build**: 208/208 Tests Passing  
**Version**: V12.0  
**Date**: 2026-02-15

---

## Core Contracts

### Market Lifecycle
- `TruthMarket.sol` — Canonical lifecycle & settlement authority

### Trading Infrastructure
- `LaunchpadEngine.sol` — Creator economics, fee distribution, graduation mechanics
- `AMMEngine.sol` — LMSR position domain for pre-graduation markets
- `SoothBook.sol` — Standalone orderbook for post-graduation markets (4 atomic actions, ERC20 outcome tokens, FIFO matching)

### Token Management
- `Collateralizer.sol` — Split/merge/redeem (1 USDC = 1 YES + 1 NO)
- `OutcomeToken.sol` — ERC20 YES/NO outcome tokens

### Protocol Infrastructure
- `ProtocolConfig.sol` — Guardian list + global pause
- `ValidatedAdjudicator.sol` — TEE attestation-based settlement
- `LaunchpadLPToken.sol` — Transferable LP token for market creators
- `MockUSDC.sol` — Test collateral token

### Libraries
- `libraries/LMSRMath.sol` — LMSR pricing with log-sum-exp
- `libraries/TickBitmap.sol` — O(1) tick discovery
- `libraries/TickMath.sol` — Probability & swap math

---

## Architecture

```
                    TruthMarket (Lifecycle + Settlement)
                            ↑ queries
                    LaunchpadEngine (Creator Economics)
                    ├── createMarket()
                    ├── graduate()
                    └── _registerSoothBookMarket()
                            ↓ delegates
    ┌───────────────────────┴───────────────────────┐
    │                                               │
AMMEngine                                      SoothBook
(Pre-graduation LMSR)                  (Post-graduation Orderbook)
    │                                               │
    │                                          ERC20 Tokens
    │                                       (YES + NO per market)
    │                                               │
    └───────────────────────┬───────────────────────┘
                            ↓
                    Collateralizer
                    (Split/Merge/Redeem)
```

### Data Flow

1. **Market Creation**: User deposits via LaunchpadEngine → deploys TruthMarket
2. **Pre-Graduation**: Trading via AMMEngine (LMSR pricing, 5% fee)
3. **Graduation**: When fees accumulate, LaunchpadEngine calls `soothBook.createMarket()` → deploys ERC20 YES/NO tokens
4. **Post-Graduation**: Trading via SoothBook (buyYes, buyNo, mint, merge)
5. **Settlement**: TruthMarket resolves → Collateralizer redeems winning tokens

---

## Key Design Decisions

### SoothBook — Standalone Orderbook
SoothBook (602 lines) replaces the previous vault-based orderbook with a simpler design:
- **4 atomic actions**: `buyYes`, `buyNo`, `mint`, `merge`
- **ERC20 outcome tokens**: Real tokens in user wallets (not internal shares)
- **FIFO matching**: Orders matched first-in-first-out at each tick
- **No vault**: Direct USDC→token transfers, no custody layer
- **Tick bitmap**: O(1) price discovery across 1000 probability ticks

### Graduation Bridge
On graduation, LaunchpadEngine registers the market with SoothBook via `_registerSoothBookMarket()`. This creates ERC20 YES/NO tokens and opens the orderbook for trading.

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
- SoothBook registration on graduation
- Symbol auto-derived from market address

### AMMEngine
- LMSR continuous pricing (log-sum-exp)
- WAD precision (1e18)
- Non-transferable positions (ERC1155)
- Pre-graduation only (routed via LaunchpadEngine)
- MarketInitialized event on first trade

### SoothBook
- 4 atomic actions: buyYes, buyNo, mint, merge
- ERC20 outcome tokens per market (YES + NO)
- 1000 linear probability ticks (0.1% precision)
- Two-level bitmap (O(1) tick discovery)
- FIFO order matching
- No vault — direct USDC transfers
- Market resolution and redemption

### Collateralizer
- Split: 1 USDC → 1 YES + 1 NO
- Merge: 1 YES + 1 NO → 1 USDC
- Redeem: Winning tokens → USDC
- Non-binary outcomes (INVALID = 50/50)

### TruthMarket
- Lifecycle: CREATED → LIVE → SETTLED
- Adjudicator-based settlement
- YES/NO/INVALID outcomes
- Guardian veto mechanism

---

## Testing

**Status**: 208/208 tests passing

### Running Tests
```bash
# All tests
cd packages/contracts-testing && forge test

# Single file
forge test --match-path test/integration/GraduationFlow.t.sol

# With traces
forge test --match-test test_PlaceOrder -vvvv

# Invariant tests
forge test --match-contract Invariants

# Fuzz tests
forge test --match-contract Fuzz
```

---

## Deployment (Base Sepolia — V12.0)

| Contract | Address |
|----------|---------|
| MockUSDC | `0xe2025de4fbee78d0a3832ea02d070d791c42ed1e` |
| ProtocolConfig | `0xaf2b599fedfda277f66525bf91ef6f49df6bddae` |
| Collateralizer | `0x72b11e98d4050b5edaa9b069d1c6d7309a8c8f04` |
| AMMEngine | `0xb7cf9d7e3357052238a9bbdc9aaaa63e1b1346f2` |
| SoothBook | `0xa83b770de63349629ea1f92ad9b40285b1d47d74` |
| LaunchpadEngine | `0xc5f6b53c74a5d14336e971459ee7cf936d401384` |

---

## File Structure

```
src/
├── TruthMarket.sol
├── LaunchpadEngine.sol
├── AMMEngine.sol
├── SoothBook.sol
├── Collateralizer.sol
├── OutcomeToken.sol
├── LaunchpadLPToken.sol
├── ProtocolConfig.sol
├── ValidatedAdjudicator.sol
├── MockUSDC.sol
├── interfaces/
│   ├── ITruthMarket.sol
│   ├── ILaunchpadEngine.sol
│   ├── IAMMEngine.sol
│   ├── ISoothBook.sol
│   └── ICollateralizer.sol
├── libraries/
│   ├── LMSRMath.sol
│   ├── TickBitmap.sol
│   └── TickMath.sol
└── hooks/
    └── ...
```

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

// 3. After graduation, trade on SoothBook orderbook
bytes32 marketKey = soothBook.marketKeys(market);
usdc.approve(address(soothBook), 10e6);
soothBook.buyYes(marketKey, tick, 10e6); // Limit buy YES at tick

// 4. After settlement, redeem winning tokens
collateralizer.redeem(market, winningBalance);
```

---

## Security Considerations

### Implemented
- Pull-based lifecycle (no reentrancy risk)
- SafeERC20 for all transfers
- Access control (adjudicator, guardian, onlyOwner)
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

**Built for Sooth Protocol**  
**V12: SoothBook Orderbook, Aligned Incentives**
