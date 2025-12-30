# TickBook Vault-Native Orderbook Plan (V7 Capital Efficiency, V8 Isolation)

**Status**: Proposed (for review)  
**Scope**: Orderbook venue only (TickBook). AMM is out-of-scope.  
**North Star**: V7-style capital-efficient orderbook UX (USDC-collateral bids/shorts) with strict domain isolation.  

---

## 0.1) Tick Resolution Decision (10,000 → 1,000)

**Decision**: Reduce tick count from **10,000** to **1,000**.

- **Old**: 10,000 ticks ⇒ 0.01% increments (1 bp), `tick ∈ [1..9999]`, \(P(YES)=tick/10000\)
- **New**: 1,000 ticks ⇒ 0.1% increments (10 bps), `tick ∈ [1..999]`, \(P(YES)=tick/1000\)

> **Note**: Tick 0 (0% probability) is excluded — a 0% outcome is already resolved NO.

**Why (alpha tradeoff)**:
- **Pros**: fewer tick crossings in `executeMarketOrder`/quote simulation, smaller UI datasets, simpler UX.
- **Cons**: coarser price grid, wider minimum spread, less precise market making.

## 0) Problem Statement

Current V8 TickBook is **token-inventory-based** (YES/NO ERC20 approvals + `transferFrom`). This makes **resting** limit orders capital-inefficient in a complete-set world:

- To obtain 1 YES via complete-set minting, a user typically must split ~1 USDC (mint 1 YES + 1 NO) and then sell the opposite leg to net down.
- That forces **gross $1/share funding** for maker liquidity even when user intent is “Bid YES @ 0.40” (should reserve $0.40).

We want the V7 behavior:

- **Buy YES @ P** reserves **P × qty** USDC.
- **Sell YES @ P** is supported as a **short** via mirroring:
  - `Sell YES @ P` ≡ `Buy NO @ (1−P)`.

---

## 1) Core Decision

### Decision: Vault-native TickBook with internal balances

- TickBook trades **internal balances** (an exchange-style ledger).
- Outcome ERC20 tokens (YES/NO) are **not involved** in TickBook matching/settlement.
- **ERC20 YES/NO mint/burn happens only at vault boundaries**:
  - **Withdraw**: internal → ERC20 mint
  - **Deposit**: ERC20 → internal burn

### Phase-1 product constraint (requested)

For now, the dApp **does not surface**:
- YES/NO internal accounting
- YES/NO deposit/withdraw UX

These remain **hidden interfaces** for future composability.

---

## 2) Mental Model (User Perspective)

### Phase 1 (ship)
- User interacts with **USDC only**.
- User can place/cancel limit orders funded by **USDC collateral**, not outcome tokens.
- Shorting is available via “Sell” UX (internally mirrored).

### Phase 2 (optional, later)
- Users can deposit/withdraw YES/NO ERC20 for 3rd-party venue usage.
- These are boundary operations only; TickBook remains isolated.

---

## 3) V7 Semantics We Preserve

### 3.1 Unified mirrored semantics (binary identity)

- `Sell YES @ P` ≡ `Buy NO @ (1−P)`
- `Sell NO @ P` ≡ `Buy YES @ (1−P)`

Implication: UI can keep Buy/Sell, but internally normalize to “BUY side + implied YES price”.

### 3.2 Capital-efficient collateralization

For size \(q\) shares and YES price \(P\):
- YES-buyer escrows: \(P \cdot q\) USDC
- NO-buyer escrows: \((1-P) \cdot q\) USDC

When those meet at the same implied YES price, total escrow equals:
\[
Pq + (1-P)q = 1 \cdot q
\]
This is the “complete-set funding” invariant without requiring complete-set minting at order placement time.

---

## 4) Proposed Contract Architecture

### 4.1 New contract: `TickBookVault` (global per chain)

**Responsibilities**
- Custody ERC20 USDC on deposit/withdraw.
- Maintain per-user **internal USDC**:
  - `availableUsdc[user]`
  - `reservedUsdc[user]` (reserved for open orders)
- Maintain per-user, per-market **internal outcomes**:
  - `yesInternal[market][user]`
  - `noInternal[market][user]`
  - **Phase 1**: internal outcomes exist but are not exposed in the frontend.

**Hidden boundary interfaces (Phase 2)**
- `depositOutcome(market, side, amount)`:
  - burns ERC20 YES/NO
  - credits internal yes/no
- `withdrawOutcome(market, side, amount)`:
  - debits internal yes/no
  - mints ERC20 YES/NO

**Order funding primitives (Phase 1)**
- `reserveUsdc(user, amount)` / `releaseUsdc(user, amount)` (TickBook-only)
- `transferReservedUsdc(from, to, amount)` (TickBook-only) for matching settlement

**Notes**
- Vault is the **only** place that touches ERC20 balances (USDC transfers always; YES/NO mint/burn only at boundary, future).

### 4.2 Refactor: `TickBook` becomes vault-native

**TickBook does not:**
- `transferFrom` YES/NO
- require outcome token approvals
- mint/burn outcome tokens

**TickBook does:**
- place/cancel orders by reserving/releasing internal USDC in `TickBookVault`
- match opposite-side orders
- on fill:
  - moves internal USDC between counterparties
  - credits internal YES/NO balances (within the vault) to the correct recipient

This keeps TickBook a pure **matching engine + accounting router**.

---

## 5) Settlement / Redemption (Phase 1 requirement)

We need a way for users to realize PnL post-resolution without exposing outcome token UX yet.

### Proposed Phase 1: vault-native redemption

Add a vault method:
- `redeemResolved(market, user)` or `redeemResolved(market, side, amount)`

