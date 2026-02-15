import { ponder } from "ponder:registry";
import schema from "ponder:schema";

const eventId = (txHash: string, logIndex: number) => `${txHash}-${logIndex}`;

ponder.on("SoothBook:MarketCreated", async ({ event, context }) => {
  const { marketKey, collateral, yesToken, noToken } = event.args;

  await context.db
    .insert(schema.soothbookMarket)
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

  await context.db.insert(schema.soothbookOrder).values({
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

  await context.db.insert(schema.soothbookFill).values({
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
});

ponder.on("SoothBook:OrderCancelled", async ({ event, context }) => {
  const { marketKey, maker, amount } = event.args;

  await context.db.insert(schema.soothbookMintMerge).values({
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

  await context.db.insert(schema.soothbookMintMerge).values({
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

  await context.db.insert(schema.soothbookMintMerge).values({
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

  await context.db.insert(schema.soothbookMintMerge).values({
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

  const existingMarket = await context.db.find(schema.soothbookMarket, { marketKey });
  if (!existingMarket) return;

  await context.db.update(schema.soothbookMarket, { marketKey }).set({
    active: false,
    finalized: true,
    outcome,
  });
});
