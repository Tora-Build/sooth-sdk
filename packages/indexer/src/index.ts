import { ponder } from "ponder:registry";
import schema from "ponder:schema";

// Helper to create unique IDs
const orderId = (chainId: number, id: bigint) => `${chainId}-${id.toString()}`;
const sellId = (chainId: number, id: bigint) => `${chainId}-${id.toString()}`;
const eventId = (txHash: string, logIndex: number) => `${txHash}-${logIndex}`;
const tickId = (chainId: number, marketKey: string, outcome: number, tick: number) =>
  `${chainId}-${marketKey}-${outcome}-${tick}`;
const fillGrowthId = (chainId: number, marketKey: string, outcome: number) =>
  `${chainId}-${marketKey}-${outcome}`;

const Q128 = 2n ** 128n;

function calculatePendingFills(
  orderSharesTotal: bigint,
  orderClaimedShares: bigint,
  orderCrossingFilled: bigint,
  orderFillGrowthLast: bigint,
  globalFillGrowth: bigint
): bigint {
  if (globalFillGrowth <= orderFillGrowthLast) return 0n;
  
  const delta = globalFillGrowth - orderFillGrowthLast;
  let pending = (delta * orderSharesTotal) / Q128;
  
  const maxFillable = orderSharesTotal - orderCrossingFilled - orderClaimedShares;
  if (pending > maxFillable) {
    pending = maxFillable;
  }
  
  return pending > 0n ? pending : 0n;
}

/**
 * Handle MarketRegistered events
 * V9.9.7: hook field removed (simple fee storage replaces hook system)
 */
ponder.on("TickBookPoolManager:MarketRegistered", async ({ event, context }) => {
  const { marketKey, market: marketAddr, yesToken, noToken } = event.args;

  await context.db
    .insert(schema.market)
    .values({
      marketKey,
      chainId: context.chain.id,
      contractAddress: marketAddr,
      yesToken,
      noToken,
      hook: null,
      createdAt: event.block.timestamp,
      blockNumber: event.block.number,
    })
    .onConflictDoNothing();
});

/**
 * Handle OrderPlaced events (V9.9.6 unified API)
 */
ponder.on("TickBookPoolManager:OrderPlaced", async ({ event, context }) => {
  const {
    owner,
    marketKey,
    orderId: orderIdBigInt,
    outcome,
    tickLower,
    tickUpper,
    shares,
    filledShares,
    filledCost,
    restingShares,
  } = event.args;

  const id = orderId(context.chain.id, orderIdBigInt);
  const fgId = fillGrowthId(context.chain.id, marketKey, outcome);

  const fillGrowth = await context.db.find(schema.fillGrowthState, { id: fgId });
  const currentFillGrowthX128 = fillGrowth?.fillGrowthX128 ?? 0n;

  await context.db.insert(schema.order).values({
    id,
    chainId: context.chain.id,
    orderId: orderIdBigInt,
    marketKey,
    owner,
    outcome,
    tickLower,
    tickUpper,
    liquidity: shares,
    collateralReserved: 0n,
    crossingFilled: filledShares,
    crossingCost: filledCost,
    status: restingShares > 0n ? "active" : "filled",
    filledShares: filledShares,
    claimedShares: 0n,
    pendingShares: filledShares,
    pendingUsdc: filledCost,
    collateralUsed: filledCost,
    createdAt: event.block.timestamp,
    updatedAt: event.block.timestamp,
    blockNumber: event.block.number,
    fillGrowthLastX128: currentFillGrowthX128,
  });

  if (restingShares > 0n) {
    await context.db
      .insert(schema.fillGrowthState)
      .values({
        id: fgId,
        chainId: context.chain.id,
        marketKey,
        outcome,
        totalLiquidity: restingShares,
        fillGrowthX128: 0n,
        updatedAt: event.block.timestamp,
      })
      .onConflictDoUpdate((row) => ({
        totalLiquidity: row.totalLiquidity + restingShares,
        updatedAt: event.block.timestamp,
      }));

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
          totalLiquidity: restingShares,
          orderCount: 1,
          updatedAt: event.block.timestamp,
        })
        .onConflictDoUpdate((row) => ({
          totalLiquidity: row.totalLiquidity + restingShares,
          orderCount: row.orderCount + 1,
          updatedAt: event.block.timestamp,
        }));
    }
  }
});

/**
 * Handle RangeOrderCancelled events
 */