Behavior:
- Reads TruthMarket resolution outcome.
- Converts **internal YES/NO** → internal USDC payout (and makes it withdrawable).
- This does not require minting ERC20 YES/NO.

### Phase 2 composability path

If users withdraw ERC20 YES/NO to external venues:
- they can deposit back (burn) into the vault and redeem internally, **or**
- we later add a direct ERC20 redemption path that still respects “mint/burn only at boundary” (e.g., require deposit-then-redeem).

---

## 6) Frontend / UX Plan

### Phase 1 (ship): Pro is USDC-only

In `apps/web/src/pages/Pro.tsx` and related TickBook hooks:
- Show:
  - USDC wallet balance
  - optional vault USDC balance (if we require deposit)
  - **YES shares / NO shares** (internal TickBook shares; non-transferable in Phase 1)
  - open orders + fills
- Actions:
  - deposit USDC to vault (optional gating)
  - withdraw USDC from vault
  - place/cancel limit orders
  - execute market orders (if supported)

**Key UX invariant**
- Place “Buy 1 YES @ 0.40” requires reserving **$0.40**, not $1.00.

### Phase 2 (future): enable token boundaries

- Add advanced panel to deposit/withdraw YES/NO
- Keep it out of the primary Pro flow unless explicitly enabled
  - Phase 2 clarifier: YES/NO *ERC20 tokens* only exist at the vault boundary (withdraw mints, deposit burns).

---

## 7) API Surface (Draft; to finalize in design)

### TickBook (vault-native)
- `placeLimitOrder(market, side, yesPriceWad, sizeWad, ...)`  
  - side is “wants YES” or “wants NO” after normalization
  - reserves `price * size` (or `(1-price)*size`) internal USDC
- `cancelOrder(orderId)` → releases reserved USDC
- `executeMarketOrder(...)` (optional v1)

### TickBookVault
- USDC
  - `depositUsdc(amountAsset)` / `withdrawUsdc(amountAsset)`
  - `availableUsdc(user)` / `reservedUsdc(user)`
- Hidden outcomes (Phase 2)
  - `depositOutcome(...)` / `withdrawOutcome(...)`
  - (mint/burn only here)
- TickBook-only accounting hooks
  - `reserveUsdc(...)`, `releaseUsdc(...)`, `transferReservedUsdc(...)`
  - `creditInternalOutcome(...)`

---

## 8) Security Notes (Phase 1)

- Vault is custody for USDC. Requirements:
  - reentrancy guards
  - strict accounting invariants (`available + reserved` never exceeds deposited minus withdrawals)
  - TickBook-only privileges tightly scoped (no arbitrary balance writes)
  - emergency pause and/or per-market disable
- Matching must preserve:
  - **no under-collateralized fills**
  - rounding correctness at decimal boundaries (WAD vs USDC decimals)

---

## 9) Migration / Breaking Changes

This is a breaking change to the TickBook venue:
- TickBook no longer uses ERC20 outcome tokens for matching.
- Frontend Pro flow changes (no more approve YES/NO).
- Tick resolution changes from 10,000 to 1,000 ticks (affects contract math, UI snap/rounding, and any offchain tooling).

Repo hygiene:
- Update `CHANGELOG.md` (call out breaking orderbook + new vault)
- Add/update `DECISIONS.md`:
  - “TickBook is vault-native; ERC20 outcome tokens only minted/burned at vault boundary; Pro is USDC-only in Phase 1.”
- Update ABIs and `apps/web/src/config/deployments.json` and bump `version` to invalidate caches.

---

## 10) Phases & Deliverables

### Phase 1 (shipable core)
- `TickBookVault` with USDC deposit/withdraw + reserve/release primitives
- TickBook refactor to use vault internal USDC collateral
- Unified mirrored order placement + matching
- Vault-native redemption post-resolution (no outcome token UX)
- Pro UI: USDC-only trading + order management
- Tick resolution change implemented end-to-end:
  - `packages/contracts-evm/contracts/libraries/TickMath.sol`: `NUM_TICKS=1000`, `MAX_TICK=999`
  - `packages/contracts-evm/contracts/libraries/TickBitmap.sol`: `MAX_TICK=999` and adjust bitmap layout assumptions (10 words × 100 bits, still 2-level)
  - `TickBook` init tick at 50% becomes `500` (not `5000`)
  - Frontend tick snapping uses 0.1% increments
  - `TickMap` no longer assumes a 100×100=10,000 grid (see below)

### Phase 2 (composability)
- Hidden/advanced YES/NO deposit/withdraw surfaces enabled in UI
- External venue workflows (withdraw tokens, trade elsewhere, deposit back)

---

## 11) Acceptance Criteria

- A user can place a resting order “Buy 1 YES @ 0.40” by reserving **$0.40 USDC**, not $1.00.
- A user can “Sell YES @ P” without owning YES (short) via mirrored semantics funded by USDC collateral.
- Pro UI does not require the user to understand YES/NO token accounting in Phase 1.
- (If implemented) post-resolution redemption works end-to-end using internal balances only.

## 12) Frontend Tick UX changes (1,000 ticks)

### 12.1 Price input + snapping
- Price slider / input increments become **0.1%**.
- Convert probability ↔ tick using 1,000-scale math, and clearly display rounding (floor).

### 12.2 TickMap visualization
The current 10,000-tick UI heatmap is a 100×100 grid. With 1,000 ticks:
- **Option A (recommended)**: use a **100×10** grid (or 50×20), one cell per tick.
- **Option B**: keep 100×100 but render 10 ticks per row segment (aggregation). This preserves the “terminal aesthetic” but adds complexity.

Phase 1 recommendation: **Option A** for correctness and simplicity.


