# V11 User & Market Flow Refactoring Plan

> **Status**: Planning
> **Created**: 2026-01-19
> **Author**: Claude + Daniel
> **Target Version**: V11.0

---

## Executive Summary

This document outlines three major improvements to the Sooth Protocol user and market flows, addressing pain points discovered during V10 operation.

| Problem | Solution | Impact |
|---------|----------|--------|
| Markets can fail to graduate, trapping funds | Cost-locked trial period with dual exit paths | Risk-free trial for early participants |
| LP tokens are non-transferable | Settlement-locked ERC20 LP tokens | DeFi composability pre-settlement; lock after settlement |
| TickBook requires pre-funding vault | Lazy vault funding with EIP-2612 permit | Single-TX onboarding |

---

## Background: Current Architecture (V10.8.3)

### Market Lifecycle

```
Creation → [Bonding Phase] → Graduation → [Trading Phase] → Settlement → Redemption
              (AMM only)                   (AMM + Orderbook)
```

### Key Concepts

| Term | Definition |
|------|------------|
| **Market Deadline** | When the prediction event occurs (e.g., "Will BTC hit $100k by Dec 31?") |
| **Graduation** | When market transitions from AMM-only to AMM + Orderbook |
| **Graduation Threshold** | `fees >= bBase × ln(2) × multiplier` |
| **Settlement** | Adjudicator determines winning outcome |

### Current Pain Points

1. **No graduation timeout**: Markets can exist indefinitely without graduating
2. **Trapped funds**: If market expires before graduating, position holders wait for settlement
3. **LP illiquidity**: LP tokens cannot be transferred or used as collateral
4. **Vault friction**: TickBook requires separate deposit transaction before trading

---

## Problem 1: Markets Failing to Graduate

### Current Behavior

- Market created with deadline far in future (e.g., 6 months)
- Low trading activity → fees don't reach graduation threshold
- Market sits in "bonding phase" indefinitely
- Users who traded can't exit until market deadline + settlement

### Root Cause

No time limit on graduation. Markets can exist in limbo for months.

### Solution: Cost-Locked Trial Period

Introduce a **launchpad deadline** (3-7 days) separate from **market deadline**.

#### Key Principles

1. **Short trial period**: Markets must prove themselves within 3-7 days
2. **Full trading during trial**: Users can buy AND sell on AMM
3. **Cost locked**: Net cost (deposits - sell proceeds) cannot be withdrawn
4. **Sell proceeds reusable**: Can use to buy more, just can't withdraw
5. **Dual exit paths** based on what happens:

| Scenario | Exit Path | What User Gets |
|----------|-----------|----------------|
| **Graduated** | Normal trading continues | Full access to positions |
| **Timeout** (launchpad deadline) | `claimRefund()` | Net cost back minus 1% fee |
| **Early Settlement** (adjudicator settles) | `settleEarlyPosition()` | LMSR settlement (winners/losers) |

#### Why Two Exit Paths?

```
TIMEOUT (Market Failed to Prove Itself)
├── No real event happened
├── Fair to refund everyone's commitment
└── "Trial failed, here's your money back"

EARLY SETTLEMENT (Real Event Happened)
├── Adjudicator determined outcome
├── Fair to honor market positions
└── "Event resolved, winners get paid"
```

#### Timeline Example

```
Day 0:  Create market
        - marketDeadline = Dec 31, 2025 (6 months away)
        - launchpadDeadline = Day 5 (5 days)

Day 1:  Alice buys 100 YES for $40
        → lockedCost = $40, trialBalance = $0

Day 2:  Alice sells 50 YES for $25
        → lockedCost = $40 (unchanged!), trialBalance = $25

Day 3:  Alice buys 200 NO for $30 (uses $25 trial + $5 wallet)
        → lockedCost = $45, trialBalance = $0

Day 5:  OUTCOME DECISION POINT:

        Path A: GRADUATED (fees hit threshold)
        → Normal trading unlocked
        → Alice trades freely until Dec 31

        Path B: TIMEOUT (fees < threshold)
        → Market DISMISSED
        → Alice calls claimRefund()
        → Gets $44.55 back ($45 - 1% fee)

        Path C: EARLY SETTLEMENT (adjudicator settles on Day 3)
        → Real LMSR settlement
        → If YES won: Alice gets 50 YES = $50
        → If NO won: Alice gets 200 NO = $200
        → Losing side gets $0
```

