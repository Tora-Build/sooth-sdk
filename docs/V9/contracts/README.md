# Sooth Protocol Smart Contracts Documentation

**Version**: V9.9.6-fix9L  
**Status**: Alpha (Deployed)  
**Last Updated**: 2026-01-03  

---

## 📚 Documentation Map

### Core Contract Docs (Read in Order)

1. **[01-OVERVIEW.md](./01-OVERVIEW.md)** ⭐ **START HERE**
   - Executive summary of V9.9.6
   - Architecture layers and design principles
   - Key improvements and stats
   - **Read time**: 5 mins

2. **[02-TruthMarket.md](./02-TruthMarket.md)**
   - Market lifecycle (CREATED → LIVE → SETTLED → FINALIZED)
   - Settlement and veto mechanism
   - Integration with other contracts
   - **Read time**: 10 mins

3. **[03-TickBook.md](./03-TickBook.md)**
   - Orderbook with 10,000 ticks
   - Unified Order API (V9.9.6)
   - Bitmap acceleration
   - V9.9.6-fix9d bug fixes
   - **Read time**: 15 mins

4. **[04-AMMEngine.md](./04-AMMEngine.md)**
   - LMSR pricing model
   - Position trading with 24h locks
   - Graduation mechanics
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

### Analysis & Recommendations

7. **[ARCHITECTURE-REVIEW.md](./ARCHITECTURE-REVIEW.md)**
   - Strengths and weaknesses
   - Code quality metrics
   - Next steps (critical → nice-to-have)
   - Deployment sequence
   - **Read time**: 15 mins

---

## 🚀 Quick Links

### For Different Roles

**👨‍💼 Project Manager**
- Start: [01-OVERVIEW.md](./01-OVERVIEW.md)
- Then: [ARCHITECTURE-REVIEW.md](./ARCHITECTURE-REVIEW.md) (next steps)
- Key metric: 138/138 tests passing ✅

**🛠️ Smart Contract Developer**
- Start: [01-OVERVIEW.md](./01-OVERVIEW.md)
- Read all 6 contracts (02-06) in order
- Reference: [DECISIONS.md](../../DECISIONS.md) for ADRs

**🔒 Security Auditor**
- Start: [ARCHITECTURE-REVIEW.md](./ARCHITECTURE-REVIEW.md) (summary)
- Deep dive: [02-TruthMarket.md](./02-TruthMarket.md) → [06-LaunchpadEngine.md](./06-LaunchpadEngine.md)
- Reference: `packages/contracts-core/src/` (source code)

**🧪 QA/Tester**
- Start: [01-OVERVIEW.md](./01-OVERVIEW.md) (understand flow)
- See: Testing section below
- Run: Tests in `packages/contracts-core/test/v9/`

**🎨 Frontend Developer**
- Start: [01-OVERVIEW.md](./01-OVERVIEW.md)
- Focus: [03-TickBook.md](./03-TickBook.md) (Unified Order API)
- Reference: Hook examples in [04-AMMEngine.md](./04-AMMEngine.md) and [06-LaunchpadEngine.md](./06-LaunchpadEngine.md)

---

## 📋 Contract Summary Table

| Contract | File | Size | Purpose | Status |
|----------|------|------|---------|--------|
| **TruthMarket** | `TruthMarket.sol` | 5.4 KB | Market lifecycle + settlement | ✅ Stable |
| **TickBook** | `TickBookPoolManagerV996.sol` | 45 KB | Orderbook (10k ticks) | ✅ Latest |
| **AMMEngine** | `AMMEngine.sol` | 9.1 KB | LMSR position trading | ✅ Stable |
| **LaunchpadEngine** | `LaunchpadEngine.sol` | 15 KB | Creator economics | ✅ Stable |
| **Collateralizer** | `Collateralizer.sol` | 8.5 KB | Token split/merge/redeem | ✅ Stable |
| **OutcomeToken** | `OutcomeToken.sol` | 2.5 KB | YES/NO ERC20 tokens | ✅ Stable |

---

## 🔧 Common Tasks

