# V9 Development Roadmap

**Status:** Active
**Last Updated:** 2025-12-28
**Version:** 9.0

---

## Executive Summary

The V8 core infrastructure is **production-ready** with optimized orderbook, creator economics, and settlement mechanics. V9 focuses on:
1. Integration of newly implemented features (TransientDelta, Hooks)
2. SpotSell integration testing
3. Guardian system for decentralized oversight
4. Mainnet deployment preparation

---

## Current State (V8.12 → V9)

### Production-Ready (Deployed on Base Sepolia)

| Contract | Size | Status | Tests |
|----------|------|--------|-------|
| **TickBook** | 14,718 bytes | Optimized (40% reduction) | ✅ |
| **TickBookSpotSell** | 6,711 bytes | Extracted | ⚠️ Integration needed |
| **LaunchpadEngine** | ~20KB | Complete | ✅ 17/17 |
| **AMMEngine** | 20,786 bytes | Complete | ✅ |
| **Collateralizer** | 9,891 bytes | Complete | ✅ |
| **TruthMarket** | 5,365 bytes | Complete | ✅ |

### Implemented But Not Integrated

| Feature | File | Status |
|---------|------|--------|
| Flash Accounting | `TransientDelta.sol` | Ready, not integrated |
| Hooks System | `ITickBookHooks.sol` | Interface ready, no implementations |
| SpotSell | `TickBookSpotSell.sol` | Needs integration tests |

### Stubs / Deferred

| Feature | Location | Status |
|---------|----------|--------|
| T* Retroactive Settlement | `AMMEngine.applyRetroSettlement()` | Stub (reverts) |
| Guardian System | N/A | Not started |
| Yield Integration | N/A | Future |

---

## Phase 1: Integration & Testing (2-3 weeks)

### 1.1 SpotSell Integration Tests
**Priority:** High
**Effort:** 1 week

- [ ] Write comprehensive integration tests for TickBookSpotSell
- [ ] Verify bitmap coordination between TickBook and SpotSell
- [ ] Test maker attribution updates across both contracts
- [ ] Test edge cases: partial fills, cancellations, order expiry
- [ ] Gas benchmarks for spot sell operations

**Files:**
- `test/v8/TickBookSpotSell.t.sol` (create)
- `test/v8/TickBookSpotSellIntegration.t.sol` (create)

### 1.2 TransientDelta Integration
**Priority:** Medium
**Effort:** 1 week

- [ ] Integrate TransientDelta into TickBook for batch operations
- [ ] Add flash accounting entry points
- [ ] Write tests for multi-market arbitrage flows
- [ ] Document usage patterns

**Use Cases:**
```solidity
// Batch order placement with single settlement
TransientDelta.addDelta(user, -1000e6);  // Debit USDC once
placeOrder(market1, ...);  // No USDC transfer
placeOrder(market2, ...);  // No USDC transfer
TransientDelta.settle(user);  // Single transfer at end
```

### 1.3 Hooks Implementation
**Priority:** Medium
**Effort:** 1-2 weeks

Create initial hook implementations:

- [ ] **DynamicFeeHook** - Adjust fees based on volatility/volume
- [ ] **OracleVerificationHook** - Validate prices against external oracle
- [ ] **AnalyticsHook** - Emit detailed events for off-chain analytics

**Files:**
- `contracts/hooks/DynamicFeeHook.sol` (create)
- `contracts/hooks/OracleVerificationHook.sol` (create)
- `test/v8/hooks/` (create directory)

---

## Phase 2: Guardian System (3-4 weeks)

### 2.1 Guardian Registry
**Priority:** High
**Effort:** 1.5 weeks

```solidity
contract GuardianRegistry {
    struct Guardian {
        address addr;
        uint256 stake;
        uint256 markCount;
        uint256 successRate;
        bool active;
    }

    function register(uint256 stake) external;
    function unregister() external;  // 7-day cooldown
    function slash(address guardian, uint256 amount) external onlyOwner;
}
```

- [ ] Guardian registration with minimum stake (e.g., 1000 USDC)
- [ ] Stake slashing for malicious marking
- [ ] Reputation tracking (success rate)
- [ ] Cooldown periods for unstaking

### 2.2 Market Marking System
**Priority:** High
**Effort:** 1.5 weeks

```solidity
contract MarketMarker {
    enum MarkType { SUSPICIOUS, MANIPULATED, RESOLVED_INCORRECTLY }

    function markMarket(address market, MarkType markType, bytes calldata evidence) external;
    function challengeMark(uint256 markId) external;
    function resolveMark(uint256 markId, bool valid) external onlyOwner;
}
```

- [ ] Guardian marks markets with evidence
- [ ] Challenge period (48-72 hours)
- [ ] Resolution mechanism (owner/DAO vote)
- [ ] Automatic market pause on confirmed manipulation

### 2.3 Dispute Resolution
**Priority:** Medium
**Effort:** 1 week

- [ ] Multi-guardian voting on disputes
- [ ] Evidence submission system
- [ ] Stake redistribution on resolution
- [ ] Integration with TruthMarket settlement

---

## Phase 3: Security & Audit (4-6 weeks)

### 3.1 Internal Security Review
**Priority:** Critical
**Effort:** 2 weeks

- [ ] Reentrancy analysis on all external calls
- [ ] Integer overflow/underflow review (post Solidity 0.8)
- [ ] Access control verification
- [ ] Flash loan attack vectors
- [ ] Price manipulation scenarios

### 3.2 External Audit
**Priority:** Critical
**Effort:** 4-6 weeks (parallel)

Recommended audit firms:
1. Trail of Bits
2. OpenZeppelin
3. Spearbit

