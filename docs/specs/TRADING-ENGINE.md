# Trading Engine Specification

> Sooth Protocol — Trading Engine Layer
> Version: 0.1.0
> Date: 2026-03-07
> License: MIT (Layer 1 Core)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Matching Engine Contract](#2-matching-engine-contract)
3. [AMMEngine — LMSR Trading](#3-ammengine--lmsr-trading)
4. [SoothBook — Onchain Orderbook (DLOB)](#4-soothbook--onchain-orderbook-dlob)
5. [CLOB — Offchain Orderbook](#5-clob--offchain-orderbook)
6. [Orderbook Choice — Per-Instance Configuration](#6-orderbook-choice--per-instance-configuration)
7. [Fee Integration](#7-fee-integration)
8. [Trade Settlement vs Position Settlement](#8-trade-settlement-vs-position-settlement)
9. [Trial Cost Tracking](#9-trial-cost-tracking)
10. [Two-Venue Interaction](#10-two-venue-interaction)
11. [Events](#11-events)
12. [Gas Considerations](#12-gas-considerations)

---

## 1. Overview

### What is This Spec?

This specification covers the **trading infrastructure** of the Sooth Protocol — how orders are placed, matched, and executed. It is the complement to Layer 1 (which defines the contract interfaces and lifecycle) and Layer 3 (which defines market creation).

### Two Phases of Trading

Every market has two trading phases:

| Phase | Venue | When |
|-------|-------|------|
| **Bonding** (pre-graduation) | AMMEngine only | Creation → graduation |
| **Full Market** (post-graduation) | AMMEngine + Orderbook | Graduation → market finalization |

The AMMEngine (LMSR automated market maker) is always available. The orderbook activates at graduation.

### Architecture

```
                    ┌─────────────────────────────┐
                    │   Matching Engine Contract   │
                    │   (universal trade execution) │
                    │                              │
                    │   ├── fillOrder()             │
                    │   ├── Position ledger         │
                    │   ├── Fee calculation         │
                    │   └── Position settlement     │
                    └──────────┬───────────────────┘
                               │
                 ┌─────────────┼─────────────┐
                 │                           │
          ┌──────┴──────┐            ┌───────┴───────┐
          │  SoothBook  │            │ CLOB Operator  │
          │   (DLOB)    │            │  (offchain)    │
          │             │            │               │
          │ Onchain     │            │ Offchain      │
          │ order mgmt  │            │ order mgmt    │
          │ + matching  │            │ + matching    │
          │ + mint/merge│            │               │
          └─────────────┘            └───────────────┘
                 │                           │
            Calls fillOrder()          Calls fillOrder()
            on matching engine         on matching engine
```

The **matching engine contract** is the shared onchain layer for executing matched trades. Both SoothBook (onchain DLOB) and the CLOB operator (offchain orderbook) interact with **the same matching engine contract** to settle trades.

### Two Orderbook Options

At instance deployment, the operator chooses one orderbook type for all markets:

| Option | Type | Description |
|--------|------|-------------|
| **SoothBook** | DLOB (Decentralized Limit Order Book) | Fully onchain. Orders placed, matched, and executed in smart contracts. |
| **CLOB** | Central Limit Order Book | Orders managed and matched offchain by an operator. Trade execution onchain via signed orders. |

Both call the same matching engine contract for trade execution. The difference is **where matching happens** (onchain vs offchain).

---

## 2. Matching Engine Contract

### Purpose

The matching engine contract is the universal onchain layer for **settling trades** — transferring balances (YES/NO shares and base token) between matched parties. It does NOT store orders or run matching algorithms. Those are the responsibility of SoothBook (onchain) or the CLOB operator (offchain).

### What "Settling a Trade" Means

Trade settlement = the atomic transfer of assets between two matched parties:

```
Party A (buyer)  ──base token──►  Matching Engine  ──base token──►  Party B (seller)
Party B (seller) ──YES shares──►  Matching Engine  ──YES shares──►  Party A (buyer)
```

This is NOT market finalization. Market finalization (adjudicator resolves outcome, winning side gets paid) is a separate concept — see [Section 8](#8-trade-settlement-vs-position-settlement).

### Interface

```solidity
interface IMatchingEngine {
    /// @notice Register a graduated market
    function registerMarket(address market, address baseToken, uint256 initialPrice) external;

    /// @notice Execute a matched trade (called by authorized fillers)
    /// @param marketKey  Market identifier
    /// @param maker      Address providing one side
    /// @param taker      Address providing the other side
    /// @param outcome    0 = NO, 1 = YES
    /// @param amount     Shares being transferred (WAD)
    /// @param price      Execution price (WAD, e.g., 0.6e18 = 60%)
    /// @param makerSide  0 = maker is buyer, 1 = maker is seller
    function fillOrder(
        bytes32 marketKey,
        address maker,
        address taker,
        uint8 outcome,
        uint128 amount,
        uint256 price,
        uint8 makerSide
    ) external;

    /// @notice Execute a batch of matched trades
    function fillOrders(
        bytes32 marketKey,
        address[] calldata makers,
        address[] calldata takers,
        uint8[] calldata outcomes,
        uint128[] calldata amounts,
        uint256[] calldata prices,
        uint8[] calldata makerSides
    ) external;

    /// @notice Get a user's position in a market
    function getPosition(bytes32 marketKey, address user)
        external view returns (uint256 yesShares, uint256 noShares);

    /// @notice Settle a user's position after market finalization
    function settlePosition(bytes32 marketKey, address user) external;

    /// @notice Check if a market is registered
    function isMarketRegistered(bytes32 marketKey) external view returns (bool);
}
```

### Authorization

The matching engine contract has **authorized fillers** — contracts or addresses permitted to call `fillOrder()`:

| Filler | Authorization | How Trades Are Verified |
|--------|--------------|------------------------|
| SoothBook | Authorized contract (set by operator) | SoothBook already verified the match onchain (tick crossing, FIFO priority, escrow) |
| CLOB Operator | Authorized address (set by operator) | Matching engine verifies EIP-712 signatures on signed orders |

For SoothBook, no signature verification is needed — SoothBook is a trusted contract that already enforced all matching rules. It simply tells the matching engine "transfer X shares from A to B at price P".

For CLOB, the matching engine **must verify EIP-712 signatures** because the orders were signed offchain and the operator is a potentially untrusted party. The signature proves the user authorized this specific trade.

### fillOrder() Execution

```
1. AUTHORIZATION
   ├── Check msg.sender is authorized filler
   └── Check market is registered

2. SIGNATURE VERIFICATION (CLOB path only)
   ├── Verify EIP-712 signature from maker
   ├── Check order.nonce == nonces[maker]
   ├── Check !expired and !cancelled
   └── Check fill amount <= remaining capacity

3. FEE CALCULATION
   ├── Calculate fee per FeeRouter or internal fee schedule
   └── Deduct fee from the appropriate party

4. BALANCE TRANSFER
   ├── Buyer: debit base token, credit outcome shares
   ├── Seller: debit outcome shares, credit base token
   └── Update position ledger for both parties

5. EMIT OrderFilled event
```

### Position Ledger

The matching engine tracks positions for all users across all registered markets:

```solidity
mapping(bytes32 => mapping(address => Position)) positions;

struct Position {
    uint256 yesShares;
    uint256 noShares;
}
```

Shares are credited on buy fills and debited on sell fills. The position ledger is the source of truth for orderbook positions (separate from AMM positions in AMMEngine).

### Position Settlement (After Market Finalization)

When the adjudicator finalizes the market, users call `settlePosition()` to redeem winning shares:

```
1. Check TruthMarket(market).isSettled()
2. Read winningOutcome
3. Calculate payout:
   - YES wins (1): payout = yesShares
   - NO wins (0):  payout = noShares
   - INVALID (2):  payout = (yesShares + noShares) / 2
4. Clear position
5. Transfer base token to user
```

This is pull-based — users (or keepers) call it after finalization.

### Collateral Management

The matching engine contract holds base token collateral to back all positions:

```
Invariant: baseTokenBalance >= sum of all potential payouts
```

When a buyer deposits base token during a fill, the contract holds it. When a seller is paid out, the contract sends it. The collateral pool ensures all positions are fully backed.

---

## 3. AMMEngine — LMSR Trading

### Overview

The AMMEngine is the Logarithmic Market Scoring Rule (LMSR) automated market maker. It handles all pre-graduation trading and remains available post-graduation as a secondary venue. For the LMSR pricing formulas (`P(YES)`, cost function `C(q)`), see **Layer 1, AMMEngine section**.

### Position Model (Dual-Balance)

```solidity
struct Position {
    uint256 yesShares;   // User's YES position (WAD, always >= 0)
    uint256 noShares;    // User's NO position (WAD, always >= 0)
}
```

A user can hold both YES and NO shares simultaneously. There is no forced netting. Positions are internal ledger entries (not ERC20 tokens). To exit, a trader sells back to the AMM.

**Important:** AMM positions are separate from orderbook positions. They are tracked in different contracts (AMMEngine vs matching engine contract).

### tradePositions() Execution Flow

```solidity
function tradePositions(
    address market,
    uint8 outcome,          // 0 = NO, 1 = YES
    int256 deltaShares,     // positive = buy, negative = sell
    uint256 maxCostOrMinProceeds
) external nonReentrant returns (uint256);
```

**Step-by-step execution:**

```
1. GUARDS
   ├── Check launchpadEngine.isPaused() == false
   ├── Check deltaShares != 0
   ├── Check outcome <= 1
   ├── Check TruthMarket(market).isLive()
   └── Check market is initialized

2. DIRECTION
   ├── isBuy = deltaShares > 0
   └── absDelta = abs(deltaShares)

3. COMPUTE NEW LMSR STATE
   ├── Buy YES:  newQYes = qYes + absDelta, newQNo = qNo
   ├── Sell YES: require(position.yesShares >= absDelta), newQYes = qYes - absDelta
   ├── Buy NO:   newQNo = qNo + absDelta, newQYes = qYes
   └── Sell NO:  require(position.noShares >= absDelta), newQNo = qNo - absDelta

4. CALCULATE LMSR BASE COST
   ├── Buy:  baseCost = C(qAfter) - C(qBefore)    (positive cost)
   └── Sell: baseCost = C(qBefore) - C(qAfter)    (positive proceeds)

5. FEE CALCULATION (via FeeRouter)
   ├── feeRouter.calculateAndDistributeFee(market, user, baseCost, isBuy)
   └── Returns: (fee, netAmount)

6A. BUY PATH
    ├── actualCost = netAmount (baseCost + fee)
    ├── Slippage check: actualCost <= maxCostOrMinProceeds
    ├── Payment (see Balance Management below)
    └── position.yesShares += absDelta  (or noShares)

6B. SELL PATH
    ├── netProceeds = netAmount (baseCost - fee)
    ├── Slippage check: netProceeds >= maxCostOrMinProceeds (if > 0)
    ├── Credit to _availableBalance and _lockedBalance
    ├── Push LockEntry with 24h expiry
    └── position.yesShares -= absDelta  (or noShares)

7. UPDATE MARKET STATE
   ├── mState.qYes = newQYes
   └── mState.qNo = newQNo

8. EMIT PositionTraded event
```

### Quote Function

```solidity
function getPositionQuote(
    address market,
    uint8 outcome,
    int256 deltaShares
) external view returns (uint256 cost, uint256 newPrice);
```

Simulates a trade without executing. Returns the **base cost only** (no fee). The frontend must query FeeRouter separately for fee estimation. `newPrice` is the YES probability after the hypothetical trade.

For sells, the function clamps to zero instead of reverting (soft check), allowing the UI to show "insufficient shares" without a revert.

### Lock-on-Sell

When a trader sells shares, the proceeds are **locked for 24 hours**. During this time:

- Proceeds **cannot** be withdrawn to the wallet
- Proceeds **can** be spent on new buys (immediately)

```
SELL → proceeds credited to _availableBalance AND _lockedBalance
     → LockEntry { amount, expiry: now + 24h, market } pushed to queue

CLAIM → after 24h, claimUnlocked(maxClaims) processes expired entries
      → swap-and-pop removal from queue
      → deducts from both _availableBalance and _lockedBalance
      → transfers base tokens to wallet
```

**Lock state:**

```solidity
mapping(address => uint256) _availableBalance;  // Total buying power (locked + unlocked)
mapping(address => uint256) _lockedBalance;      // Portion that can't be withdrawn yet

struct LockEntry {
    uint256 amount;
    uint64 expiry;
    address market;
}
mapping(address => LockEntry[]) _lockQueue;
```

**Invariant:** `_lockedBalance[user] <= _availableBalance[user]` at all times.

### Balance Management (Spending Priority)

When buying, the AMMEngine tries internal balance first, then pulls from wallet:

```
IF _availableBalance >= actualCost:
  → Spend entirely from internal balance
  → Reduce _lockedBalance proportionally:
      lockedReduction = actualCost * _lockedBalance / _availableBalance
  → No wallet transfer

ELSE:
  → fromBalance = _availableBalance (drain all)
  → fromWallet = actualCost - fromBalance
  → Set both _availableBalance and _lockedBalance to 0
  → safeTransferFrom(user, this, wadToBaseTokenCeil(fromWallet))
```

The proportional lock reduction prevents the "locked > available" invariant violation. Example: 100 available (60 locked, 40 unlocked), spend 50 → locked reduces by `50 * 60/100 = 30` → 50 available, 30 locked.

### AMMEngine View Functions

| Function | Returns | Use |
|----------|---------|-----|
| `getPosition(market, user)` | `(yesShares, noShares)` | Current AMM position |
| `getBalances(user)` | `(available, locked)` | Internal balance state |
| `getLockQueue(user)` | `LockEntry[]` | All pending locks |
| `getClaimableAmount(user)` | `(claimable, nextUnlock, nextAmount)` | What can be withdrawn now |
| `getMarketState(market)` | `(qYes, qNo, currentPrice)` | LMSR state |
| `getLiquidity(market)` | `uint256 b` | Current liquidity parameter |

### AMMEngine Access Control

| Function | Who Can Call | Mechanism |
|----------|-------------|-----------|
| `tradePositions` | Anyone | Requires `!isPaused()` and `isLive()` |
| `claimUnlocked` | Anyone (own locks) | Uses `msg.sender` for lookup |
| `settlePosition` | Anyone (own position) | Uses `msg.sender` for lookup |
| `initializeMarket` | Authorized initializers or owner | `authorizedInitializers[msg.sender]` |
| `increaseLiquidity` | Authorized liquidity callers | `authorizedLiquidityCallers[msg.sender]` |
| `spendBalanceFor` | Authorized callers | For cross-venue buying power |

---

## 4. SoothBook — Onchain Orderbook (DLOB)

### Overview

SoothBook is a fully onchain decentralized limit order book. It stores orders, runs the matching algorithm, and handles mint/merge operations. When a match is found, SoothBook calls the **matching engine contract** to execute the trade (transfer balances between parties).

### Architecture

```
SoothBook (single contract per instance)
├── Market registry (marketKey → Market)
├── Order books (marketKey → side → tick → Order[] FIFO queue)
├── Tick bitmaps (marketKey → side → Bitmap) for O(1) best-tick discovery
├── mint/merge (complete set creation/destruction)
└── Calls matching engine contract for trade execution
```

### The 4 Atomic Actions

SoothBook has exactly four user-facing trading actions:

#### `buyYes(marketKey, tick, amount, escrow, matchLimit)`

Place a limit order to buy YES shares at `tick / 1000` price.

```
Parameters:
  marketKey    bytes32   Market identifier
  tick         uint16    Price in thousandths (1-999). tick=600 → pay 60% per share
  amount       uint128   Shares to buy (WAD)
  escrow       bool      If true: debit NO shares instead of base token (exit position)
  matchLimit   uint32    Max opposing orders to sweep (0 = unlimited)
```

#### `buyNo(marketKey, tick, amount, escrow, matchLimit)`

Same as `buyYes` but for the NO side.

#### `mint(marketKey, amount)`

Deposit base token, receive equal YES + NO shares (complete set creation).

```
1 base token → 1 YES share + 1 NO share
```

This is how new outcome tokens enter the system. Used when there's no liquidity on the opposing side to buy from.

#### `merge(marketKey, amount)`

Burn equal YES + NO shares, receive base token back (complete set destruction).

```
1 YES share + 1 NO share → 1 base token
```

The inverse of `mint`. Used for position exit or arbitrage.

**Mint/merge is SoothBook-level, not matching engine level.** The matching engine contract only handles trade execution (balance transfers between matched parties). Complete set creation/destruction is order management logic that SoothBook handles before/after calling the matching engine.

### Tick System

Ticks are integers from 1 to 999, representing price as a fraction of 1000:

```
tick = 600 → price = 0.600 → 60% implied probability
tick = 1   → price = 0.001 → 0.1% implied probability
tick = 999 → price = 0.999 → 99.9% implied probability
```

There is no tick 0 (free) or tick 1000 (guaranteed outcome). The tick range `[1, 999]` ensures every order has economic value and every order has risk.

### Crossing Rule

A YES order at tick Y crosses a NO order at tick N when:

```
Y + N ≥ 1000
```

This is because: YES buyer pays `Y/1000` for YES, NO buyer pays `N/1000` for NO. Combined willingness-to-pay is `(Y + N) / 1000`. If ≥ 1.0, the two sides fully cover the payout of one base token.

**Surplus (price improvement):**

```
surplus per share = (Y + N - 1000) / 1000
```

The surplus goes entirely to the **taker** (the order that triggers the cross). This incentivizes aggressive order placement.

**Example:**

```
YES order at tick 600 (willing to pay 60%)
NO order at tick 500 (willing to pay 50% for NO = willing to accept 50% for YES)

600 + 500 = 1100 ≥ 1000 → CROSSES
surplus = (1100 - 1000) / 1000 = 10% per share → paid to taker in base token
```

### Matching Algorithm (`_match`)

SoothBook's internal matching traverses the opposing book from best to worst price:

```
1. Calculate minimum opposing tick: minOppTick = 1000 - takerTick
2. Start from the HIGHEST opposing tick (best price for taker)
3. Use tick bitmap for O(1) next-tick discovery (findNextDown)
4. For each tick with orders:
   a. Process orders FIFO (head pointer, not array shifting)
   b. Fill amount = min(remaining, maker.amount)
   c. Call matching engine contract to execute the fill
   d. Calculate and accumulate surplus → taker
   e. If maker order fully consumed: advance head, clear pointer
   f. If tick exhausted: clear bitmap bit, compact array
   g. Decrement matchLimit counter
5. After all matches: transfer accumulated fees
6. Return remaining (becomes resting order if > dust threshold)
```

### Escrow Flag (Position Exit)

The `escrow` parameter on `buyYes` / `buyNo` enables position exit without a separate "sell" function:

| escrow | Payment | On Fill | Effect |
|--------|---------|---------|--------|
| `false` | Base token from wallet | Receive outcome shares | Normal buy |
| `true` | Debit opposite shares from position | Receive base token payout | Effectively "sell" your position |

**Example:** Trader holds 100 NO shares, wants to exit. Calls `buyYes(marketKey, 600, 100, true, 0)`. This debits 100 NO shares and, when matched with a YES seller, pays base token to the trader. The effect is identical to "selling NO at 40%".

### Order Lifecycle

```
Place (buyYes/buyNo)
  ├── Match against opposing book (immediate)
  │   ├── Full fill → shares/payout credited via matching engine, no resting order
  │   └── Partial fill → remainder rests
  ├── Resting order (if remainder > dust threshold)
  │   ├── Assigned unique orderId
  │   ├── Stored in FIFO queue at the tick
  │   └── Bitmap bit set for the tick
  └── Dust order (remainder rounds to 0 base token units)
      └── Skipped, DustOrderSkipped event emitted

Cancel (cancel / cancelById)
  ├── Verify msg.sender == order.maker
  ├── Zero order amount, delete pointer
  ├── Refund: escrow=false → base token, escrow=true → re-credit opposite shares
  └── Compact array if tick exhausted
```

### Tick Bitmap

SoothBook uses a two-level bitmap covering all 1000 ticks in 4 storage words. This enables O(1) discovery of the best (highest) tick with resting orders, critical for matching performance.

```
findNextDown(bitmap, startTick) → next tick with orders below startTick
```

When a tick's orders are fully consumed, the bitmap bit is cleared. When a new order rests at an empty tick, the bit is set.

### Dust Filter

Orders whose remaining base token value rounds to zero in base token decimals cannot rest on the book:

```
costWad = amount * tick / 1000
if _wadToBaseUnits(costWad) == 0:
    → emit DustOrderSkipped
    → refund escrow if applicable
    → do NOT push to order queue
```

This prevents griefing with zero-value orders that would consume storage and iteration gas.

### SoothBook View Functions

| Function | Returns | Use |
|----------|---------|-----|
| `getBalance(marketKey, user)` | `(yes, no)` | User's shares |
| `getBestTick(marketKey, side)` | `uint16` | Best price on a side |
| `getOrdersAtTick(marketKey, side, tick)` | `(totalAmount, orderCount)` | Depth at a tick |
| `getImpliedPriceByKey(marketKey)` | `(yesPrice, noPrice)` in WAD | Mid-market price |
| `getCollateralBacking(marketKey)` | `uint256` | Total base token held |
| `getMinRestingOrder(tick)` | `uint128` | Minimum order size for tick |

### SoothBook Admin Functions

| Function | Access | Purpose |
|----------|--------|---------|
| `setRegistrar(address)` | Owner only | Set who can register markets (typically LaunchpadEngine) |
| `setFee(feeBps, feeRecipient)` | Owner only | Set flat fee rate and recipient |
| `resolveMarket(marketKey, outcome)` | Owner only | Emergency resolution bypass |
| `registerMarket(market, baseToken, initialPrice)` | Registrar or owner | Register a graduated market |

---

## 5. CLOB — Offchain Orderbook

### Overview

The CLOB (Central Limit Order Book) is an alternative orderbook where order management and matching happen **offchain**. An operator runs the orderbook infrastructure, matches orders, and submits matched trades to the **same matching engine contract** that SoothBook uses.

The CLOB does NOT follow SoothBook's matching algorithm — it has its own. The CLOB does NOT need SoothBook's tick system or tick size enforcement. The point of the CLOB is a completely different approach to order matching, with only the trade execution layer (matching engine contract) shared.

### Architecture

```
                        OFFCHAIN                           ONCHAIN
                   ┌─────────────────┐              ┌─────────────────────────┐
  User signs ──────►│  CLOB Operator   │── fillOrder ──►│  Matching Engine        │
  EIP-712 order    │                  │              │  Contract               │
                   │  REST/WS API    │              │  (same contract         │
  User reads ◄─────│  Order book      │              │   SoothBook uses)       │
  book state       │  Balance tracker │              │                         │
                   └─────────────────┘              │  Signature verification │
                                                    │  Balance transfer       │
                                                    │  Fee collection         │
                                                    └─────────────────────────┘
```

**Key difference from SoothBook:** SoothBook is an authorized contract caller — it already verified the match onchain, so the matching engine trusts it. The CLOB operator is an authorized address — but the matching engine **must verify EIP-712 signatures** on the orders before executing, because the matching happened offchain.

### Signed Order Format (EIP-712)

Users sign orders offchain using EIP-712 typed data. The private key never leaves the user's device.

```solidity
struct SignedOrder {
    uint256 salt;                // Random entropy (unique per order)
    address maker;               // Address that funds the order
    address signer;              // Address that signed (may differ for smart wallets)
    address taker;               // Counterparty constraint (address(0) = anyone)
    bytes32 marketKey;           // Which market
    uint8 outcome;               // 0 = NO, 1 = YES
    uint8 side;                  // 0 = BUY, 1 = SELL
    uint256 makerAmount;         // Tokens/collateral the maker gives
    uint256 takerAmount;         // Tokens/collateral the maker expects
    uint256 expiration;          // Unix timestamp
    uint256 nonce;               // Must match maker's current nonce
    uint16 feeRateBps;           // Fee rate in basis points
    SignatureType signatureType; // EOA, EIP-1271
    bytes signature;             // ECDSA or EIP-1271 signature
}
```

**Price derivation from amounts:**

```
BUY:  price = makerAmount / takerAmount  (maker gives base token, receives shares)
SELL: price = takerAmount / makerAmount  (maker gives shares, receives base token)
```

### How CLOB Fills Work

When the CLOB operator matches two orders offchain, it calls the matching engine contract:

```
1. Operator finds a match offchain (buyerOrder + sellerOrder)
2. Operator calls matchingEngine.fillOrder(marketKey, maker, taker, outcome, amount, price, side)
   with the signed order data attached
3. Matching engine verifies:
   a. EIP-712 signature is valid for both orders
   b. Orders are not expired, cancelled, or overfilled
   c. Nonces match current nonce for each maker
   d. Prices are compatible (buyer price >= seller price)
   e. Market is registered
4. Matching engine executes the balance transfer
5. Matching engine collects fees
6. Emit OrderFilled event
```

### Order Validation (CLOB Path)

When the matching engine processes a CLOB fill, it verifies:

```
1. block.timestamp <= order.expiration         (not expired)
2. Signature is valid for the order hash       (EIP-712 / EIP-1271)
3. order.feeRateBps <= MAX_FEE_RATE_BPS        (fee within bounds)
4. Market is registered                        (graduated)
5. order.nonce == nonces[order.maker]          (nonce matches)
6. Order not already filled/cancelled          (orderStatus check)
7. Fill amount <= remaining capacity           (partial fill tracking)
```

### Nonce System (Bulk Cancellation)

```solidity
mapping(address => uint256) public nonces;

function incrementNonce() external {
    nonces[msg.sender] += 1;
}
```

Calling `incrementNonce()` invalidates **all** pending orders with the old nonce. This is a "nuclear option" for emergency cancellation. Individual orders are cancelled via `cancelOrder()`.

`cancelOrder()` is user-callable onchain (no operator needed). Users can always cancel without the operator's cooperation.

**Nonce race risk:** A user can call `incrementNonce()` onchain to front-run the operator's fill transaction, cancelling losing orders before they execute. Mitigation options:

1. Operator submits fills with higher gas priority
2. Add a timelock on `incrementNonce()` (e.g., 1 block delay)
3. Accept the risk as a cost of user sovereignty

### Offchain Infrastructure

The CLOB operator runs the following offchain services:

```
┌─────────────────────────────────────────────────────┐
│  CLOB Operator Services                              │
│                                                      │
│  1. API Server (REST + WebSocket)                    │
│     ├── POST /order      → Submit signed order       │
│     ├── DELETE /order     → Cancel order              │
│     ├── GET /orderbook    → Current book state        │
│     ├── GET /trades       → Recent fills              │
│     └── WS /stream       → Real-time updates         │
│                                                      │
│  2. Matching Engine (offchain)                        │
│     ├── Price-time priority matching                  │
│     ├── Order types: GTC, GTD, FOK, FAK             │
│     └── Own matching rules (not SoothBook algorithm)  │
│                                                      │
│  3. Balance Tracker                                   │
│     ├── Reads onchain positions from matching engine  │
│     ├── Reads onchain base token balances + approvals │
│     ├── Tracks open order exposure                   │
│     └── maxOrder = balance - openExposure            │
│                                                      │
│  4. Fill Submitter                                    │
│     ├── Batches matched orders                       │
│     ├── Submits fillOrder() txs to matching engine   │
│     └── Monitors confirmations, retries on failure   │
│                                                      │
│  5. Heartbeat Manager                                 │
│     ├── Clients ping every 10s                       │
│     └── Stale clients → cancel all open orders       │
└─────────────────────────────────────────────────────┘
```

### Authentication (Two Levels)

**Level 1 — API Key Derivation:**

- User signs a one-time EIP-712 message with their wallet
- This derives API credentials (`apiKey`, `secret`, `passphrase`)
- Private key never sent to the server

**Level 2 — Request Signing:**

- All subsequent API calls use HMAC-SHA256 with the derived credentials
- Prevents replay attacks and ensures request authenticity

### CLOB Order Types

| Type | Behavior | Rests on Book? |
|------|----------|---------------|
| **GTC** (Good-Til-Cancelled) | Rests until filled or cancelled | Yes |
| **GTD** (Good-Til-Date) | Auto-expires at specified timestamp | Yes |
| **FOK** (Fill-Or-Kill) | Must fill entirely immediately or reject | No |
| **FAK** (Fill-And-Kill) | Fills available portion, cancels remainder | No |

These are offchain concepts — the matching engine contract only sees individual fills, not order types.

### Trust Model

| What the Operator CAN Do | What the Operator CANNOT Do |
|---------------------------|----------------------------|
| Match orders (choose which to pair) | Steal funds (all trades need valid EIP-712 signatures) |
| Determine execution priority | Execute unauthorized trades (no valid signature = revert) |
| Reject orders (censorship) | Set prices (prices determined by signed maker/taker amounts) |
| Collect fees | Prevent onchain cancellation (user calls contract directly) |

**Self-custody:** Funds stay in user wallets until the matching engine executes the fill. Users approve the matching engine contract for base token spending. ERC20 approvals can be revoked at any time.

**Censorship resistance:**

1. Users can cancel orders onchain without operator cooperation
2. Users can revoke ERC20 approvals at any time
3. The matching engine contract is open-source and auditable
4. Multiple operators could compete for the same markets

---

## 6. Orderbook Choice — Per-Instance Configuration

The orderbook type is set **per instance**, not per market. All graduated markets in an instance use the same orderbook type. This is decided at deploy time.

```
Instance A (SoothBook)            Instance B (CLOB)
├── Market 1 → SoothBook          ├── Market 1 → CLOB operator
├── Market 2 → SoothBook          ├── Market 2 → CLOB operator
└── Market 3 → SoothBook          └── Market 3 → CLOB operator
         │                                 │
         └─── both call the same ──────────┘
              matching engine contract
```

### Tradeoffs

| Property | SoothBook (DLOB) | CLOB |
|----------|-----------------|------|
| **Matching** | Onchain (in the buy transaction) | Offchain (operator submits fill tx) |
| **Latency** | Block time (~2-12s depending on chain) | Sub-second (offchain matching) |
| **Gas per trade** | ~150-350k gas (order + match + fill) | ~80-120k gas (fill only, matching is free) |
| **Infrastructure** | None beyond the contracts | API server, matching engine, balance tracker |
| **Trust** | Trustless (contract enforces matching) | Operator can censor but not steal |
| **Censorship resistance** | Full (anyone can place orders) | Partial (operator can refuse to match) |
| **Complexity** | Simpler (contracts only) | More complex (contracts + offchain services) |
| **MEV risk** | Higher (onchain order visibility) | Lower (orders are offchain until fill) |
| **Mint/Merge** | User-facing (`mint()`, `merge()`) | Not applicable (positions are internal to the matching engine) |
| **Best for** | Decentralization-first, low-volume markets | High-volume, latency-sensitive markets |

### Configuration

```solidity
// In LaunchpadEngine:
IMatchingEngine public matchingEngine;  // Set at deployment

// The orderbook (SoothBook or CLOB operator) is authorized as a filler:
matchingEngine.setAuthorizedFiller(soothBookAddress, true);   // OR
matchingEngine.setAuthorizedFiller(clobOperatorAddress, true);
```

At graduation, `LaunchpadEngine.notifyGraduation()` calls `matchingEngine.registerMarket()` to activate the market.

---

## 7. Fee Integration

### Pre-Graduation Fees (AMM Only)

Handled entirely by FeeRouter. See **Layer 1, FeeRouter section** for the full flow.

```
Trader → AMMEngine.tradePositions()
         → FeeRouter.calculateAndDistributeFee()
         → 5% fee → 100% to bBase growth + LP token mint
```

### Post-Graduation Fees (Matching Engine)

After graduation, the matching engine contract calculates fees on each fill. The fee distribution follows the same post-graduation split defined in other specs:

```
Post-graduation split:
  50% → bBase growth (via FeeRouter)
  30% → LP yield pool
  10% → Adjudicator
  10% → Protocol treasury
```

The matching engine calls FeeRouter for fee calculation so the fee logic is centralized. This ensures consistent fee behavior regardless of whether the fill came from SoothBook or CLOB.

### AMM Post-Graduation Fees

The AMM continues to charge fees post-graduation through FeeRouter:

```
1% fee → same post-grad split as above
```

---

## 8. Trade Settlement vs Position Settlement

These are two different things:

### Trade Settlement (Matching Engine)

**What:** Transferring balances between two matched parties when an order is filled.

**When:** Every time a match occurs (SoothBook finds a cross, or CLOB operator submits a fill).

**Where:** Matching engine contract.

**Example:**

```
Alice buys 100 YES at 60% → pays 60 base token
Bob sells 100 YES at 60%  → receives 60 base token

Matching engine:
  Alice: yesShares += 100
  Bob:   yesShares -= 100
  Bob:   receives 60 base token
  Alice: pays 60 base token
```

### Position Settlement (After Market Finalization)

**What:** Redeeming winning shares for base token after the adjudicator finalizes the market.

**When:** After `TruthMarket.isSettled()` returns true.

**Where:** Matching engine contract for orderbook positions. AMMEngine for AMM positions.

**Example:**

```
Market settled: YES wins (outcome = 1)
Alice has 100 YES shares → calls settlePosition() → receives 100 base token
Bob has 100 NO shares   → calls settlePosition() → receives 0
```

### Resting Orders at Market Finalization

When a market is finalized, resting orders on the orderbook should be cancelled:

- **SoothBook:** Users cancel their resting orders manually to recover escrowed collateral. Only the maker can cancel their own orders.
- **CLOB:** The operator stops accepting new orders and matching for the finalized market. Users can call `incrementNonce()` onchain if needed.

---

## 9. Trial Cost Tracking

During the trial period (first 7 days), trader costs on the AMM are tracked by LaunchpadEngine for accounting purposes.

### Where It Lives

Trial cost tracking is in **LaunchpadEngine**, not AMMEngine. The AMMEngine is unaware of trial periods.

### How It Works

```
LaunchpadEngine wraps AMMEngine trades during bonding:

1. Trader calls AMMEngine.tradePositions() directly
2. AMMEngine executes the LMSR trade normally
3. LaunchpadEngine (via FeeRouter callback) tracks:
   - totalLockedCost[market] += baseCost    (market-wide total)
   - userLockedCost[market][user] += baseCost (per-user tracking)

On dismiss:
  TruthMarket transitions to DISMISSED state
  Traders call LaunchpadEngine.claimRefund(market) → locked cost refunded
  Creator calls LaunchpadEngine.redeemLP() → residual floor value
```

Trial cost tracking is an accounting layer. The actual trading execution (LMSR math, position updates, lock-on-sell) happens in AMMEngine regardless of trial state.

---

## 10. Two-Venue Interaction

After graduation, both the AMM and the orderbook are active. They are **independent venues** with **independent positions**.

### Independence

```
AMMEngine                          Matching Engine (orderbook)
├── Own position storage           ├── Own position storage
├── Own settlement function        ├── Own settlement function
├── LMSR pricing                   ├── Orderbook pricing
└── Continuous liquidity           └── Discrete limit orders
```

A trader's AMM position and orderbook position are separate. Settling AMM positions and settling orderbook positions are separate transactions.

### Arbitrage

If the AMM price diverges from the orderbook price, arbitrageurs can profit by:

1. Buying cheap on one venue
2. Selling expensive on the other

This natural arbitrage keeps prices aligned across venues. The protocol does not enforce price alignment — the market does.

### Position Transfer Between Venues

There is no direct position transfer between AMM and orderbook. To move from AMM to orderbook:

1. Sell on AMM (receive locked proceeds)
2. Wait for lock to expire (or spend immediately on orderbook)
3. Buy on orderbook

For SoothBook, `mint()` and `merge()` enable converting between base token and outcome shares, which can also bridge between venues.

---

## 11. Events

### AMMEngine Events

| Event | Parameters | When |
|-------|-----------|------|
| `PositionTraded` | `user, market, outcome, deltaShares, cost, newQYes, newQNo` | Every AMM trade |
| `ProceedsLocked` | `user, market, amount, unlockTime` | On sell (24h lock) |
| `ProceedsClaimed` | `user, market, amount` | On claimUnlocked |
| `BalanceUsed` | `user, amount, remaining` | Internal balance spent on buy |
| `BalanceCredited` | `user, amount, newAvailable, newLocked` | Sell proceeds credited |
| `WalletPull` | `user, amount` | Base token pulled from wallet |
| `PositionSettled` | `user, market, winningOutcome, yesShares, noShares, payout` | On AMM position settlement |
| `LiquidityIncreased` | `market, deltaLiquidity, newLiquidity` | bCurrent growth |
| `MarketInitialized` | `market, initialLiquidity` | On initializeMarket |

### Matching Engine Events

| Event | Parameters | When |
|-------|-----------|------|
| `OrderFilled` | `marketKey, maker, taker, outcome, amount, price, fee` | Trade executed |
| `PositionSettled` | `marketKey, user, winningOutcome, payout` | Orderbook position settled |
| `MarketRegistered` | `marketKey, market, baseToken` | Market activated at graduation |

### SoothBook Events

| Event | Parameters | When |
|-------|-----------|------|
| `OrderPlaced` | `orderId, marketKey, maker, side, tick, amount, escrow` | New resting order |
| `OrderCancelled` | `orderId, marketKey, maker, side, tick, refundAmount` | Order cancelled |
| `DustOrderSkipped` | `marketKey, maker, side, tick, amount` | Order too small to rest |
| `Minted` | `marketKey, user, amount` | Complete set created |
| `Merged` | `marketKey, user, amount` | Complete set destroyed |

### CLOB-Specific Events

| Event | Parameters | When |
|-------|-----------|------|
| `OrderCancelled` | `orderHash, maker` | Individual signed order cancelled onchain |
| `NonceIncremented` | `maker, oldNonce, newNonce` | Bulk cancellation |

### Indexer Integration

All events follow the pattern: `(who, what market, what happened, amounts)`. Indexers (Ponder, TheGraph) should listen to events from AMMEngine, matching engine contract, and SoothBook to build a unified trade history. The `marketKey` / `market` address is the join key across venues.

---

## 12. Gas Considerations

### AMMEngine Gas

| Operation | Approximate Gas |
|-----------|----------------|
| Buy (from wallet) | ~120-150k |
| Buy (from internal balance) | ~80-100k |
| Sell (creates lock entry) | ~100-130k |
| claimUnlocked (1 entry) | ~50-60k |
| settlePosition | ~60-80k |

### SoothBook Gas

| Operation | Approximate Gas |
|-----------|----------------|
| buyYes/buyNo (no match, resting) | ~120-150k |
| buyYes/buyNo (1 match) | ~180-250k |
| buyYes/buyNo (sweeping N orders) | ~150k + ~80k per match |
| mint | ~80-100k |
| merge | ~80-100k |
| cancel | ~50-70k |

### CLOB Gas (Matching Engine Fills)

| Operation | Approximate Gas |
|-----------|----------------|
| fillOrder (single) | ~80-120k |
| fillOrders (batch of N) | ~80k + ~50k per additional fill |
| cancelOrder | ~40-50k |
| incrementNonce | ~25-30k |

### Graduation Gas Spike

When a trade triggers graduation, the transaction includes market registration on the matching engine (~100-150k additional gas). Frontends should detect near-graduation markets and increase gas limits.

---

> **Version**: 0.1.0 | **Spec**: Trading Engine | **Updated**: 2026-03-07
> **Layer 1 Dependency**: AMMEngine, FeeRouter, TruthMarket, LaunchpadEngine
> **Matching Engine**: Universal contract for trade execution (used by both SoothBook and CLOB)
> **Orderbook Options**: SoothBook (DLOB) or CLOB (offchain)
> **Audience**: Operators, Integrators, Frontend Developers
