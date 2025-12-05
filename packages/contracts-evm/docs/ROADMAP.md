# Sooth Protocol Roadmap

**Updated:** 2025-12-04  
**Status:** Post-Testnet Deployment → Mainnet Preparation

---

## Current Status ✅

**Deployed on Base Sepolia:**

- TraderVault: Single entry point for all trading
- Market: Unified orderbook (Sell YES = Buy NO)
- Time-Lock: 48h lock on sell proceeds
- Settlement: Redeem winning shares for 1 USDC

**What Works:**

- ✅ Deposit/withdraw USDC
- ✅ Trade via AMM or limit orders
- ✅ Time-locked proceeds (anti-manipulation)
- ✅ Settlement redemption
- ✅ LP liquidity management

---

## Immediate Priorities (Weeks 1-4)

### 1. Guardian System 🛡️

**Why:** Key differentiator vs. Polymarket - decentralized market monitoring

**Implementation:**

- Guardian registration & staking
- Market marking mechanism
- Dispute resolution flow
- Cooldown periods
- Guardian dashboard UI

**Effort:** 2-3 weeks

### 2. Essential UX 📊

**Why:** Users need basic features to trade effectively

**Features:**

- Portfolio view (all positions)
- Transaction history
- Market search & filtering
- Basic price charts
- PnL tracking

**Effort:** 2-3 weeks

### 3. Test Coverage 🧪

**Why:** Required for audit preparation

**Target:** >90% coverage

- Unit tests for all functions
- Integration tests for user flows
- Fuzzing tests (Echidna/Foundry)
- Stress testing on testnet

**Effort:** 2 weeks

---

## Short-term (Months 2-4)

### Security Hardening 🔒

**Emergency Mechanisms:**

- Pause functionality
- Multi-sig guardian
- Circuit breakers
- Time-locks for critical ops

**Pre-Audit Prep:**

- Code cleanup & documentation
- Gas optimization pass
- Internal security review
- Audit materials preparation

**Effort:** 1 month

---

## Medium-term (Months 5-8)

### External Audits 🔍

**Scope:**

- 2-3 professional firms
- Budget: $100k-300k
- Fix all critical/high findings
- Get security sign-off

**Firms to Consider:**

- Trail of Bits (top tier)
- OpenZeppelin (solid mid-tier)
- Code4rena (competitive audit)

**Timeline:** 6-8 weeks + 2-4 weeks fixes

### Mainnet Launch 🚀

**Approach:**

- Start with limited markets
- Gradual rollout with caps
- Monitor and iterate
- Bug bounty program (Immunefi)

**Success Metrics:**

- 500+ users (Month 1)
- $100k+ TVL (Month 3)
- 10+ active guardians

---

## Long-term (Months 9-12+)

### Yield Integration 💰

**Goal:** Generate returns on idle USDC in TraderVault

**Implementation:**

- Aave/Spark strategy contracts
- Automatic rebalancing (keep 10% liquid)
- Yield distribution (pro-rata or protocol cut)
- Emergency withdrawal mechanisms

**Effort:** 2-3 weeks

### Institutional Features 🏢

- Permissioned vaults (KYC-gated)
- Compliance hooks
- API for programmatic trading
- Reporting & audit trails

### Advanced Analytics 📈

- Portfolio analytics (Sharpe, drawdown)
- Market correlations
- Leaderboards (traders, LPs, guardians)
- Social features (comments, discussions)

### Smart Account Integration 💳

- ERC-4337 implementation
- Cross-margin calculation
- Gasless trading (bundler integration)
- Multi-sig & social recovery

---

## Future (12+ Months)

### ZK Settlement 🔮

**Why Deferred:** Prove product-market fit first, then invest in ZK

**Scope:**

- ZK settlement verification
- Batch settlement proofs
- ZK adjudicators (on-chain state reading)
- Privacy features

**Timeline:** 6-9 months implementation
**Launch:** As major v2 upgrade

---

## Key Decisions

### Immediate

- [ ] Guardian staking amount?
- [ ] Dispute resolution mechanism?
- [ ] Audit firm selection?

### Short-term

- [ ] Mainnet launch network (Ethereum, Base, Arbitrum)?
- [ ] Initial market selection?
- [ ] LP incentive structure?

### Long-term

- [ ] Token launch timing?
- [ ] DAO governance structure?
- [ ] ZK framework (Brevis, Axiom, custom)?

---

## Success Criteria

### Phase 1: Feature Complete (Month 4)

- [ ] Guardian system deployed
- [ ] Essential UX complete
- [ ] > 90% test coverage
- [ ] Emergency mechanisms in place

### Phase 2: Mainnet Ready (Month 8)

- [ ] 2+ audits complete
- [ ] All critical findings fixed
- [ ] Bug bounty program live
- [ ] Mainnet deployment successful

### Phase 3: Product-Market Fit (Month 12)

- [ ] 10,000+ users
- [ ] $1M+ TVL
- [ ] $250k+ weekly volume
- [ ] 50+ active guardians

---

## Key Decisions

### Technical

- [ ] **Yield Distribution:** Pro-rata to users or protocol takes cut?
- [ ] **Lock Duration Range:** What min/max can Guardian configure?
- [ ] **Clawback Authority:** Who can trigger clawback and under what conditions?

### Business

- [ ] Mainnet launch network (Ethereum, Base, Arbitrum)?
- [ ] Initial market selection?
- [ ] LP incentive structure?
- [ ] Token launch timing?
- [ ] DAO governance structure?

### Future

- [ ] ZK framework (Brevis, Axiom, custom)?

---

## Architecture Benefits

Current architecture vs. previous version:

| Feature                   | Previous             | Current                |
| ------------------------- | -------------------- | ---------------------- |
| **Order Types**           | SELL only            | BUY + SELL unified     |
| **Collateral**            | Explicit lock/unlock | None - pay upfront     |
| **Entry Points**          | Market + TraderVault | TraderVault only       |
| **Yield on Idle**         | No                   | Yes (Aave/Spark ready) |
| **Settlement Protection** | No                   | 48h time-lock          |
| **Redemption**            | Manual               | Automated `redeem()`   |

---

## Resources Needed

**Team:**

- Smart contract developer (if not solo)
- Frontend developer (covered)
- Security auditor (external)

**Budget:**

- Audits: $100k-300k
- Bug bounty: $10k-50k
- Infrastructure: $5k-10k/year
- Marketing: $20k-50k
- **Total: $135k-410k**

---

## Next Steps (This Week)

1. Start guardian system design
2. Implement essential UX features
3. Begin comprehensive test suite
4. Reach out to audit firms for quotes
