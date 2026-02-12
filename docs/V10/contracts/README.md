# Sooth Protocol Smart Contracts Documentation

**Version**: V10.0.0  
**Status**: Alpha  
**Last Updated**: 2026-01-06

---

## Documentation Map

### Core Contract Docs (Read in Order)

1. **[01-OVERVIEW.md](./01-OVERVIEW.md)** - **START HERE**
   - Executive summary of V10
   - Architecture layers and design principles
   - V10 unified crossing architecture
   - **Read time**: 5 mins

2. **[02-TruthMarket.md](./02-TruthMarket.md)**
   - Market lifecycle (CREATED -> LIVE -> SETTLED -> FINALIZED)
   - Settlement and veto mechanism
   - Integration with other contracts
   - **Read time**: 10 mins

3. **[03-TickBookPoolManager.md](./03-TickBookPoolManager.md)**
   - **V10 HIGHLIGHT**: Unified crossing architecture
   - Spot sell integration
   - Unified tick liquidity storage
   - Dual bitmap system
   - **Read time**: 15 mins

4. **[04-AMMEngine.md](./04-AMMEngine.md)**
   - LMSR pricing model
   - Position trading with 24h locks
   - Settlement and redemption
   - **Read time**: 12 mins

5. **[05-Collateralizer.md](./05-Collateralizer.md)**
   - Token split/merge/redeem
   - Outcome token management
   - Settlement payouts (YES/NO/INVALID)
   - **Read time**: 8 mins

6. **[06-LaunchpadEngine.md](./06-LaunchpadEngine.md)**
   - Creator economics
   - LP token issuance
   - Fee distribution
   - Automatic graduation
   - **Read time**: 10 mins

7. **[07-TickBookVault.md](./07-TickBookVault.md)**
   - Singleton vault architecture
   - USDC custody
   - Internal share accounting
   - **Read time**: 8 mins

### Analysis & Recommendations

8. **[ARCHITECTURE-REVIEW.md](./ARCHITECTURE-REVIEW.md)**
   - Strengths and weaknesses
   - Code quality metrics
   - Next steps (critical -> nice-to-have)
   - Deployment sequence
   - **Read time**: 15 mins

---

## Quick Links

### For Different Roles

**Project Manager**
- Start: [01-OVERVIEW.md](./01-OVERVIEW.md)
- Then: [ARCHITECTURE-REVIEW.md](./ARCHITECTURE-REVIEW.md) (next steps)

**Smart Contract Developer**
- Start: [01-OVERVIEW.md](./01-OVERVIEW.md)
- Read all 7 contracts (02-07) in order
- Reference: [DECISIONS.md](../../../DECISIONS.md) for ADRs

**Security Auditor**
- Start: [ARCHITECTURE-REVIEW.md](./ARCHITECTURE-REVIEW.md) (summary)
- Deep dive: [02-TruthMarket.md](./02-TruthMarket.md) -> [07-TickBookVault.md](./07-TickBookVault.md)
- Reference: `packages/contracts-core/src/` (source code)

**QA/Tester**
- Start: [01-OVERVIEW.md](./01-OVERVIEW.md) (understand flow)
- See: [../testing/README.md](../testing/README.md)
- Run: Tests in `packages/contracts-core/test/`

**Frontend Developer**
- Start: [01-OVERVIEW.md](./01-OVERVIEW.md)
- Focus: [03-TickBookPoolManager.md](./03-TickBookPoolManager.md) (Unified Order API)
- Reference: [07-TickBookVault.md](./07-TickBookVault.md) for balance management

---

## Contract Summary Table

| Contract | File | Purpose | Status |
|----------|------|---------|--------|
| **TruthMarket** | `TruthMarket.sol` | Market lifecycle + settlement | Stable |
| **TickBookPoolManager** | `TickBookPoolManager.sol` | Unified orderbook (V10) | **NEW** |
| **AMMEngine** | `AMMEngine.sol` | LMSR position trading | Stable |
| **LaunchpadEngine** | `LaunchpadEngine.sol` | Creator economics | Stable |
| **Collateralizer** | `Collateralizer.sol` | Token split/merge/redeem | Stable |
| **TickBookVault** | `TickBookVault.sol` | Singleton vault | Stable |
| **OutcomeToken** | `OutcomeToken.sol` | YES/NO ERC20 tokens | Stable |

---

## V10 Highlights

### Unified Crossing Architecture

**The Key V10 Innovation**: When a buyer places an order, the engine fills **Spot Sells FIRST** (recycling existing tokens), then **Range Orders** (minting synthetic shares).

```
V9: Siloed Liquidity          V10: Unified Crossing
                              
Range Orders -----> Taker     Spot Sells ----+
                              (recycle)      |
Spot Sells ------> Taker      Range Orders --+--> Taker
(separate)                    (mint)
```

### New Data Structures

```solidity
// V10: Unified tick liquidity
struct TickLiquidity {
    int128 rangeLiquidityNet;     // Range order net liquidity
    uint128 rangeLiquidityGross;  // Range order gross liquidity
    uint128 spotLiquidity;        // Spot sell liquidity (NEW)
}
```