### "How do I create a market?"
→ [06-LaunchpadEngine.md § Create Market](./06-LaunchpadEngine.md#1-create-market)

### "How do I place an order?"
→ [03-TickBook.md § Place Order](./03-TickBook.md#2-place-order-v996)

### "How does settlement work?"
→ [02-TruthMarket.md § Market Lifecycle](./02-TruthMarket.md#-market-lifecycle)

### "How do fees work?"
→ [06-LaunchpadEngine.md § Economics Model](./06-LaunchpadEngine.md#-economics-model)

### "What are the recent bug fixes?"
→ [03-TickBook.md § V9.9.6-fix9d Bug Fixes](./03-TickBook.md#-v996-fix9d-bug-fixes)

### "What's the graduation mechanism?"
→ [06-LaunchpadEngine.md § Graduation Mechanism](./06-LaunchpadEngine.md#4-graduation-mechanism)

---

## 🧪 Testing

### Run All Tests
```bash
cd packages/contracts-core
forge test
```

### Run Specific Test Suite
```bash
# TickBook tests (138 passing)
forge test --match-path "*test/v9/*" -v

# Specific contract
forge test --match-contract "TickBookPoolManagerV996" -v
```

### Gas Benchmarking
```bash
cd packages/contracts-core
forge test --match-path "*benchmark*" --gas-report
```

### Expected Output
```
[✓] Test suite complete: 138/138 passing
Slowest tests:
  ~400k gas - placeOrder() with 50 tick crossing
  ~200k gas - claimFills()
  ~150k gas - simple trade
```

---

## 📐 Math Reference

### Probability ↔ Tick Conversion
```
tick = probability × 1000
prob = tick / 1000

Examples:
- 50% probability = tick 500
- 30% probability = tick 300
- 99% probability = tick 990
```

### LMSR Pricing
```
Cost = b × ln(exp(R_O/b) + exp(X/b)) - baseline
Returns smooth, continuous pricing with natural spread
```

### Fee Distribution (Post-Grad)
```
50% → bBase growth (buyback)
30% → LP yield pool
20% → protocol treasury
```

---

## 🔗 External References

### Related Docs
- [STATUS.md](../../STATUS.md) — Current deployments + known issues
- [DECISIONS.md](../../DECISIONS.md) — Architectural decision records (ADR-061 to ADR-067)
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — System architecture
- [README.md](../../README.md) — Project overview

### Code Locations
- **Contracts**: `packages/contracts-core/src/`
- **Tests**: `packages/contracts-core/test/v9/`
- **Scripts**: `packages/contracts-core/script/`
- **Deployment**: `packages/contracts-core/deployments/`

### Live Deployments
- **Base Sepolia**: See [STATUS.md](../../STATUS.md)
- **Monad Testnet**: See [STATUS.md](../../STATUS.md)

---

## 🎯 Key Concepts

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
| CREATED | ❌ | ❌ | ❌ |
| LIVE | ✅ | ❌ | ❌ |
| SETTLING | ❌ | ✅ (adjudicator) | ❌ |
| SETTLED | ❌ | ✅ (can veto) | ❌ |
| FINALIZED | ❌ | ✅ (locked) | ✅ |

### Fee Phases (LaunchpadEngine)
| Phase | Taker Fee | Distribution | Trigger |
|-------|-----------|--------------|---------|
| Pre-Graduation | 5% | 100% to creator | Before threshold |
| Post-Graduation | 1% | 50/30/20 split | After threshold |

---

## ⚠️ Important Notes

### For Mainnet Deployment
- [ ] Complete external security audit
- [ ] Implement emergency pause mechanism
- [ ] Set up multisig governance
- [ ] Deploy contract verification
- See [ARCHITECTURE-REVIEW.md § Critical](./ARCHITECTURE-REVIEW.md#-critical-blocking-mainnet)

### Alpha Phase
- Breaking changes allowed
- No backward compatibility guarantee
- All contracts subject to redeployment
- Use testnet only for development

---

## 💬 Questions or Issues?

- **Architecture/Design**: See DECISIONS.md (ADRs)
- **Specific Contracts**: See relevant doc (02-06)
- **Deployment**: See STATUS.md
- **Testing**: Run test suite (see above)
- **Development**: See root README.md

---

## 📊 Statistics

| Metric | Value |
|--------|-------|
| Total Lines of Code | ~2,500 |
| Core Contracts | 5 |
| Libraries | 3 |
| Interfaces | 5 |
| Test Cases | 138 |
| Test Pass Rate | 100% |
| Average Gas (trade) | ~250k |
| Deployment Size | ~58 KB (total) |

---

## 🎓 Learning Path

**Beginner** (New to prediction markets)
1. [01-OVERVIEW.md](./01-OVERVIEW.md)
2. [02-TruthMarket.md](./02-TruthMarket.md)
3. [05-Collateralizer.md](./05-Collateralizer.md)

**Intermediate** (Know trading mechanics)
1. [01-OVERVIEW.md](./01-OVERVIEW.md)
2. [03-TickBook.md](./03-TickBook.md) (Unified API)
3. [04-AMMEngine.md](./04-AMMEngine.md)

**Advanced** (System design)
1. All of above
2. [06-LaunchpadEngine.md](./06-LaunchpadEngine.md)
3. [ARCHITECTURE-REVIEW.md](./ARCHITECTURE-REVIEW.md)
4. Source code in `packages/contracts-core/src/`

---

**Built with ❤️ for the Sooth Protocol**

V9.9.6-fix9L: Unified Order API + Critical Bug Fixes + Spread Autoclaim  
Status: Alpha (Testnet Ready)  
Deployed: Base Sepolia, Monad, Arc Testnet  
Next: Security Audit → Mainnet