Scope:
- Core contracts (TickBook, LaunchpadEngine, AMMEngine)
- New V9 additions (SpotSell, Hooks, Guardian)
- Economic invariants

### 3.3 Bug Bounty Program
**Priority:** High
**Effort:** Ongoing

- [ ] Set up Immunefi program
- [ ] Define reward tiers (Critical: $50K, High: $10K, Medium: $2K)
- [ ] Document attack surfaces

---

## Phase 4: Mainnet Preparation (2-3 weeks)

### 4.1 Deployment Scripts
**Priority:** High
**Effort:** 1 week

- [ ] Update `DeployV9.s.sol` with all V9 contracts
- [ ] Deterministic deployment addresses (CREATE2)
- [ ] Multi-chain deployment support (Base, Arbitrum, Optimism)
- [ ] Verification scripts for block explorers

### 4.2 Migration Plan
**Priority:** High
**Effort:** 1 week

- [ ] Document V8 → V9 migration steps
- [ ] Data migration scripts (if any state needs transfer)
- [ ] Rollback procedures
- [ ] Monitoring dashboards

### 4.3 Operational Readiness
**Priority:** High
**Effort:** 1 week

- [ ] Multisig setup for admin functions
- [ ] Emergency pause procedures
- [ ] Incident response playbook
- [ ] On-call rotation

---

## Phase 5: Post-Launch Enhancements (Ongoing)

### 5.1 T* Retroactive Settlement
**Priority:** Medium
**Effort:** 2-3 weeks (post-launch)

Replace the stub with full implementation:
- [ ] Define Merkle tree structure for T* snapshots
- [ ] Implement proof verification in `applyRetroSettlement()`
- [ ] Off-chain snapshot generation scripts
- [ ] Integration tests with historical data

### 5.2 Yield Integration
**Priority:** Low
**Effort:** 3-4 weeks (post-launch)

Integrate idle USDC with yield protocols:
- [ ] Aave V3 integration
- [ ] Spark protocol integration
- [ ] Automatic rebalancing logic
- [ ] Emergency withdrawal mechanism

### 5.3 Advanced Features (Future)
- ERC-4337 smart account integration
- ZK settlement verification (Brevis/Axiom)
- Cross-chain market support
- DAO governance with token launch

---

## Timeline Summary

```
Week 1-3:   Phase 1 - Integration & Testing
Week 4-7:   Phase 2 - Guardian System
Week 5-10:  Phase 3 - Security & Audit (overlapping)
Week 8-10:  Phase 4 - Mainnet Preparation
Week 11+:   Phase 5 - Post-Launch Enhancements
```

**Target Mainnet Launch:** ~10-12 weeks from start

---

## Risk Assessment

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Audit findings | High | Medium | Budget 2-3 weeks for fixes |
| SpotSell integration issues | Medium | Low | Isolated contract, can defer |
| Guardian system complexity | Medium | Medium | Start with basic version |
| Gas costs on mainnet | Medium | Low | Extensive benchmarking done |
| External dependency failures | Low | Low | No external dependencies |

---

## Success Metrics

### Phase 1 Exit Criteria
- [ ] 100% test coverage on SpotSell integration
- [ ] TransientDelta integrated with benchmarks
- [ ] At least 1 hook implementation working

### Phase 2 Exit Criteria
- [ ] Guardian registration flow working
- [ ] Market marking with evidence working
- [ ] Basic dispute resolution working

### Phase 3 Exit Criteria
- [ ] 0 critical findings in audit
- [ ] All high findings addressed
- [ ] Bug bounty program live

### Phase 4 Exit Criteria
- [ ] Successful testnet deployment
- [ ] All admin functions tested with multisig
- [ ] Monitoring dashboards operational

---

## Resource Requirements

| Phase | Engineers | Duration | Notes |
|-------|-----------|----------|-------|
| Phase 1 | 1-2 | 3 weeks | Integration focus |
| Phase 2 | 2 | 4 weeks | New contract development |
| Phase 3 | 1 + auditors | 6 weeks | External dependency |
| Phase 4 | 1-2 | 3 weeks | DevOps focus |

---

## Appendix: File Structure

```
contracts/
├── TickBook.sol              ✅ Optimized
├── TickBookSpotSell.sol      ✅ Ready for integration
├── TickBookVault.sol         ✅ Production
├── LaunchpadEngine.sol       ✅ Production
├── AMMEngine.sol             ✅ Production (T* stub)
├── Collateralizer.sol        ✅ Production
├── TruthMarket.sol           ✅ Production
├── OutcomeToken.sol          ✅ Production
├── interfaces/
│   └── ITickBookHooks.sol    ✅ Ready for hooks
├── libraries/
│   ├── TickBitmap.sol        ✅ Optimized
│   ├── TickMath.sol          ✅ Production
│   ├── LMSRMath.sol          ✅ Production
│   └── TransientDelta.sol    ✅ Ready for integration
├── hooks/                    🆕 To be created
│   ├── DynamicFeeHook.sol
│   └── OracleVerificationHook.sol
└── guardian/                 🆕 To be created
    ├── GuardianRegistry.sol
    └── MarketMarker.sol

docs/v9/
├── DEVELOPMENT_ROADMAP.md    📍 This file
├── ADR-053-TickBookV2-Optimization.md
└── UNISWAP-RESEARCH-NOTES.md
```

---

## References

- [ADR-053: TickBook Optimization](./ADR-053-TickBookV2-Optimization.md)
- [Uniswap Research Notes](./UNISWAP-RESEARCH-NOTES.md)
- [V8 Deployment Summary](../V8_DEPLOYMENT_SUMMARY.md)
- [Original Roadmap](../ROADMAP.md)