### Dual Bitmap System

- **Range Bitmap**: Tracks range order liquidity
- **Spot Bitmap**: Tracks spot sell liquidity (NEW)
- Both searched during crossing for optimal price discovery

---

## Common Tasks

### "How do I create a market?"
-> [06-LaunchpadEngine.md#create-market](./06-LaunchpadEngine.md#create-market)

### "How do I place an order?"
-> [03-TickBookPoolManager.md#place-order](./03-TickBookPoolManager.md#place-order)

### "How do spot sells work?"
-> [03-TickBookPoolManager.md#spot-sell-orders](./03-TickBookPoolManager.md#spot-sell-orders)

### "How does unified crossing work?"
-> [03-TickBookPoolManager.md#unified-crossing](./03-TickBookPoolManager.md#unified-crossing)

### "How does settlement work?"
-> [02-TruthMarket.md#market-lifecycle](./02-TruthMarket.md#market-lifecycle)

### "How do fees work?"
-> [06-LaunchpadEngine.md#economics-model](./06-LaunchpadEngine.md#economics-model)

---

## Testing

### Run All Tests
```bash
cd packages/contracts-core
forge test
```

### Run V10-Specific Tests
```bash
# Unified crossing tests
forge test --match-path "*crossing*" -v

# Spot sell tests
forge test --match-test "SpotSell" -v
```

### Gas Benchmarking
```bash
forge test --match-path "*benchmark*" --gas-report
```

---

## Math Reference

### Probability <-> Tick Conversion
```
tick = probability x 1000
prob = tick / 1000

Examples:
- 50% probability = tick 500
- 30% probability = tick 300
- 99% probability = tick 990
```

### LMSR Pricing
```
Cost = b x ln(exp(R_O/b) + exp(X/b)) - baseline
Returns smooth, continuous pricing with natural spread
```

### Fee Distribution (Post-Grad)
```
50% -> bBase growth (buyback)
30% -> LP yield pool
20% -> protocol treasury
```

---

## External References

### Related Docs
- [STATUS.md](../../../STATUS.md) - Current deployments + known issues
- [DECISIONS.md](../../../DECISIONS.md) - Architectural decision records
- [ARCHITECTURE.md](../../../ARCHITECTURE.md) - System architecture
- [README.md](../../../README.md) - Project overview

### Code Locations
- **Contracts**: `packages/contracts-core/src/`
- **Tests**: `packages/contracts-core/test/`
- **Scripts**: `packages/contracts-core/script/`

---

## Key Concepts

### Order Types (TickBook)
| Type | Tick Range | Use Case |
|------|------------|----------|
| Market | `(1, 999)` | Buy/sell ASAP at any price |
| Limit | `(X, X)` | Buy/sell at specific price |
| Range | `(X, Y)` | Provide liquidity across range |
| Market w/ Floor | `(F, 999)` | Fill down to floor, rest at floor |

### Market States (TruthMarket)
| State | Trading | Settlement | Redemption |
|-------|---------|-----------|-----------|
| CREATED | No | No | No |
| LIVE | Yes | No | No |
| SETTLING | No | Yes (adjudicator) | No |
| SETTLED | No | Yes (can veto) | No |
| FINALIZED | No | Yes (locked) | Yes |

### Fee Phases (LaunchpadEngine)
| Phase | Taker Fee | Distribution | Trigger |
|-------|-----------|--------------|---------|
| Pre-Graduation | 5% | 100% to creator | Before threshold |
| Post-Graduation | 1% | 50/30/20 split | After threshold |

---

## Important Notes

### For Mainnet Deployment
- [ ] Complete external security audit
- [ ] Implement emergency pause mechanism
- [ ] Set up multisig governance
- [ ] Deploy contract verification
- See [ARCHITECTURE-REVIEW.md#critical](./ARCHITECTURE-REVIEW.md#critical)

### Alpha Phase
- Breaking changes allowed
- No backward compatibility guarantee
- All contracts subject to redeployment
- Use testnet only for development

---

## Learning Path

**Beginner** (New to prediction markets)
1. [01-OVERVIEW.md](./01-OVERVIEW.md)
2. [02-TruthMarket.md](./02-TruthMarket.md)
3. [05-Collateralizer.md](./05-Collateralizer.md)

**Intermediate** (Know trading mechanics)
1. [01-OVERVIEW.md](./01-OVERVIEW.md)
2. [03-TickBookPoolManager.md](./03-TickBookPoolManager.md) (Unified API + V10)
3. [04-AMMEngine.md](./04-AMMEngine.md)

**Advanced** (System design)
1. All of above
2. [06-LaunchpadEngine.md](./06-LaunchpadEngine.md)
3. [07-TickBookVault.md](./07-TickBookVault.md)
4. [ARCHITECTURE-REVIEW.md](./ARCHITECTURE-REVIEW.md)
5. Source code in `packages/contracts-core/src/`

---

**Built for the Sooth Protocol**

V10: Unified Crossing Architecture + Spot Sell Integration  
Status: Alpha  
Next: Security Audit -> Mainnet
