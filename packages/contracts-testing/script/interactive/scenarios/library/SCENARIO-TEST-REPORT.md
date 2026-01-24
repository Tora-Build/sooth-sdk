# Scenario Test Report

> **Run these tests periodically** (weekly or before deployments) to verify protocol integrity.

**Last Run**: 2026-01-24  
**Chain**: Base Sepolia (84532)  
**CLI Version**: V11.0

## Quick Start

```bash
cd packages/contracts-testing

# Full lifecycle test (recommended)
bun run script/interactive/interactive-test.ts --chain=baseSepolia --scenario=market-lifecycle-multi-actor

# Trial period dismissal test (V11)
bun run script/interactive/interactive-test.ts --chain=baseSepolia --scenario=trial-period

# Other scenarios (require existing market)
bun run script/interactive/interactive-test.ts --chain=baseSepolia --scenario=order-lifecycle
```

## Scenario Status

### V11 Scenarios (Self-Contained)

| Scenario | Status | Steps | Zero-Sum | Last Run | Notes |
|----------|--------|-------|----------|----------|-------|
| `market-lifecycle-multi-actor` | ✅ PASS | 50 | 0.00 USDC | 2026-01-24 | Full lifecycle, 5 actors |
| `trial-period` | ✅ PASS | 19 | 0.00 USDC | 2026-01-24 | V11 dismissal + refund flow |

### Legacy Scenarios (Pre-V11, TickBook Only)

These scenarios were written before V11 and only test TickBook operations. They need updating to be self-contained.

| Scenario | Status | Notes |
|----------|--------|-------|
| `order-lifecycle` | ⚠️ LEGACY | Needs graduated market, no V11 features |
| `basic-roundtrip` | ⚠️ LEGACY | Needs graduated market, no V11 features |
| `multi-actor-orderbook` | ⚠️ LEGACY | Needs graduated market, no V11 features |
| `stress-orderbook` | ⚠️ LEGACY | Needs graduated market, no V11 features |

**TODO**: Update legacy scenarios to either:
1. Create their own market and graduate it (like `market-lifecycle-multi-actor`)
2. Or add `setmarket latest` to find an existing graduated market

## Primary Test: market-lifecycle-multi-actor

### Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MARKET LIFECYCLE FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Phase 1        Phase 2-3       Phase 4-5      Phase 6       Phase 7-8     │
│  ┌───────┐      ┌─────────┐     ┌─────────┐   ┌─────────┐   ┌───────────┐  │
│  │CREATE │ ──▶  │  TRADE  │ ──▶ │GRADUATE │──▶│ SETTLE  │──▶│  REDEEM   │  │
│  │       │      │   AMM   │     │TickBook │   │         │   │   P&L     │  │
│  └───────┘      └─────────┘     └─────────┘   └─────────┘   └───────────┘  │
│     │               │               │              │              │         │
│   Alice          Bob,Charlie    Bob,Charlie      David       All Actors    │
│  (creator)       (traders)     (maker,taker)  (adjudicator)  (redeem)      │
│                                     │                                       │
│                                   Ellen                                     │
│                                  (keeper)                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Latest Run Results

**Market**: `0x3bBCC4576074106Cc12A2CE42168B5CFc980b5eb`  
**Duration**: 54.2s  
**Steps**: 50 (2 expected failures)

```
Actor USDC Δ:          +158,450.44 USDC
Protocol USDC Δ:         +1,549.56 USDC
─────────────────────────────────────────────────
Total Accounted:       +160,000.00 USDC
USDC Minted:           +160,000.00 USDC
─────────────────────────────────────────────────
✓ CHECKSUM:            0.00 USDC (EXACT BALANCE)
```

### Invariant Checks

