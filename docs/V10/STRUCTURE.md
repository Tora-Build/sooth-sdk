# Documentation Structure

**Date**: 2026-01-06  
**Version**: V10.0.0  
**Status**: Complete documentation suite

---

## Directory Organization

```
docs/V10/
├── contracts/                      # Smart contracts
│   ├── README.md                   # Navigation (role-based learning)
│   ├── 01-OVERVIEW.md              # Executive summary
│   ├── 02-TruthMarket.md           # Market lifecycle
│   ├── 03-TickBookPoolManager.md   # Unified orderbook (V10)
│   ├── 04-AMMEngine.md             # LMSR positions
│   ├── 05-Collateralizer.md        # Token operations
│   ├── 06-LaunchpadEngine.md       # Creator economics
│   ├── 07-TickBookVault.md         # Singleton vault
│   └── ARCHITECTURE-REVIEW.md      # Analysis + next steps
│
├── testing/                        # Test suite
│   └── README.md                   # Test navigation
│
└── STRUCTURE.md                    # This file
```

---

## Quick Navigation

### By Role

**Project Manager**
- Start: [contracts/README.md](./contracts/README.md)
- Then: [contracts/ARCHITECTURE-REVIEW.md](./contracts/ARCHITECTURE-REVIEW.md)

**Smart Contract Developer**
- Start: [contracts/01-OVERVIEW.md](./contracts/01-OVERVIEW.md)
- Read: [contracts/02-07.md](./contracts/)
- Reference: [testing/](./testing/)

**QA/Tester**
- Start: [testing/README.md](./testing/README.md)
- Reference: Contract docs for expected behavior

**Security Auditor**
- Start: [contracts/ARCHITECTURE-REVIEW.md](./contracts/ARCHITECTURE-REVIEW.md)
- Deep dive: [contracts/02-07.md](./contracts/)
- Tests: [testing/](./testing/)

### By Topic

**V10 Unified Crossing**
-> [contracts/03-TickBookPoolManager.md](./contracts/03-TickBookPoolManager.md)

**Market Lifecycle**
-> [contracts/02-TruthMarket.md](./contracts/02-TruthMarket.md)

**Spot Sell Orders (New in V10)**
-> [contracts/03-TickBookPoolManager.md#spot-sell-orders](./contracts/03-TickBookPoolManager.md#spot-sell-orders)

**LMSR Pricing**
-> [contracts/04-AMMEngine.md](./contracts/04-AMMEngine.md)

**Creator Economics**
-> [contracts/06-LaunchpadEngine.md](./contracts/06-LaunchpadEngine.md)

---

## Content Summary

### Core Contracts (9 files)

| File | Purpose | Read Time |
|------|---------|-----------|
| 01-OVERVIEW.md | Executive summary | 5 min |
| 02-TruthMarket.md | Market lifecycle | 10 min |
| 03-TickBookPoolManager.md | Unified orderbook + V10 crossing | 15 min |
| 04-AMMEngine.md | LMSR positions | 12 min |
| 05-Collateralizer.md | Token operations | 8 min |
| 06-LaunchpadEngine.md | Creator economics | 10 min |
| 07-TickBookVault.md | Singleton vault | 8 min |
| ARCHITECTURE-REVIEW.md | Analysis + next steps | 15 min |

**Total**: ~85 min to read all

---

## V10 Key Changes from V9

| Feature | V9 | V10 |
|---------|----|----|
| **Tick Storage** | Separate range + spot | Unified `TickLiquidity` struct |
| **Crossing Logic** | Range orders only | Unified: Spot first, then Range |
| **Spot Sells** | Separate system | Integrated into crossing |
| **Bitmap Search** | Single bitmap | Dual bitmap (range + spot) |
| **Settlement** | Mint synthetic | Spot recycles, Range mints |

---

## Learning Paths

### Path 1: Quick Overview (30 mins)
1. [contracts/01-OVERVIEW.md](./contracts/01-OVERVIEW.md) (5 min)
2. [contracts/ARCHITECTURE-REVIEW.md](./contracts/ARCHITECTURE-REVIEW.md) - strengths section (10 min)
3. [contracts/03-TickBookPoolManager.md](./contracts/03-TickBookPoolManager.md) - V10 changes (15 min)

### Path 2: Developer (4 hours)
1. [contracts/README.md](./contracts/README.md) - navigation (5 min)
2. [contracts/01-07.md](./contracts/) - all contracts (2.5 hours)
3. [testing/README.md](./testing/README.md) (10 min)
4. [contracts/ARCHITECTURE-REVIEW.md](./contracts/ARCHITECTURE-REVIEW.md) (45 min)

### Path 3: Auditor (8 hours)
1. [contracts/ARCHITECTURE-REVIEW.md](./contracts/ARCHITECTURE-REVIEW.md) (1 hour)
2. [contracts/01-07.md](./contracts/) - all contracts (3.5 hours)
3. [testing/](./testing/) - full test suite (1.5 hours)
4. Source code review (2 hours)

---

## Quality Checklist

**Content**:
- All 7 core contracts documented
- Architecture review + next steps
- Role-based navigation
- Cross-references throughout

**Coverage**:
- V10 unified crossing documented
- Spot sell integration explained
- All new data structures covered

**Accuracy**:
- Matches V10 codebase
- Code examples from actual contracts
- ADR references included

---

## Maintenance

### Update Protocol
1. When contracts change -> Update `/contracts/` docs
2. When tests added -> Update `/testing/` docs
3. When new features -> Add to OVERVIEW.md
4. Weekly -> Check for drift

### Version Control
- Tag docs with smart contract version (V10)
- Include date in headers (2026-01-06)
- Track in git alongside code

---

## Cross-References

### Core -> Testing
- [contracts/01-OVERVIEW.md](./contracts/01-OVERVIEW.md) references [testing/README.md](./testing/README.md)
- [contracts/03-TickBookPoolManager.md](./contracts/03-TickBookPoolManager.md) links to test files

### External References
- [DECISIONS.md](../../DECISIONS.md) - Architecture decision records
- [STATUS.md](../../STATUS.md) - Current deployments
- [CHANGELOG.md](../../CHANGELOG.md) - Release history

---

## FAQ

**Q: Where do I start?**  
A: See [contracts/README.md](./contracts/README.md) for role-based guidance

**Q: What's new in V10?**  
A: See [contracts/01-OVERVIEW.md](./contracts/01-OVERVIEW.md) and [contracts/03-TickBookPoolManager.md](./contracts/03-TickBookPoolManager.md)

**Q: How does unified crossing work?**  
A: Read [contracts/03-TickBookPoolManager.md#unified-crossing](./contracts/03-TickBookPoolManager.md#unified-crossing)

**Q: How do spot sells integrate?**  
A: Read [contracts/03-TickBookPoolManager.md#spot-sell-orders](./contracts/03-TickBookPoolManager.md#spot-sell-orders)

---

**Last Updated**: 2026-01-06  
**Status**: Complete documentation  
**Target Audience**: Developers, auditors, managers  
**Next Review**: After V10 deployment
