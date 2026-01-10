# Atomic Market Creation - Draft

**Status:** Draft  
**Date:** 2026-01-10

## Problem

Current flow required 4 transactions:
1. Deploy TruthMarket
2. Activate market
3. Approve USDC
4. Fund market (LaunchpadEngine.createMarket)

Issues:
- **Anti-spam:** Anyone could deploy markets for free (just gas)
- **Front-running:** Deploy and fund were separate txs
- **Complexity:** 4 steps confused users
- **Scheduling:** No start time support for planned launches

## Proposed Solution

Reduce to 2 transactions:
1. Approve USDC
2. LaunchpadEngine.createMarket() - deploys + funds atomically

Additional changes:
- Enforce a $10 minimum deposit
- Add `startTime` to support scheduled launches
- Remove the CREATED state and `activate()`

## Contract Changes

### TruthMarket.sol

```diff
 constructor(
     string memory _question,
+    uint64 _startTime,
     uint64 _deadline,
     address _adjudicator,
     address _guardian,
     address _creator      // NEW: explicit creator
 ) {
     require(_deadline > block.timestamp, "TruthMarket: deadline in past");
     require(_adjudicator != address(0), "TruthMarket: zero adjudicator");
     require(_guardian != address(0), "TruthMarket: zero guardian");
     require(_creator != address(0), "TruthMarket: zero creator");
 
     uint64 normalizedStartTime = _startTime == 0 ? uint64(block.timestamp) : _startTime;
     require(normalizedStartTime >= block.timestamp, "TruthMarket: start in past");
     require(normalizedStartTime < _deadline, "TruthMarket: start after deadline");

     question = _question;
     startTime = normalizedStartTime;
     deadline = _deadline;
     creator = _creator;
     adjudicator = _adjudicator;
     guardian = _guardian;
     state = MarketState.LIVE;  // Starts LIVE
 }


+// REMOVED: activate() no longer needed - market starts LIVE

 enum MarketState {
     LIVE,       // Trading active
     SETTLING,   // Deadline passed
     SETTLED,    // Outcome determined
     FINALIZED   // Settlement complete
 }
```

Note: `TruthMarket` now emits `MarketCreated(market, question, startTime, deadline)`.

### LaunchpadEngine.sol

```diff
+import {TruthMarket} from "./TruthMarket.sol";

 function createMarket(
-    address market,
+    string calldata question,
+    uint64 startTime,
+    uint64 deadline,
+    address adjudicator,
+    address guardian,
     uint256 initialLiquidity,
-    string calldata name,
     string calldata symbol
-) external override nonReentrant returns (uint256 lpTokens) {
-    require(ITruthMarket(market).creator() == msg.sender, "not creator");
-    require(markets[market].creator == address(0), "already exists");
+) external nonReentrant returns (address market, uint256 lpTokens) {
     require(initialLiquidity > 0, "zero liquidity");
+    uint64 normalizedStartTime = startTime == 0 ? uint64(block.timestamp) : startTime;
+    require(normalizedStartTime >= block.timestamp, "LaunchpadEngine: start in past");
+    require(normalizedStartTime < deadline, "LaunchpadEngine: start after deadline");

     // Calculate required deposit
     uint256 depositWad = (initialLiquidity * LN2_WAD) / WAD;
+    require(depositWad >= 10e18, "LaunchpadEngine: deposit too small");
     uint256 deposit = _wadToUsdcCeil(depositWad);

-    // Transfer deposit from creator
+    // 1. Take deposit FIRST (anti-spam)
     usdc.safeTransferFrom(msg.sender, address(this), deposit);

-    // Initialize AMM with liquidity
-    try ammEngine.initializeMarket(market, initialLiquidity) {
-    } catch {
-    }
+    // 2. Deploy TruthMarket atomically (anti-frontrun)
+    market = address(new TruthMarket(
+        question,
+        normalizedStartTime,
+        deadline,
+        adjudicator,
+        guardian,
+        msg.sender    // User is creator
+    ));
+
+    // 3. Initialize AMM
+    ammEngine.initializeMarket(market, initialLiquidity);

     // Mint LP tokens
     lpTokens = depositWad;

     // Store state
     markets[market] = MarketState({
         creator: msg.sender,
         bBase: initialLiquidity,
         bCurrent: initialLiquidity,
         creatorDeposit: deposit,
         feesAccrued: 0,
         totalLPSupply: lpTokens,
         lpYieldPool: 0,
         isGraduated: false,
         createdAt: uint64(block.timestamp),
         graduatedAt: 0,
-        name: name,
+        name: _truncate(question, 50),
         symbol: symbol
     });

     lpBalances[market][msg.sender] = lpTokens;
     allMarkets.push(market);

+    emit MarketCreated(market, msg.sender, initialLiquidity, deposit, lpTokens);
 }
```

Note: `TruthMarket` emits `MarketCreated(market, question, startTime, deadline)` for address discovery.

## Frontend Changes

```typescript
// Before (4 steps)
const deployHash = await deployContract(config, { ... });
await writeContract({ functionName: 'activate' });
await writeContract({ functionName: 'approve' });
await writeContract({ functionName: 'createMarket', args: [marketAddress, ...] });

// After (2 steps)
await writeContract({ functionName: 'approve' });
const hash = await writeContract({
    functionName: 'createMarket',
    args: [question, startTime, deadline, adjudicator, guardian, liquidity, symbol]
});
const receipt = await waitForTransactionReceipt({ hash });
const market = decodeMarketCreated(receipt.logs);

```

## Benefits

| Aspect | Before | After |
|--------|--------|-------|
| Transactions | 4 | 2 |
| Anti-spam | None (free deploy) | Must pay deposit |
| Front-running | Possible | Impossible (atomic) |
| Scheduling | Manual activation | Start time supported |
| UX | Complex stepper | Simple approve+create |

## Migration

1. Deploy new TruthMarket bytecode (with `startTime` + `_creator` params)
2. Update LaunchpadEngine (new `createMarket` signature + min deposit)
3. Update frontend (remove deploy/activate steps, decode `MarketCreated`)
4. Update ABIs

## Open Questions

1. Should the UI expose optional `startTime` scheduling beyond "start now"?
2. Do we want a higher minimum deposit on mainnet beyond $10?