| Invariant | Status |
|-----------|--------|
| `vault.solvent` | ✅ PASS |
| `orders.noOverflow` | ✅ PASS |
| `market.tickValid` | ✅ PASS |
| `vault.reservedBounds` | ✅ PASS |
| `checksum.zeroSum` | ✅ PASS |
| `lp.transferable` (pre-settlement) | ✅ PASS |
| `lp.locked` (post-settlement) | ✅ PASS |
| `amm.tradingStopped` (post-settlement) | ✅ PASS |
| `tickbook.tradingStopped` (post-settlement) | ✅ PASS |

### Fee Distribution

| Metric | Value |
|--------|-------|
| Pre-grad Fees (5% AMM) | 382.97 USDC → LP Pool |
| Post-grad Fees (1% TickBook) | 13.67 USDC |
| → LP Yield Pool (80%) | 10.93 USDC |
| → Protocol Treasury (20%) | 2.73 USDC |

---

## Secondary Test: trial-period

Tests V11 trial period dismissal and refund flow.

### Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TRIAL PERIOD DISMISSAL FLOW                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Phase 1        Phase 2         Phase 3        Phase 4        Phase 5      │
│  ┌───────┐      ┌─────────┐     ┌─────────┐   ┌─────────┐   ┌───────────┐  │
│  │CREATE │ ──▶  │  TRADE  │ ──▶ │ DISMISS │──▶│ REFUND  │──▶│ CHECKSUM  │  │
│  │       │      │   AMM   │     │         │   │         │   │           │  │
│  └───────┘      └─────────┘     └─────────┘   └─────────┘   └───────────┘  │
│     │               │               │              │                        │
│   Alice          Bob,Charlie      Alice        Bob,Charlie                  │
│  (creator)       (traders)      (creator)      (traders)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Latest Run Results

**Market**: `0xb9838BE034F721d596ebd379072d92832b4D7ee5`  
**Duration**: 26.4s  
**Steps**: 19 (0 failures)

```
Actor USDC Δ:           +69,705.92 USDC
Protocol USDC Δ:           +294.08 USDC
─────────────────────────────────────────────────
Total Accounted:        +70,000.00 USDC
USDC Minted:            +70,000.00 USDC
─────────────────────────────────────────────────
✓ CHECKSUM:            0.00 USDC (EXACT BALANCE)
```

### Key Verifications

| Check | Result |
|-------|--------|
| Market created in trial period | ✅ |
| Trades lock costs during trial | ✅ (Bob: 55.12, Charlie: 49.90 USDC) |
| Creator can dismiss during trial | ✅ |
| Traders can claim refunds after dismissal | ✅ |
| Zero-sum after all refunds | ✅ |

### Notes

- Unredeemed positions remain (YES: 100, NO: 100, LP: 351.57) because dismissal refunds USDC costs, not positions
- The 294.08 USDC in protocol contracts is alice's creator deposit + fees (market was dismissed, not settled)

---

## Tracked USDC Locations

The `checksum` command tracks ALL protocol USDC to verify zero-sum:

| Location | Description |
|----------|-------------|
| Actor wallets | Direct USDC holdings |
| Actor vault balances | TickBookVault available + reserved |
| LaunchpadEngine | Creator deposits + fees + lpYieldPool |
| AMMEngine | AMM liquidity pool |
| TickBookPoolManager | Should be 0 (pass-through) |
| Collateralizer | ERC20 token backing |
| ProtocolTreasury | Protocol fee recipient |
| vaultMarketCollateral | Internal outcome backing |

## Lessons Learned

### 1. Redemption Order Matters (2026-01-23)

**Problem**: Scenario failed with "insufficient market collateral" when redeeming.

**Root Cause**: `claimPooledRefunds` draws from `_marketCollateralWad`. If users redeem internal outcomes first, the collateral gets depleted.

**Solution**: Always execute cleanup in this order:
1. `cancel` (all orders)
2. `claimrefunds` (pooled refunds)
3. `redeem` (internal outcomes)
4. `redeemamm` (AMM positions)
5. `redeemlp` (LP tokens)

### 2. AMM Positions Must Be Tracked (2026-01-23)

