# Launchpad V6 Test Coverage Analysis

## Current Test Coverage (16 tests)

### ✅ Covered
1. Market creation
2. Trading and fees
3. Graduation flow (auto and manual)
4. Expiry and refunds
5. LP vault operations (legacy - needs update)
6. Edge cases (invalid tier, double init, open-end)
7. Fee rate invariant

### ❌ Missing Critical Tests

#### 1. Pre-Graduation Locking (V6 Feature) - **CRITICAL**
- [ ] Test: All pre-graduation sells lock proceeds
- [ ] Test: Withdrawals blocked if user has locked proceeds
- [ ] Test: Locked proceeds can be used for buying
- [ ] Test: Lock queue FIFO reduction
- [ ] Test: Lock duration (24h)
- [ ] Test: Claim unlocked after 24h

#### 2. Liquidation (Guardian) - **CRITICAL**
- [ ] Test: Guardian can liquidate pre-graduation markets
- [ ] Test: Non-guardian cannot liquidate
- [ ] Test: Cannot liquidate graduated markets
- [ ] Test: Protocol fee on liquidation
- [ ] Test: Users can claim liquidation refund
- [ ] Test: Liquidation refund calculation (LP + locked proceeds)

#### 3. Force Graduate (Guardian) - **HIGH**
- [ ] Test: Guardian can force graduate
- [ ] Test: Non-guardian cannot force graduate
- [ ] Test: Cannot force graduate liquidated markets

#### 4. 2-Contract Architecture - **HIGH**
- [ ] Test: Market is its own GovernorVault
- [ ] Test: No separate LPVault deployed
- [ ] Test: Market holds USDC directly
- [ ] Test: Market implements ISoothGovernorVault

#### 5. Immutable Factory - **MEDIUM**
- [ ] Test: Factory has no Ownable
- [ ] Test: Factory has no setter functions
- [ ] Test: Factory references ProtocolConfig
- [ ] Test: Factory constructor parameters immutable

#### 6. LP Token Minting - **HIGH**
- [ ] Test: Creator receives LP tokens on creation
- [ ] Test: Traders receive LP tokens from fees (pre-grad)
- [ ] Test: LP token exchange rate calculation
- [ ] Test: LP token redemption (post-settlement/liquidation)
- [ ] Test: LP tokens cannot be redeemed while market active

#### 7. ProtocolConfig Integration - **MEDIUM**
- [ ] Test: Factory references ProtocolConfig
- [ ] Test: Guardian from ProtocolConfig can liquidate
- [ ] Test: Liquidation fee from ProtocolConfig applied

#### 8. Invariant Tests - **CRITICAL**
- [ ] Invariant: `totalAssets >= totalLockedProceeds` (solvency)
- [ ] Invariant: `sum(LP balances) == totalSupply` (LP accounting)
- [ ] Invariant: `bBase never decreases` (already tested)
- [ ] Invariant: `lockedProceeds[user] <= totalLockedProceeds` (lock consistency)
- [ ] Invariant: `totalAssets == USDC balance` (asset tracking)

#### 9. Edge Cases - **HIGH**
- [ ] Test: Zero locked proceeds usage
- [ ] Test: Partial locked proceeds usage
- [ ] Test: Lock queue exhaustion
- [ ] Test: Multiple users with locked proceeds
- [ ] Test: WAD math precision (fee to b conversion)
- [ ] Test: Overflow protection (large trades)

#### 10. Adjudicator System - **MEDIUM**
- [ ] Test: Market creation with adjudicator parameter
- [ ] Test: Adjudicator registry integration (if used)

## Test Priority

### P0 (Critical - Funds at Risk)
1. Pre-graduation locking tests
2. Liquidation tests
3. Invariant tests (solvency)

### P1 (High - Core Functionality)
4. Force graduate tests
5. LP token minting/redemption
6. 2-contract architecture verification
7. Locked proceeds usage

### P2 (Medium - Edge Cases)
8. ProtocolConfig integration
9. Immutable Factory verification
10. Edge cases (WAD math, overflow)

### P3 (Low - Nice to Have)
11. Adjudicator system tests
12. Performance/stress tests

## Known Issues from LESSONS_LEARNED.md

### WAD Math Bugs
- ✅ Check: Fee to b conversion uses `/1e18` correctly
- ✅ Check: LP token minting doesn't multiply WAD×WAD
- ✅ Check: Exchange rate calculation

### Authorization Bugs
- ✅ Check: Guardian authorization (ProtocolConfig)
- ✅ Check: TraderVault authorization for locked proceeds usage
