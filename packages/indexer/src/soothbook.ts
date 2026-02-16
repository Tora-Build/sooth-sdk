/// <reference types="ponder/virtual" />

import { and, asc, eq } from "ponder";
import { ponder } from "ponder:registry";
import schema from "ponder:schema";

const eventId = (txHash: string, logIndex: number) => `${txHash}-${logIndex}`;

ponder.on("SoothBook:MarketCreated", async ({ event, context }) => {
  const { marketKey, collateral, yesToken, noToken } = event.args;

  await context.db
    .insert(schema.market)
    .values({
      marketKey,
      chainId: context.chain.id,
      collateral,
      yesToken,
      noToken,
      active: true,
      finalized: false,
      outcome: null,
      createdAt: event.block.timestamp,
      blockNumber: event.block.number,
    })
    .onConflictDoNothing();
});

ponder.on("SoothBook:OrderPlaced", async ({ event, context }) => {
  const { marketKey, side, tick, maker, amount, escrow } = event.args;

  await context.db.insert(schema.order).values({
    id: eventId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    marketKey,
    side,
    tick,
    maker,
    amount,
    escrow,
    status: "active",
    filledAmount: 0n,
    createdAt: event.block.timestamp,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});

ponder.on("SoothBook:OrderFilled", async ({ event, context }) => {
  const { marketKey, takerSide, yesTick, noTick, taker, maker, amount, surplus } = event.args;

  await context.db.insert(schema.fill).values({
    id: eventId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    marketKey,
    takerSide,
    yesTick,
    noTick,
    taker,
    maker,
    amount,
    surplus,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });

  const makerSide = takerSide === 0 ? 1 : 0;
  const makerTick = makerSide === 1 ? yesTick : noTick;

  const activeOrders = await context.db.sql
    .select()
    .from(schema.order)
    .where(
      and(
        eq(schema.order.chainId, context.chain.id),
        eq(schema.order.marketKey, marketKey),
        eq(schema.order.maker, maker),
        eq(schema.order.side, makerSide),
        eq(schema.order.tick, makerTick),
        eq(schema.order.status, "active")
      )
    )
    .orderBy(asc(schema.order.createdAt));

  if (activeOrders.length === 0) return;

  const targetOrder =
    activeOrders.find((order) => order.amount - order.filledAmount >= amount) ?? activeOrders[0];

  const nextFilledAmount = targetOrder.filledAmount + amount;

  await context.db.update(schema.order, { id: targetOrder.id }).set({
    filledAmount: nextFilledAmount,
    status: nextFilledAmount >= targetOrder.amount ? "filled" : "active",
  });
});

ponder.on("SoothBook:OrderCancelled", async ({ event, context }) => {
  const { marketKey, side, tick, maker, amount } = event.args;

  const activeOrders = await context.db.sql
    .select()
    .from(schema.order)
    .where(
      and(
        eq(schema.order.chainId, context.chain.id),
        eq(schema.order.marketKey, marketKey),
        eq(schema.order.maker, maker),
        eq(schema.order.side, side),
        eq(schema.order.tick, tick),
        eq(schema.order.status, "active")
      )
    )
    .orderBy(asc(schema.order.createdAt));

  if (activeOrders.length > 0) {
    const targetOrder =
      activeOrders.find((order) => order.amount - order.filledAmount === amount) ?? activeOrders[0];

    await context.db.update(schema.order, { id: targetOrder.id }).set({
      status: "cancelled",
    });
  }

  await context.db.insert(schema.mintMerge).values({
    id: eventId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    marketKey,
    user: maker,
    action: "cancel",
    amount,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});

ponder.on("SoothBook:Minted", async ({ event, context }) => {
  const { marketKey, user, amount } = event.args;

  await context.db.insert(schema.mintMerge).values({
    id: eventId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    marketKey,
    user,
    action: "mint",
    amount,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});

ponder.on("SoothBook:Merged", async ({ event, context }) => {
  const { marketKey, user, amount } = event.args;

  await context.db.insert(schema.mintMerge).values({
    id: eventId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    marketKey,
    user,
    action: "merge",
    amount,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});

ponder.on("SoothBook:Redeemed", async ({ event, context }) => {
  const { marketKey, user, payout } = event.args;

  await context.db.insert(schema.mintMerge).values({
    id: eventId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    marketKey,
    user,
    action: "redeem",
    amount: payout,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});

ponder.on("SoothBook:MarketResolved", async ({ event, context }) => {
  const { marketKey, outcome } = event.args;

  const existingMarket = await context.db.find(schema.market, { marketKey });
  if (!existingMarket) return;

  await context.db.update(schema.market, { marketKey }).set({
    active: false,
    finalized: true,
    outcome,
  });
});
