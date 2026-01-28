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
 * Handle RangeOrderPlaced events (V10 - may exist on older deployments)
 * Maps to same schema as OrderPlaced with field name translation
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
  const fgId = fillGrowthId(context.chain.id, marketKey, outcome);

  const fillGrowth = await context.db.find(schema.fillGrowthState, { id: fgId });
  const currentFillGrowthX128 = fillGrowth?.fillGrowthX128 ?? 0n;

  const restingShares = liquidity > crossingFilled ? liquidity - crossingFilled : 0n;

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
    status: restingShares > 0n ? "active" : "filled",
    filledShares: crossingFilled,
    claimedShares: 0n,
    pendingShares: crossingFilled,
    pendingUsdc: crossingCost,
    collateralUsed: crossingCost,
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
 * Handle OrderPlaced events (current primary event)
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

ponder.on("TickBookPoolManager:RangeOrderClosed", async ({ event, context }) => {
  const { orderId: orderIdBigInt } = event.args;

  const id = orderId(context.chain.id, orderIdBigInt);

  const existingOrder = await context.db.find(schema.order, { id });
  if (!existingOrder) return;

  const wasActive = existingOrder.status === "active";
  const unfilledShares = existingOrder.liquidity - existingOrder.crossingFilled - existingOrder.claimedShares;

  await context.db.update(schema.order, { id }).set({
    status: "closed",
    pendingShares: 0n,
    pendingUsdc: 0n,
    updatedAt: event.block.timestamp,
  });

  if (wasActive) {
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

// NOTE: MarketOrderFilled event removed from contract - market orders now tracked via UnifiedCrossing
// If market order tracking is needed, use the UnifiedCrossing handler which includes crossing data

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

ponder.on("TickBookPoolManager:SpotSellClosed", async ({ event, context }) => {
  const { sellId: sellIdBigInt } = event.args;

  const id = sellId(context.chain.id, sellIdBigInt);

  const existingOrder = await context.db.find(schema.spotSellOrder, { id });

  if (existingOrder) {
    await context.db.update(schema.spotSellOrder, { id }).set({
      status: "closed",
      filledShares: existingOrder.shares,
      updatedAt: event.block.timestamp,
    });

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

// ============================================
// V11: LaunchpadEngine Event Handlers
// ============================================

// Default trial period (7 days in seconds)
const DEFAULT_TRIAL_PERIOD = 7n * 24n * 60n * 60n;

/**
 * Handle MarketCreated events (LaunchpadEngine)
 * Initialize launchpadMarket and trialState records
 */
ponder.on("LaunchpadEngine:MarketCreated", async ({ event, context }) => {
  const { market, creator, initialLiquidity, deposit, lpTokens } = event.args;

  const trialEndTime = event.block.timestamp + DEFAULT_TRIAL_PERIOD;

  // Symbol is derived from market address (first 4 bytes = 8 hex chars)
  const derivedSymbol = market.slice(2, 10).toUpperCase();

  // Create launchpad market record
  await context.db
    .insert(schema.launchpadMarket)
    .values({
      address: market,
      chainId: context.chain.id,
      creator,
      name: null,
      symbol: derivedSymbol,
      initialLiquidity,
      deposit,
      totalLPSupply: lpTokens,
      isGraduated: false,
      createdAt: event.block.timestamp,
      graduatedAt: null,
      blockNumber: event.block.number,
      lpToken: null, // Will be set by LPTokenCreated event
      trialEndTime,
      isDismissed: false,
    })
    .onConflictDoNothing();

  // Create trial state record
  const trialId = market.toLowerCase();
  await context.db
    .insert(schema.trialState)
    .values({
      id: trialId,
      chainId: context.chain.id,
      market,
      trialEndTime,
      isDismissed: false,
      totalLockedCost: 0n,
      dismissedAt: null,
      blockNumber: event.block.number,
    })
    .onConflictDoNothing();

  // Create LP balance for creator
  const lpBalanceId = `${context.chain.id}-${market.toLowerCase()}-${creator.toLowerCase()}`;
  await context.db.insert(schema.lpBalance).values({
    id: lpBalanceId,
    chainId: context.chain.id,
    market,
    user: creator,
    balance: lpTokens,
    updatedAt: event.block.timestamp,
  }).onConflictDoNothing();
});

/**
 * Handle MarketGraduated events
 * Update launchpadMarket graduation status
 */
ponder.on("LaunchpadEngine:MarketGraduated", async ({ event, context }) => {
  const { market, timestamp } = event.args;

  const existingMarket = await context.db.find(schema.launchpadMarket, { address: market });
  if (existingMarket) {
    await context.db.update(schema.launchpadMarket, { address: market }).set({
      isGraduated: true,
      graduatedAt: timestamp,
    });
  }
});

/**
 * Handle PositionTraded events
 * - Update trial state locked costs for buys during trial period
 * - Update AMM positions (yesShares/noShares)
 */
ponder.on("LaunchpadEngine:PositionTraded", async ({ event, context }) => {
  const { trader, market, outcome, deltaShares, cost } = event.args;

  // 1. Update AMM position
  const ammPositionId = `${context.chain.id}-${market.toLowerCase()}-${trader.toLowerCase()}`;
  const existingPosition = await context.db.find(schema.ammPosition, { id: ammPositionId });

  if (existingPosition) {
    const newYes = outcome === 1
      ? existingPosition.yesShares + deltaShares
      : existingPosition.yesShares;
    const newNo = outcome === 0
      ? existingPosition.noShares + deltaShares
      : existingPosition.noShares;

    await context.db.update(schema.ammPosition, { id: ammPositionId }).set({
      yesShares: newYes > 0n ? newYes : 0n,
      noShares: newNo > 0n ? newNo : 0n,
      updatedAt: event.block.timestamp,
    });
  } else {
    await context.db.insert(schema.ammPosition).values({
      id: ammPositionId,
      chainId: context.chain.id,
      market,
      user: trader,
      yesShares: outcome === 1 ? (deltaShares > 0n ? deltaShares : 0n) : 0n,
      noShares: outcome === 0 ? (deltaShares > 0n ? deltaShares : 0n) : 0n,
      updatedAt: event.block.timestamp,
    });
  }

  // 2. Update trial state locked costs (only for buys during trial)
  if (deltaShares <= 0n) return;

  const trialId = market.toLowerCase();
  const trialState = await context.db.find(schema.trialState, { id: trialId });

  if (!trialState) return;

  // Check if still in trial period and not dismissed
  if (event.block.timestamp >= trialState.trialEndTime || trialState.isDismissed) return;

  // Update total locked cost
  await context.db.update(schema.trialState, { id: trialId }).set({
    totalLockedCost: trialState.totalLockedCost + cost,
  });
});

/**
 * Handle MarketDismissed events - when a market is dismissed during trial period
 */
ponder.on("LaunchpadEngine:MarketDismissed", async ({ event, context }) => {
  const { market, timestamp } = event.args;

  const id = market.toLowerCase();

  // Update trial state
  const trialState = await context.db.find(schema.trialState, { id });
  if (trialState) {
    await context.db.update(schema.trialState, { id }).set({
      isDismissed: true,
      dismissedAt: timestamp,
    });
  }

  // Update launchpad market
  const existingMarket = await context.db.find(schema.launchpadMarket, { address: market });
  if (existingMarket) {
    await context.db.update(schema.launchpadMarket, { address: market }).set({
      isDismissed: true,
    });
  }
});

/**
 * Handle RefundClaimed events - when a user claims a refund after market dismissal
 */
ponder.on("LaunchpadEngine:RefundClaimed", async ({ event, context }) => {
  const { market, user, amount } = event.args;

  const id = eventId(event.transaction.hash, event.log.logIndex);

  await context.db.insert(schema.refundClaim).values({
    id,
    chainId: context.chain.id,
    market,
    user,
    amount,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});

/**
 * Handle LPTokenCreated events - when an ERC20 LP token is created for a market
 */
ponder.on("LaunchpadEngine:LPTokenCreated", async ({ event, context }) => {
  const { market, lpToken } = event.args;

  const existingMarket = await context.db.find(schema.launchpadMarket, { address: market });
  if (existingMarket) {
    await context.db.update(schema.launchpadMarket, { address: market }).set({
      lpToken,
    });
  }
});