ponder.on("TickBookPoolManager:RangeOrderCancelled", async ({ event, context }) => {
  const { orderId: orderIdBigInt } = event.args;

  const id = orderId(context.chain.id, orderIdBigInt);

  const existingOrder = await context.db.find(schema.order, { id });

  if (existingOrder) {
    const unfilledShares = existingOrder.liquidity - existingOrder.crossingFilled - existingOrder.claimedShares;
    
    await context.db.update(schema.order, { id }).set({
      status: "cancelled",
      updatedAt: event.block.timestamp,
    });

    if (unfilledShares > 0n) {
      const fgId = fillGrowthId(context.chain.id, existingOrder.marketKey, existingOrder.outcome);
      const fillGrowth = await context.db.find(schema.fillGrowthState, { id: fgId });
      
      if (fillGrowth) {
        const newTotalLiquidity = fillGrowth.totalLiquidity > unfilledShares 
          ? fillGrowth.totalLiquidity - unfilledShares 
          : 0n;
        
        await context.db.update(schema.fillGrowthState, { id: fgId }).set({
          totalLiquidity: newTotalLiquidity,
          updatedAt: event.block.timestamp,
        });
      }
    }

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

  const existingOrder = await context.db.find(schema.order, { id: oid });
  if (existingOrder) {
    const newClaimedShares = existingOrder.claimedShares + filledShares;
    const newCollateralUsed = existingOrder.collateralUsed + collateralUsedWad;
    
    const newPendingShares = existingOrder.pendingShares > filledShares 
      ? existingOrder.pendingShares - filledShares 
      : 0n;
    const newPendingUsdc = existingOrder.pendingUsdc > collateralUsedWad
      ? existingOrder.pendingUsdc - collateralUsedWad
      : 0n;

    const isFullyFilled = newClaimedShares >= existingOrder.liquidity;

    const fgId = fillGrowthId(context.chain.id, marketKey, existingOrder.outcome);
    const fillGrowth = await context.db.find(schema.fillGrowthState, { id: fgId });
    const currentFillGrowthX128 = fillGrowth?.fillGrowthX128 ?? 0n;

    await context.db.update(schema.order, { id: oid }).set({
      claimedShares: newClaimedShares,
      collateralUsed: newCollateralUsed,
      pendingShares: newPendingShares,
      pendingUsdc: newPendingUsdc,
      status: isFullyFilled ? "filled" : existingOrder.status,
      fillGrowthLastX128: currentFillGrowthX128,
      updatedAt: event.block.timestamp,
    });

    if (isFullyFilled) {
      if (fillGrowth) {
        const remainingLiquidity = existingOrder.liquidity - existingOrder.crossingFilled - newClaimedShares;
        if (remainingLiquidity > 0n) {
          const newTotalLiquidity = fillGrowth.totalLiquidity > remainingLiquidity
            ? fillGrowth.totalLiquidity - remainingLiquidity
            : 0n;
          
          await context.db.update(schema.fillGrowthState, { id: fgId }).set({
            totalLiquidity: newTotalLiquidity,
            updatedAt: event.block.timestamp,
          });
        }
      }

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
 * Handle MarketOrderFilled events
 */
ponder.on("TickBookPoolManager:MarketOrderFilled", async ({ event, context }) => {
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

/**
 * Handle OrdersCrossed events - when a new order crosses existing liquidity
 */
ponder.on("TickBookPoolManager:OrdersCrossed", async ({ event, context }) => {
  const {
    marketKey,
    newOrderId,
    newOutcome,
    crossedShares,
    newOrderCost,
    oppositeOrderCost,
    crossTick,
  } = event.args;

  const id = eventId(event.transaction.hash, event.log.logIndex);

  await context.db.insert(schema.orderCrossed).values({
    id,
    chainId: context.chain.id,
    marketKey,
    newOrderId,
    newOutcome,
    crossedShares,
    newOrderCost,
    oppositeOrderCost,
    crossTick,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});

/**
 * Handle TickCrossed events - when market orders consume liquidity at a tick
 */
ponder.on("TickBookPoolManager:TickCrossed", async ({ event, context }) => {
  const { marketKey, tick, liquidityDelta } = event.args;

  const id = eventId(event.transaction.hash, event.log.logIndex);

  await context.db.insert(schema.tickCrossed).values({
    id,
    chainId: context.chain.id,
    marketKey,
    tick,
    liquidityDelta,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});

// ============================================
// V9.9.7: Spot Sell Event Handlers
// ============================================

/**
 * Handle SpotSellPlaced events
 */
ponder.on("TickBookPoolManager:SpotSellPlaced", async ({ event, context }) => {
  const {
    owner,
    marketKey,
    sellId: sellIdBigInt,
    outcome,
    tickLower,
    tickUpper,
    shares,
  } = event.args;

  const id = sellId(context.chain.id, sellIdBigInt);

  await context.db.insert(schema.spotSellOrder).values({
    id,
    chainId: context.chain.id,
    sellId: sellIdBigInt,
    marketKey,
    owner,
    outcome,
    tickLower,
    tickUpper,
    shares,
    status: "active",
    filledShares: 0n,
    proceeds: 0n,
    createdAt: event.block.timestamp,
    updatedAt: event.block.timestamp,
    blockNumber: event.block.number,
  });

  // Update tick liquidity for sell-side (adds liquidity at the ticks)
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
        totalLiquidity: shares,
        orderCount: 1,
        updatedAt: event.block.timestamp,
      })
      .onConflictDoUpdate((row) => ({
        totalLiquidity: row.totalLiquidity + shares,
        orderCount: row.orderCount + 1,
        updatedAt: event.block.timestamp,
      }));
  }
});

/**
 * Handle SpotSellCancelled events
 */
ponder.on("TickBookPoolManager:SpotSellCancelled", async ({ event, context }) => {
  const { sellId: sellIdBigInt } = event.args;

  const id = sellId(context.chain.id, sellIdBigInt);

  const existingOrder = await context.db.find(schema.spotSellOrder, { id });

  if (existingOrder) {
    await context.db.update(schema.spotSellOrder, { id }).set({
      status: "cancelled",
      updatedAt: event.block.timestamp,
    });

    // Update tick liquidity - subtract original shares (not sharesReturned)
    // to avoid phantom liquidity from partial fills
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
          totalLiquidity: existingTick.totalLiquidity - existingOrder.shares,
          orderCount: existingTick.orderCount - 1,
          updatedAt: event.block.timestamp,
        });
      }
    }
  }
});

/**
 * Handle SpotSellFilled events
 */
ponder.on("TickBookPoolManager:SpotSellFilled", async ({ event, context }) => {
  const { marketKey, sellId: sellIdBigInt, sharesFilled, proceeds } = event.args;

  const id = sellId(context.chain.id, sellIdBigInt);
  const eid = eventId(event.transaction.hash, event.log.logIndex);

  // Record the fill
  await context.db.insert(schema.spotSellFill).values({
    id: eid,
    chainId: context.chain.id,
    sellId: sellIdBigInt,
    marketKey,
    sharesFilled,
    proceeds,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });

  // Update spot sell order state
  const existingOrder = await context.db.find(schema.spotSellOrder, { id });
  if (existingOrder) {
    const newFilledShares = existingOrder.filledShares + sharesFilled;
    const newProceeds = existingOrder.proceeds + proceeds;
    const isFullyFilled = newFilledShares >= existingOrder.shares;

    await context.db.update(schema.spotSellOrder, { id }).set({
      filledShares: newFilledShares,
      proceeds: newProceeds,
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
            totalLiquidity: existingTick.totalLiquidity - existingOrder.shares,
            orderCount: existingTick.orderCount - 1,
            updatedAt: event.block.timestamp,
          });
        }
      }
    }
  }
});

// ============================================
// V10: Unified Crossing Event Handler
// ============================================

/**
 * Handle UnifiedCrossing events - V10 spot-first + range crossing
 */
ponder.on("TickBookPoolManager:UnifiedCrossing", async ({ event, context }) => {
  const {
    marketKey,
    newOrderId,
    newOutcome,
    spotFilled,
    rangeFilled,
    spotCost,
    rangeCost,
    crossTick,
  } = event.args;

  const id = eventId(event.transaction.hash, event.log.logIndex);

  await context.db.insert(schema.unifiedCrossing).values({
    id,
    chainId: context.chain.id,
    marketKey,
    newOrderId,
    newOutcome,
    spotFilled,
    rangeFilled,
    spotCost,
    rangeCost,
    crossTick,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });

  if (rangeFilled > 0n) {
    const oppositeOutcome = newOutcome === 0 ? 1 : 0;
    const fgId = fillGrowthId(context.chain.id, marketKey, oppositeOutcome);

    const fillGrowth = await context.db.find(schema.fillGrowthState, { id: fgId });

    if (fillGrowth && fillGrowth.totalLiquidity > 0n) {
      const growthDelta = (rangeFilled * Q128) / fillGrowth.totalLiquidity;
      
      await context.db.update(schema.fillGrowthState, { id: fgId }).set({
        fillGrowthX128: fillGrowth.fillGrowthX128 + growthDelta,
        updatedAt: event.block.timestamp,
      });
    }
  }
});