**Problem**: Checksum showed -71.24 USDC imbalance after full scenario.

**Root Cause**: Pre-graduation trades via `LaunchpadEngine.tradePositions` create positions in `AMMEngine`, but these weren't being tracked.

**Solution**: Added `AMMEngine.getPosition(market, user)` to snapshot/checksum.

### 3. Contract-Held USDC Must Be Tracked (2026-01-24)

**Problem**: Checksum showed -1.27 USDC imbalance even after AMM fix.

**Root Cause**: Two sources of "stuck" USDC weren't tracked:
- `vaultMarketCollateral` — backing for internal outcomes
- `lpYieldPool` — unclaimed LP yield in LaunchpadEngine

**Solution**: Added tracking for both. Display "Potential Stuck USDC" section when non-zero.

### 4. Expected Failures Need Documentation (2026-01-24)

**Problem**: Some scenario steps fail due to contract constraints (e.g., order reverts), making it hard to distinguish bugs from expected behavior.

**Solution**: Use `expect: fail` in YAML and document WHY the failure is expected in the scenario file.

### 5. Trial Period Dismissal Refunds Costs, Not Positions (2026-01-24)

**Observation**: After dismissal, traders get their USDC costs refunded but keep their outcome token positions.

**Why**: The dismissal flow is designed to make traders whole on their USDC investment. The outcome tokens become worthless (market never settles) but remain in the system.

**Implication**: Unredeemed positions after dismissal are expected and don't affect zero-sum validation.

### 6. Legacy Scenarios Need V11 Updates (2026-01-24)

**Problem**: Pre-V11 scenarios (`basic-roundtrip`, `order-lifecycle`, `multi-actor-orderbook`, `stress-orderbook`) assume a pre-existing graduated market and only test TickBook operations.

**Why they fail**: V11 markets start in trial period and require graduation before TickBook trading. These scenarios skip market creation entirely.

**Recommendation**: 
- For quick TickBook testing: Run `market-lifecycle-multi-actor` first to create a graduated market, then run legacy scenarios with `setmarket <address>`
- For CI/automation: Update legacy scenarios to create + graduate their own markets

## Maintenance Schedule

| Frequency | Action |
|-----------|--------|
| **Weekly** | Run `market-lifecycle-multi-actor` on Base Sepolia |
| **Pre-deploy** | Run full scenario suite, verify zero-sum |
| **Post-deploy** | Run smoke test on new deployment |
| **On contract change** | Run affected scenarios, update expected values |

## Historical Runs

| Date | Scenario | Result | Notes |
|------|----------|--------|-------|
| 2026-01-24 | trial-period | ✅ PASS | V11 dismissal + refund flow verified |
| 2026-01-24 | market-lifecycle-multi-actor | ✅ PASS | Added vaultMarketCollateral + lpYieldPool tracking |
| 2026-01-23 | market-lifecycle-multi-actor | ✅ PASS | Added AMM position tracking |
| 2026-01-22 | market-lifecycle-multi-actor | ❌ FAIL | -71.24 USDC imbalance (AMM not tracked) |

## Files

### V11 Scenarios (Recommended)
- [`market-lifecycle-multi-actor.yaml`](./market-lifecycle-multi-actor.yaml) — Full lifecycle scenario
- [`market-lifecycle-multi-actor.md`](./market-lifecycle-multi-actor.md) — Detailed documentation
- [`trial-period.yaml`](./trial-period.yaml) — V11 dismissal and refund flow

### Legacy Scenarios (Need Updates)
- [`order-lifecycle.yaml`](./order-lifecycle.yaml) — Order placement/fill/cancel (needs market)
- [`basic-roundtrip.yaml`](./basic-roundtrip.yaml) — Simple order + cross (needs market)
- [`multi-actor-orderbook.yaml`](./multi-actor-orderbook.yaml) — Multiple actors trading (needs market)
- [`stress-orderbook.yaml`](./stress-orderbook.yaml) — High-volume testing (needs market)
