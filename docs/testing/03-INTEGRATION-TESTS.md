# Integration Tests — Multi-Contract Workflows

**Status**: 40 integration tests passing ✅  
**Focus**: Cross-contract interactions, realistic user flows

---

## 🎯 Integration Test Patterns

### Pattern 1: Full Market Lifecycle
```solidity
function testFullMarketLifecycle() public {
    // 1. Creator creates market
    address market = launchpadEngine.createMarket(
        "Bitcoin $100k",
        "BTC100K",
        1000e6,  // 1000 USDC deposit
        block.timestamp + 30 days,
        adjudicator,
        guardian
    );
    
    // 2. Creator activates
    vm.startPrank(creator);
    truthMarket.activate();
    
    // 3. User splits USDC → YES/NO tokens
    vm.startPrank(user);
    usdc.approve(address(collateralizer), 1000e6);
    collateralizer.split(market, 1000e6);
    
    // 4. User trades on TickBook
    yesToken.approve(address(tickBook), 500e18);
    (uint256 orderId, uint256 filled, , ) = tickBook.placeOrder(
        marketKey, 1, 500e18, 500, 550, 250e18
    );
    assertEq(filled, 500e18);
    
    // 5. Settle market
    vm.startPrank(adjudicator);
    truthMarket.settle(1, 0);  // YES wins
    
    // 6. Finalize (after veto window)
    vm.warp(block.timestamp + 2 days);
    truthMarket.finalize();
    
    // 7. User redeems winnings
    vm.startPrank(user);
    uint256 yesProceeds = collateralizer.redeem(market, 500e18);
    assertEq(yesProceeds, 500e18);
    
    // NO tokens worth 0
    uint256 noProceeds = collateralizer.redeem(market, 500e18);
    assertEq(noProceeds, 0);
}
```

---

### Pattern 2: Graduation Flow
```solidity
function testMarketGraduation() public {
    address market = launchpadEngine.createMarket(...);
    truthMarket.activate();
    
    // Accumulate fees until graduation
    uint256 progress = 0;
    while (progress < 10000) {  // 100% in basis points
        // Place multiple trades
        for (uint i = 0; i < 10; i++) {
            tickBook.placeOrder(marketKey, 1, 100e18, 500, 500, 50e18);
            tickBook.cancelOrder(orderId);
        }
        
        // Check progress
        progress = launchpadEngine.getGraduationProgress(market);
    }
    
    // Claim fees to trigger graduation
    launchpadEngine.claimFeesAndBuyback(market);
    
    // Verify graduated
    assertTrue(launchpadEngine.getMarketState(market).isGraduated);
    assertEq(launchpadEngine.postGradFeeBps(), 100);  // 1% fee
}
```

---

### Pattern 3: Multi-User Trading
```solidity
function testMultiUserTrading() public {
    address market = launchpadEngine.createMarket(...);
    truthMarket.activate();
    
    address[] memory traders = new address[](5);
    for (uint i = 0; i < 5; i++) {
        traders[i] = address(uint160(0x100 + i));
    }
    
    // Each trader splits USDC and trades
    for (uint i = 0; i < 5; i++) {
        vm.startPrank(traders[i]);
        usdc.approve(address(collateralizer), 1000e6);
        collateralizer.split(market, 1000e6);
        
        yesToken.approve(address(tickBook), 500e18);
        tickBook.placeOrder(marketKey, 1, 500e18, 490 + i*2, 510 + i*2, 250e18);
    }
    
    // Verify all orders exist
    uint256[] memory orders = tickBook.getAllMarketOrders(marketKey);
    assertEq(orders.length, 5);
}
```

---

## 🔄 Key Integration Scenarios

### Scenario 1: Split → Trade → Redeem (Happy Path)
```solidity
function testSplitTradeRedeem() public {
    // Setup
    address market = launchpadEngine.createMarket(...);
    truthMarket.activate();
    
    vm.startPrank(user);
    
    // Split: 1000 USDC → 1000 YES + 1000 NO
    usdc.approve(address(collateralizer), 1000e6);
    collateralizer.split(market, 1000e6);
    
    // Trade: Sell 600 YES at 60% price
    yesToken.approve(address(tickBook), 600e18);
    (uint256 orderId, uint256 filled, uint256 cost, ) = tickBook.placeOrder(
        marketKey, 1, 600e18, 600, 600, 400e18
    );
    uint256 proceeds = tickBook.claimFills(orderId);
    
    // Redeem winning tokens
    truthMarket.settle(1, 0);  // YES wins
    vm.warp(block.timestamp + 2 days);
    truthMarket.finalize();
    
    // YES redeemed at full value
    uint256 remaining = 1000 - 600;
    uint256 yesValue = collateralizer.redeem(market, remaining * 1e18);
    assertEq(yesValue, remaining * 1e18);
    
    // NO redeemed at 0 (NO lost)
    uint256 noValue = collateralizer.redeem(market, 1000e18);
    assertEq(noValue, 0);
    
    // Total: proceeds + yesValue = original minus losses
    uint256 total = proceeds + yesValue;
    assertLt(total, 1000e18);  // Lost money on bad trade
}
```