#### State Tracking

```solidity
// Per-user, per-market tracking
mapping(address => mapping(address => uint256)) public lockedCost;    // Net new money in
mapping(address => mapping(address => uint256)) public trialBalance;  // From sells, reusable

// Market state
struct MarketState {
    // ... existing fields ...
    uint64 launchpadDeadline;  // NEW: End of trial period
    bool isDismissed;          // NEW: Failed to graduate
}
```

#### Configuration

| Parameter | Default | Range | Notes |
|-----------|---------|-------|-------|
| `defaultTrialPeriod` | 5 days | 3-7 days | Owner configurable |
| `dismissalFeeBps` | 100 (1%) | 50-200 | Spam protection |
| Per-market override | Optional | 3-7 days | Creator can specify |

---

## Problem 2: LP Token Non-Transferability

### Current Behavior

```solidity
// LP tokens are ledger balances, not ERC20
mapping(address => mapping(address => uint256)) public lpBalances;
```

- Cannot transfer LP to another address
- Cannot use as collateral in DeFi
- Cannot sell on DEX
- Cannot stake for additional yield

### Root Cause

Design choice from V8 to simplify accounting. LP value depends on settlement outcome, making pre-settlement transfers complex.

### Solution: Settlement-Locked ERC20 LP Tokens

Convert LP tokens to ERC20 with transfers allowed pre-settlement and locked after settlement.

#### Key Principles

1. **Pre-settlement**: LP tokens are transferable (liquidity and composability)
2. **Post-settlement**: LP tokens are locked once settlement occurs
3. **Backward compatible**: Existing markets keep ledger balances
4. **Decision (2026-01-19)**: Lock transfers after settlement (ideally at SETTLED)

#### Implementation

```solidity
contract LaunchpadLPToken is ERC20 {
    address public immutable market;

    function transfersUnlocked() public view returns (bool) {
        return !ITruthMarket(market).isSettled();
    }

    function _update(address from, address to, uint256 value) internal override {
        // Allow mints/burns always
        // Allow transfers only before settlement
        if (from != address(0) && to != address(0)) {
            if (!transfersUnlocked()) revert TransfersLocked();
        }
        super._update(from, to, value);
    }
}
```

#### Value Unlocked

| Capability | Pre-Settlement | Post-Settlement |
|------------|----------------|-----------------|
| Hold | ✅ | ✅ |
| Redeem | ✅ (floor value) | ✅ (floor value) |
| Transfer | ✅ | ❌ |
| Trade on DEX | ✅ | ❌ |
| Use as collateral | ✅ | ❌ |
| Stake for yield | ✅ | ❌ |

#### Migration Path

1. **New markets**: Automatically get ERC20 LP tokens
2. **Existing markets**: Keep ledger balances (backward compatible)
3. **Optional**: Add `migrateLPToERC20(market)` for legacy markets

---

## Problem 3: TickBook Vault Requirement

### Current Behavior

```
User wants to place order on TickBook:
1. approve(USDC, amount)         ← Transaction 1
2. depositUsdc(amount)           ← Transaction 2
3. placeOrder(...)               ← Transaction 3

Total: 3 transactions for first order
```

### Root Cause

TickBook uses vault-based custody for capital efficiency and flash accounting. But this creates friction for new users.

### Solution: Lazy Vault Funding with Permit

Allow users to place orders directly from wallet using EIP-2612 permit.

#### Key Principles

1. **First-time users**: Single permit signature + order in one TX
2. **Repeat users**: Use vault balance (fast, cheap)
3. **Backward compatible**: Existing vault flows still work

#### Implementation

