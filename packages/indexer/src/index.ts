import { ponder } from "@ponder/core";
import { market, order, fillClaim, marketOrder, tickLiquidity } from "../ponder.schema";

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

  await context.db.insert(market).values({
    marketKey,
    chainId: context.network.chainId,
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

  const id = orderId(context.network.chainId, orderIdBigInt);

  await context.db.insert(order).values({
    id,
    chainId: context.network.chainId,
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
    const tid = tickId(context.network.chainId, marketKey, outcome, tick);

    await context.db
      .insert(tickLiquidity)
      .values({
        id: tid,
        chainId: context.network.chainId,
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
  const { orderId: orderIdBigInt, collateralReleased } = event.args;

  const id = orderId(context.network.chainId, orderIdBigInt);

  // Get the order to update tick liquidity
  const existingOrder = await context.db.find(order, { id });

  if (existingOrder) {
    await context.db.update(order, { id }).set({
      status: "cancelled",
      updatedAt: event.block.timestamp,
    });

    // Update tick liquidity
    for (let tick = existingOrder.tickLower; tick <= existingOrder.tickUpper; tick++) {
      const tid = tickId(
        context.network.chainId,
        existingOrder.marketKey,
        existingOrder.outcome,
        tick
      );

      await context.db.update(tickLiquidity, { id: tid }).set((row) => ({
        totalLiquidity: row.totalLiquidity - existingOrder.liquidity,
        orderCount: row.orderCount - 1,
        updatedAt: event.block.timestamp,
      }));
    }
  }
});

/**
 * Handle FillsClaimed events
 */
ponder.on("TickBookPoolManager:FillsClaimed", async ({ event, context }) => {
  const { owner, marketKey, orderId: orderIdBigInt, filledShares, collateralUsedWad } = event.args;

  const id = eventId(event.transaction.hash, event.log.logIndex);
  const oid = orderId(context.network.chainId, orderIdBigInt);

  // Record the claim
  await context.db.insert(fillClaim).values({
    id,
    chainId: context.network.chainId,
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
  const existingOrder = await context.db.find(order, { id: oid });
  if (existingOrder) {
    const newClaimedShares = existingOrder.claimedShares + filledShares;
    const newCollateralUsed = existingOrder.collateralUsed + collateralUsedWad;

    // Check if order is now fully filled
    const isFullyFilled = newClaimedShares >= existingOrder.liquidity;

    await context.db.update(order, { id: oid }).set({
      claimedShares: newClaimedShares,
      collateralUsed: newCollateralUsed,
      status: isFullyFilled ? "filled" : existingOrder.status,
      updatedAt: event.block.timestamp,
    });

    // If fully filled, update tick liquidity
    if (isFullyFilled) {
      for (let tick = existingOrder.tickLower; tick <= existingOrder.tickUpper; tick++) {
        const tid = tickId(
          context.network.chainId,
          existingOrder.marketKey,
          existingOrder.outcome,
          tick
        );

        await context.db.update(tickLiquidity, { id: tid }).set((row) => ({
          totalLiquidity: row.totalLiquidity - existingOrder.liquidity,
          orderCount: row.orderCount - 1,
          updatedAt: event.block.timestamp,
        }));
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

  await context.db.insert(marketOrder).values({
    id,
    chainId: context.network.chainId,
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