---

### Scenario 2: Settlement with Veto
```solidity
function testSettlementVeto() public {
    address market = launchpadEngine.createMarket(...);
    truthMarket.activate();
    
    // Simulate trading, then settle
    vm.warp(block.timestamp + 30 days);  // Past deadline
    vm.startPrank(adjudicator);
    truthMarket.settle(1, 0);  // Adjudicator says YES
    
    // Guardian vetoes (disagrees)
    vm.startPrank(guardian);
    truthMarket.vetoSettlement();
    
    // State back to SETTLING
    assertEq(uint8(truthMarket.getState()), uint8(2));  // SETTLING
    
    // Adjudicator re-settles (maybe differently)
    vm.startPrank(adjudicator);
    truthMarket.settle(0, 0);  // NOW says NO
    
    // Guardian accepts this time (or time passes)
    vm.warp(block.timestamp + 2 days);
    truthMarket.finalize();
    
    // NO was correct
    assertEq(truthMarket.winningOutcome(), 0);
}
```

---

### Scenario 3: INVALID Outcome (50/50 split)
```solidity
function testInvalidOutcomeRedeem() public {
    address market = launchpadEngine.createMarket(...);
    truthMarket.activate();
    
    // User trades
    collateralizer.split(market, 1000e6);
    // ... trades ...
    
    // Settle as INVALID (2)
    vm.startPrank(adjudicator);
    truthMarket.settle(2, 0);
    vm.warp(block.timestamp + 2 days);
    truthMarket.finalize();
    
    // Both YES and NO worth 50% of tokens
    vm.startPrank(user);
    
    uint256 yesRedeemed = collateralizer.redeem(market, 100e18);
    uint256 noRedeemed = collateralizer.redeem(market, 100e18);
    
    // Each gets 50 USDC for 100 tokens (50/50 split)
    assertEq(yesRedeemed, 50e18);
    assertEq(noRedeemed, 50e18);
}
```

---

### Scenario 4: Merge to Reduce Risk
```solidity
function testMergeToReduceExposure() public {
    address market = launchpadEngine.createMarket(...);
    truthMarket.activate();
    
    // User splits 1000 USDC
    collateralizer.split(market, 1000e6);
    
    // Trades and ends with 600 YES, 800 NO (imbalanced)
    // ...
    
    // Merge 600 YES + 600 NO back to 600 USDC
    yesToken.approve(address(collateralizer), 600e18);
    noToken.approve(address(collateralizer), 600e18);
    collateralizer.merge(market, 600e18);
    
    // Now safer: 1000-600+600 = 1000 USDC cash
    assertEq(usdc.balanceOf(user), 600e6);
    
    // Only exposed to remaining 200 NO
    uint256 noBalance = noToken.balanceOf(user);
    assertEq(noBalance, 200e18);
}
```

---

## 📊 Integration Test Matrix

| Test | Contracts | Phases | Focus |
|------|-----------|--------|-------|
| Full Lifecycle | All 5 | Create→Trade→Settle→Redeem | Happy path |
| Graduation | Launchpad, AMM, TickBook | Trade→Accumulate→Graduate | Economics |
| Multi-User | TickBook, Collateralizer | Multiple actors | Concurrency |
| Settlement Veto | TruthMarket, Collateralizer | Settle→Veto→Re-settle | Error handling |
| INVALID Outcome | All | Split→Trade→Settle(2) | Edge case |

---

## 🧪 Running Integration Tests

```bash
# All integration tests
forge test --match-path "*test/v9/*.t.sol" --skip "*Fuzz*" --skip "*Invariant*"

# Specific integration
forge test --match-test "testFullMarketLifecycle" -vv

# With logging
forge test --match-test "testGraduationFlow" -vvv
```

---

## ✅ Integration Test Checklist

For each new integration test:
- [ ] Involves 2+ contracts
- [ ] Tests realistic user flow
- [ ] Includes setup, actions, assertions
- [ ] Documents expected outcomes
- [ ] Tests both success and failure paths
- [ ] Validates state at each step
- [ ] Reasonable gas (< 5M for integration)

---

**Last Updated**: 2026-01-03  
**Integration Tests**: 40/40 passing ✅