```solidity
function placeOrderWithPermit(
    bytes32 marketKey,
    uint8 outcome,
    uint256 shares,
    uint16 tickLower,
    uint16 tickUpper,
    uint256 maxCost,
    bytes calldata permitData  // EIP-2612 permit signature
) external returns (uint256 orderId, ...) {

    // Check vault balance
    uint256 available = vault.availableUsdcWad(msg.sender);
    uint256 required = _calculateCollateral(...);

    // Auto-fund if needed
    if (available < required) {
        uint256 deficit = required - available;

        // Execute permit if provided
        if (permitData.length > 0) {
            _executePermit(msg.sender, deficit, permitData);
        }

        // Pull from wallet and credit to vault
        usdc.transferFrom(msg.sender, address(vault), deficit);
        vault.creditUsdcAvailable(msg.sender, deficit);
    }

    // Place order normally
    return _placeOrderInternal(...);
}
```

#### Gas Comparison

| Scenario | Current Flow | Lazy Funding |
|----------|--------------|--------------|
| First order | 250k (approve + deposit + order) | 180k (permit + order) |
| Repeat order | 120k | 120k |
| 10 orders | 1.33M | 1.30M |

---

## Implementation Roadmap

### Phase 1: V10.9 (Quick Wins) - 2-3 weeks

```
Week 1:
├── [ ] Add launchpadDeadline to MarketState
├── [ ] Implement lockedCost and trialBalance tracking
├── [ ] Update tradePositions for trial period logic
└── [ ] Block withdrawals during trial

Week 2:
├── [ ] Implement dismissMarket()
├── [ ] Implement claimRefund()
├── [ ] Implement settleEarlyPosition()
└── [ ] Add view functions (getTrialStatus, getExitOptions)

Week 3:
├── [ ] Frontend: Trial period banner
├── [ ] Frontend: Dismissal/refund UI
├── [ ] Testing: Unit tests, invariant tests
└── [ ] Deploy to testnet
```

### Phase 2: V11.0 (Strategic) - 4-6 weeks

```
Week 4-5:
├── [ ] LaunchpadLPToken ERC20 contract (transferable pre-settlement, locked post-settlement)
├── [ ] LaunchpadEngine integration
├── [ ] placeOrderWithPermit() for TickBook
└── [ ] TickBookVault lazy funding support

Week 6-7:
├── [ ] Frontend: LP transfer UI (pre-settlement) + lock indicator
├── [ ] Frontend: Unified order button with permit
├── [ ] Migration tooling for legacy markets
└── [ ] Comprehensive testing

Week 8:
├── [ ] Security review
├── [ ] Gas optimization
├── [ ] Documentation
└── [ ] Mainnet deployment planning
```

---

## Contract Changes Summary

### LaunchpadEngine.sol

```solidity
// NEW State Variables
uint64 public defaultTrialPeriod = 5 days;
uint16 public dismissalFeeBps = 100;
mapping(address => mapping(address => uint256)) public lockedCost;
mapping(address => mapping(address => uint256)) public trialBalance;

// Updated Struct
struct MarketState {
    // ... existing ...
    uint64 launchpadDeadline;
    bool isDismissed;
}

// NEW Functions
function dismissMarket(address market) external;
function claimRefund(address market) external returns (uint256);
function settleEarlyPosition(address market) external returns (uint256);
function getTrialStatus(address market, address user) external view returns (...);
function getExitOptions(address market, address user) external view returns (...);

// MODIFIED Functions
function createMarket(..., uint64 trialPeriod) external;  // New param
function tradePositions(...) external;  // Trial period logic
```

### LaunchpadLPToken.sol (NEW)

```solidity
contract LaunchpadLPToken is ERC20 {
    address public immutable market;
    address public immutable launchpadEngine;

    function transfersUnlocked() public view returns (bool);
    function mint(address to, uint256 amount) external;
    function burn(address from, uint256 amount) external;
}
```

### TickBookPoolManager.sol

```solidity
// NEW Function
function placeOrderWithPermit(
    bytes32 marketKey,
    uint8 outcome,
    uint256 shares,
    uint16 tickLower,
    uint16 tickUpper,
    uint256 maxCost,
    bytes calldata permitData
) external returns (...);
```

---

## Frontend Changes Summary

### New Components

