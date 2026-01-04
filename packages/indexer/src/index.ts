import { ponder } from "ponder:registry";
import schema from "ponder:schema";

// Helper to create unique IDs
const orderId = (chainId: number, id: bigint) => `${chainId}-${id.toString()}`;
const eventId = (txHash: string, logIndex: number) => `${txHash}-${logIndex}`;
const tickId = (chainId: number, marketKey: string, outcome: number, tick: number) =>
  `${chainId}-${marketKey}-${outcome}-${tick}`;

/**
 * Handle MarketRegistered events
 */
ponder.on("TickBookPoolManager:MarketRegistered", async ({ event, context }) => {
  const { marketKey, market: marketAddr, yesToken, noToken, hook } = event.args;

  await context.db.insert(schema.market).values({
    marketKey,
    chainId: context.chain.id,
    contractAddress: marketAddr,
    yesToken,
    noToken,
    hook,
    createdAt: event.block.timestamp,
    blockNumber: event.block.number,
  });
});

/**
 * Handle RangeOrderPlaced events
 */
ponder.on("TickBookPoolManager:RangeOrderPlaced", async ({ event, context }) => {
  const {
    owner,
    marketKey,
    orderId: orderIdBigInt,
    outcome,
    tickLower,
    tickUpper,
    liquidity,
    collateralReserved,
    crossingFilled,
    crossingCost,
  } = event.args;

  const id = orderId(context.chain.id, orderIdBigInt);

  await context.db.insert(schema.order).values({
    id,
    chainId: context.chain.id,
    orderId: orderIdBigInt,
    marketKey,
    owner,
    outcome,
    tickLower,
    tickUpper,
    liquidity,
    collateralReserved,
    crossingFilled,
    crossingCost,
    status: "active",
    filledShares: crossingFilled, // Initial crossing fills
    claimedShares: 0n,
    collateralUsed: crossingCost,
    createdAt: event.block.timestamp,
    updatedAt: event.block.timestamp,
    blockNumber: event.block.number,
  });

  // Update tick liquidity for each tick in the range
  for (let tick = tickLower; tick <= tickUpper; tick++) {
    const tid = tickId(context.chain.id, marketKey, outcome, tick);

    await context.db
      .insert(schema.tickLiquidity)
      .values({
        id: tid,
        chainId: context.chain.id,
        marketKey,
        outcome,
        tick,
        totalLiquidity: liquidity,
        orderCount: 1,
        updatedAt: event.block.timestamp,
      })
      .onConflictDoUpdate((row) => ({
        totalLiquidity: row.totalLiquidity + liquidity,
        orderCount: row.orderCount + 1,
        updatedAt: event.block.timestamp,
      }));
  }
});

/**
 * Handle RangeOrderCancelled events
 */
ponder.on("TickBookPoolManager:RangeOrderCancelled", async ({ event, context }) => {
  const { orderId: orderIdBigInt } = event.args;

  const id = orderId(context.chain.id, orderIdBigInt);

  // Get the order to update tick liquidity
  const existingOrder = await context.db.find(schema.order, { id });

  if (existingOrder) {
    await context.db.update(schema.order, { id }).set({
      status: "cancelled",
      updatedAt: event.block.timestamp,
    });

    // Update tick liquidity
    for (let tick = existingOrder.tickLower; tick <= existingOrder.tickUpper; tick++) {
      const tid = tickId(
        context.chain.id,
        existingOrder.marketKey,
        existingOrder.outcome,
        tick
      );

      const existingTick = await context.db.find(schema.tickLiquidity, { id: tid });
      if (existingTick) {
        await context.db.update(schema.tickLiquidity, { id: tid }).set({
          totalLiquidity: existingTick.totalLiquidity - existingOrder.liquidity,
          orderCount: existingTick.orderCount - 1,
          updatedAt: event.block.timestamp,
        });
      }
    }
  }
});

/**
 * Handle FillsClaimed events
 */
ponder.on("TickBookPoolManager:FillsClaimed", async ({ event, context }) => {
  const { owner, marketKey, orderId: orderIdBigInt, filledShares, collateralUsedWad } = event.args;

  const id = eventId(event.transaction.hash, event.log.logIndex);
  const oid = orderId(context.chain.id, orderIdBigInt);

  // Record the claim
  await context.db.insert(schema.fillClaim).values({
    id,
    chainId: context.chain.id,
    orderId: orderIdBigInt,
    marketKey,
    owner,
    filledShares,
    collateralUsedWad,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });

  // Update order state
  const existingOrder = await context.db.find(schema.order, { id: oid });
  if (existingOrder) {
    const newClaimedShares = existingOrder.claimedShares + filledShares;
    const newCollateralUsed = existingOrder.collateralUsed + collateralUsedWad;

    // Check if order is now fully filled
    const isFullyFilled = newClaimedShares >= existingOrder.liquidity;

    await context.db.update(schema.order, { id: oid }).set({
      claimedShares: newClaimedShares,
      collateralUsed: newCollateralUsed,
      status: isFullyFilled ? "filled" : existingOrder.status,
      updatedAt: event.block.timestamp,
    });

    // If fully filled, update tick liquidity
    if (isFullyFilled) {
      for (let tick = existingOrder.tickLower; tick <= existingOrder.tickUpper; tick++) {
        const tid = tickId(
          context.chain.id,
          existingOrder.marketKey,
          existingOrder.outcome,
          tick
        );

        const existingTick = await context.db.find(schema.tickLiquidity, { id: tid });
        if (existingTick) {
          await context.db.update(schema.tickLiquidity, { id: tid }).set({
            totalLiquidity: existingTick.totalLiquidity - existingOrder.liquidity,
            orderCount: existingTick.orderCount - 1,
            updatedAt: event.block.timestamp,
          });
        }
      }
    }
  }
});

/**
 * Handle MarketOrderExecuted events
 */
ponder.on("TickBookPoolManager:MarketOrderExecuted", async ({ event, context }) => {
  const {
    taker,
    marketKey,
    outcome,
    sharesRequested,
    sharesFilled,
    totalCost,
    startTick,
    endTick,
    refunded,
  } = event.args;

  const id = eventId(event.transaction.hash, event.log.logIndex);

  await context.db.insert(schema.marketOrder).values({
    id,
    chainId: context.chain.id,
    marketKey,
    taker,
    outcome,
    sharesRequested,
    sharesFilled,
    totalCost,
    startTick,
    endTick,
    refunded,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});
