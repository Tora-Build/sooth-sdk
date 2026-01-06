# Spot Sell & “Hybrid Sell” (User-Flow Technical Overview)

This document explains **Spot Sell** and the frontend “Hybrid Sell” behavior from the perspective of a user interacting with the app (UI → transactions → what appears on-screen).

## Core primitives (what exists on-chain)

TickBook exposes **two distinct mechanisms** for “selling” exposure:

1. **Orderbook orders (range/limit/market)**
   - Contract entrypoint: `TickBookPoolManager.placeOrder(marketKey, outcome, shares, tickLower, tickUpper, maxCost)`
   - You can “sell YES” synthetically by **buying NO** (and vice versa).
   - These create **orderIds** and participate in the standard claim/cancel flow.

2. **Spot sells (asks backed by owned shares)**
   - Contract entrypoints:
     - `placeSpotSell(marketKey, outcomeToSell, shares, tickLower, tickUpper)`
     - `cancelSpotSell(marketKey, sellId)`
     - `claimSpotSellProceeds(marketKey, sellId)` (when applicable)
   - These create **sellIds** and are separate from `placeOrder`.
   - Spot sells require you to already have sufficient **internal shares** of the outcome you’re selling.

## User-flow: deciding what happens when you click “Sell”

From the UI’s point of view, “Sell” is determined by comparing:

- `userHolding` = how many internal shares you already own for the selected outcome
- `amount` = how many shares you want to sell

### Case A — Spot sell (1 transaction)

Condition: `userHolding >= amount`

Flow:
1. UI submits `placeSpotSell(...)` for `amount`.
2. You get a `sellId` on-chain.
3. The spot sell appears under the **Spot Sells** group in the orders panel.

### Case B — Short sell (1 transaction)

Condition: `userHolding == 0`

Flow:
1. UI submits `placeOrder(...)` on the **opposite** outcome (synthetic sell).
2. You get an `orderId` on-chain.
3. The order appears under the normal **Orders** list.

### Case C — “Hybrid sell” (2 transactions)

Condition: `0 < userHolding < amount`

Flow:
1. UI submits `placeSpotSell(...)` for `userHolding` (the portion you actually own).
2. UI submits `placeOrder(...)` on the opposite outcome for `amount - userHolding` (the remainder as a short).

**Important clarification:** there is **no single “hybrid sell” contract function**. “Hybrid sell” is **frontend orchestration** of **two different on-chain mechanisms**, which is why it results in **two orders** (a `sellId` + an `orderId`) and typically **two transactions**.

## Chart: end-to-end sell decision

```mermaid
flowchart TD
  A[User clicks Sell] --> B{Do you own internal shares
  of the outcome you want to sell?}

  B -->|No (0 shares)| S1[Short Sell]
  S1 --> S2[TX: placeOrder(oppositeOutcome, amount, ...)]
  S2 --> S3[Creates orderId]

  B -->|Yes (some shares)| C{Owned shares >= amount?}

  C -->|Yes| P1[Spot Sell]
  P1 --> P2[TX: placeSpotSell(outcomeToSell, amount, ...)]
  P2 --> P3[Creates sellId]

  C -->|No (partial)| H1[Hybrid Sell]
  H1 --> H2[TX1: placeSpotSell(outcomeToSell, userHolding, ...)]
  H2 --> H3[Creates sellId]
  H3 --> H4[TX2: placeOrder(oppositeOutcome, amount-userHolding, ...)]
  H4 --> H5[Creates orderId]
```

## What this means in the UI

### Orders panel grouping & batch actions

- The UI shows **two independent groups**:
  - **Orders**: range/limit/market orders (`orderId`)
  - **Spot Sells**: spot sell asks (`sellId`)

- Batch actions like **Cancel All** / **Claim All** apply to **Orders** (orderbook orders) only.
  - Spot sells currently support **per-row cancel** (`cancelSpotSell`) and do not participate in the existing batch cancel/claim flows.

### Liquidity map / depth

- Spot sells contribute to displayed liquidity, but they are sourced/represented differently than range orders.
- Depth sampling should include both **range liquidity** and **spot liquidity** so asks posted via spot sells aren’t invisible.

## User-facing copy (for the in-app hint)

Use this text (or a trimmed variant) in the UI hint:

> **Spot sells** are asks backed by shares you already own.
> If you don’t own enough shares, the app may do a **hybrid sell**: a spot sell for what you own + a short sell for the rest (often **2 transactions**).
> Spot sells are cancelled **one-by-one** (batch actions don’t apply).
