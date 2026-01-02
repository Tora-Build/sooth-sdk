# Protocol User Stories & Contract Interactions

This document maps the user journeys of all key actors in the Sooth Protocol to the underlying smart contract interactions.

## 1. The Trader: Alice

**Goal**: Profit from predicting the outcome of a market (e.g., "Will BTC > $100k?").

### Phase 1: Discovery & Pricing

Alice browses the dApp and selects a market.

1.  **View Market**: The frontend fetches the market state.
    - _Call_: `SoothMarket.isLive()` checks if trading is active.
    - _Call_: `SoothMarket.ammState()` retrieves current share quantities (`qYes`, `qNo`).
    - _Call_: `SoothRiskManager.getBForMarket(marketId)` retrieves the liquidity parameter `b`.
2.  **Check Price**: Alice wants to know the cost of 10 YES shares.
    - _Calculation_: The frontend calls the stateless AMM contract.
    - _Call_: `SoothBalancedAMM.price(ammState, 0 (YES), b)` returns the marginal price.

### Phase 2: Execution (Entry)

Alice decides to buy 10 YES shares.

1.  **Approve USDC**: Alice grants permission to the Vault to spend her USDC.
    - _Transaction_: `MockERC20.approve(SoothVaultAddress, costInWei)`.
2.  **Place Trade**: Alice executes the trade on the market contract with slippage protection.
    - _Transaction_: `SoothMarket.trade(0 (YES), 10e18, maxCost)`.
    - _Contract Flow_:
      - `SoothMarket` calculates the cost and fees.
      - Checks if `cost <= maxCost`. Reverts if slippage exceeded.
      - `SoothMarket` calls `SoothVault.deposit()` to pull USDC from Alice.
      - `SoothMarket` updates `ammState`.
      - `SoothMarket` mints 10 YES shares to Alice (internal accounting).
    - _Event_: `Trade(trader=Alice, outcome=0, delta=10e18, cost=...)`.

### Phase 3: Execution (Exit/Trading)

The price of YES shares rises. Alice decides to take partial profit by selling 5 YES shares.

1.  **Place Trade**: Alice sells 5 shares.
    - _Transaction_: `SoothMarket.trade(0 (YES), -5e18, minProceeds)`.
    - _Contract Flow_:
      - `SoothMarket` calculates the payout.
      - Checks if `payout >= minProceeds`. Reverts if slippage exceeded.
      - `SoothMarket` burns 5 YES shares from Alice.
      - `SoothMarket` calls `SoothVault.withdraw()` to send USDC to Alice.
    - _Event_: `Trade(trader=Alice, outcome=0, delta=-5e18, cost=-...)`.

### Phase 4: Settlement (Claiming)

The market closes, and the outcome is YES. (See _The Adjudicator_ and _The Prover_ below).

1.  **Check Status**: Alice sees the market is settled.
    - _Call_: `SoothSettlement.results(marketId)` returns `settled=true` and `winningOutcome=1 (YES)`.
2.  **Claim PnL**: Alice claims her winnings.
    - _Prerequisite_: A Prover has submitted the settlement root for this batch.
    - _Transaction_: `SoothSettlement.claimSettlement(marketId, batchId, pnlDelta, merkleProof)`.
    - _Contract Flow_:
      - Verifies the Merkle proof against the stored root.
      - Checks `claimed[batchId][Alice]` is false.
      - Sends USDC from `SoothVault` to Alice.
      - Sets `claimed` to true.

---

## 2. The Liquidity Provider: Bob

**Goal**: Earn passive yield on USDC by underwriting market activity.

### Phase 1: Deposit

Bob has 1000 USDC to invest.

1.  **Approve USDC**: Bob approves the Vault.
    - _Transaction_: `MockERC20.approve(SoothVaultAddress, 1000e18)`.
2.  **Deposit**: Bob deposits into the shared Vault.
    - _Transaction_: `SoothVault.depositFor(Bob, 1000e18)`.
    - _Contract Flow_:
      - Transfers 1000 USDC from Bob to `SoothVault`.
      - Mints LP shares to Bob based on the current exchange rate (Assets / Shares).
    - _Event_: `Deposit(lp=Bob, assets=1000e18)`.

### Phase 2: Passive Yield

Bob does nothing while markets trade.

- _Mechanism_: When Traders lose money (net negative PnL for traders), the Vault's `totalAssets` increases. Since Bob owns a share of the Vault, his LP token value increases.
- _Risk_: If Traders win big (net positive PnL for traders), the Vault's `totalAssets` decreases, and Bob loses value.

### Phase 3: Withdraw

Bob wants to exit.

1.  **Withdraw**: Bob redeems his LP shares.
    - _Transaction_: `SoothVault.withdrawFor(Bob, sharesAmount, Bob)`.
    - _Contract Flow_:
      - Checks `getLiquidBufferBalance()` (Total Assets - Locked Exposure).
      - If sufficient liquid funds exist, burns Bob's LP shares.
      - Transfers proportional USDC to Bob.

---

## 3. The Adjudicator: Carol (or Chainlink/UMA)

**Goal**: Truthfully resolve the market outcome.

### Phase 1: Resolution

The event occurs (e.g., "BTC > $100k" becomes TRUE).

1.  **Submit Result**: Carol (the designated adjudicator key) submits the result.
    - _Transaction_: `SoothSettlement.storeResult(marketId, adjudicatorId, 1 (YES), truthTime)`.
    - _Contract Flow_:
      - Validates `msg.sender` is the authorized adjudicator (or Owner).
      - Stores the result.
      - Emits `ResultStored`.

---

## 4. The Settlement Prover: Off-Chain Bot

**Goal**: Calculate and secure user payouts after adjudication.

### Phase 1: Calculation

1.  **Listen**: The Bot detects the `ResultStored` event.
2.  **Compute**: The Bot reads all `Trade` events for the market up to `truthTime`.
3.  **Aggregate**: It calculates the final PnL for every trader based on the winning outcome.
4.  **Tree Generation**: It constructs a Merkle Tree where each leaf is `keccak256(marketId, userAddress, pnlDelta)`.

### Phase 2: Submission

1.  **Upload Root**: The Bot publishes the Merkle Root.
    - _Transaction_: `SoothSettlement.storeSettlementRoot(marketId, batchId, root, metadata)`.
    - _Contract Flow_:
      - Verifies `msg.sender` is an authorized Prover.
      - Stores the root for the given `batchId`.
      - Emits `SettlementRootStored`.
    - _Result_: Traders like Alice can now call `claimSettlement`.

---

## 5. The Guardian: Dave

**Goal**: Protect the protocol from bugs or bad outcomes.

### Phase 1: Emergency Pause

Dave notices a critical bug in a market.

1.  **Pause**: Dave pauses the market.
    - _Transaction_: `SoothMarket.emergencyPause()` (or similar Owner function).
    - _Effect_: `isLive` becomes false. Trading stops.

### Phase 2: Forced Settlement

The Adjudicator is unresponsive or malicious.

1.  **Override**: Dave forces a settlement result.
    - _Transaction_: `SoothSettlement.storeResult(...)` (Owner has override permissions).