1. **TrialPeriodBanner** - Shows trial countdown and restrictions
2. **DismissedRefundPanel** - Claim refund UI for dismissed markets
3. **EarlySettlementPanel** - Settlement UI for early-settled markets
4. **LPTransferModal** - Transfer LP tokens pre-settlement (lock after settlement)

### Modified Components

1. **SimpleTradingPanel** - Add trial period awareness
2. **OrderbookForm** - Add permit-based order placement
3. **LPPositionsCard** - Show transfer button pre-settlement
4. **MarketCard** - Show trial status badge

### New Hooks

```typescript
useTrialStatus(market)      // Trial period info
useExitOptions(market)      // Available exit paths
useRefundAmount(market)     // Refund calculation
usePlaceOrderWithPermit()   // Permit-based orders
useLPToken(market)          // ERC20 LP token info
```

---

## Testing Requirements

### Unit Tests

- [ ] Trial period state transitions
- [ ] lockedCost tracking accuracy
- [ ] trialBalance reuse for buys
- [ ] claimRefund calculations
- [ ] settleEarlyPosition payouts
- [ ] LP token transfer restrictions
- [ ] Permit-based order placement

### Invariant Tests

- [ ] `lockedCost[user] + trialBalance[user] <= totalDeposits`
- [ ] `sum(lockedCost) == totalLockedCost[market]`
- [ ] LP token supply == sum of all balances
- [ ] Vault balance consistency with lazy funding

### Integration Tests

- [ ] Full trial → graduation flow
- [ ] Full trial → timeout → refund flow
- [ ] Full trial → early settlement flow
- [ ] LP token lifecycle (mint → transfer pre-settle → lock on settle → redeem)
- [ ] Permit → order → fill → claim flow

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Accounting bugs in trial tracking | Medium | High | Extensive testing, invariant tests |
| LP token transfer exploits | Low | High | Lock after settlement to prevent post-resolution trading |
| Permit replay attacks | Low | Medium | Nonce-based, deadline expiry |
| Gas cost increase | Medium | Low | Optimize hot paths, benchmark |

---

## Review Notes (2026-01-19)

- Clarify `lockedCost` semantics vs example; align definition with net cost or gross deposits.
- Define handling of open positions and `trialBalance` on dismissal/timeout to prevent double-claims.
- Specify WAD/USDC conversions at the vault boundary for lazy funding with permit.
- Replace `lockedCost + trialBalance <= totalDeposits` with a solvency-based invariant (profits can exceed deposits).

---

## Open Questions

1. **Trial period configurability**: Should creators set custom trial periods, or use protocol default?
   - **Decision**: Both - default 5 days, creator can override 3-7 days

2. **Dismissal fee destination**: Protocol treasury or burn?
   - **Decision**: Protocol treasury (revenue)

3. **LP token standard**: ERC20 or ERC721 (NFT)?
   - **Decision**: ERC20 (fungible, simpler DeFi integration)

4. **Permit support on all chains**: Does USDC support EIP-2612 everywhere?
   - **Decision**: Verify per-chain, fallback to approve if not supported

5. **LP transfer window**: Should LP transfers be allowed before or after settlement?
   - **Decision**: Transferable pre-settlement, locked after settlement

6. **Settlement timing**: Can adjudicators settle before market expiration?
   - **Decision**: Yes — allow early settlement when truth resolves, even if before deadline.

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Markets graduating | ~70% | ~85% (failed markets exit cleanly) |
| User onboarding time | 3 TX | 1 TX (with permit) |
| LP token utilization | 0 (no transfers) | Track pre-settlement volume |
| Dismissed market resolution | N/A | < 24h after timeout |

---

## References

- [AGENTS.md](/AGENTS.md) - Development guide
- [knowledge.md](/.claude/rules/knowledge.md) - Protocol formulas
- [lessons.md](/.claude/rules/lessons.md) - Past mistakes to avoid
- [ADR-048](/packages/contracts-core/docs/adr/ADR-048-dual-balance-positions.md) - Position model
- [ADR-051](/packages/contracts-core/docs/adr/ADR-051-tickbook-vault.md) - Vault architecture

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-19 | Initial planning document created |
