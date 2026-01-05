import { onchainTable, index } from "ponder";

/**
 * Markets registered in the TickBookPoolManager
 */
export const market = onchainTable("market", (t) => ({
  marketKey: t.hex().primaryKey(),
  chainId: t.integer().notNull(),
  contractAddress: t.hex().notNull(),
  yesToken: t.hex().notNull(),
  noToken: t.hex().notNull(),
  hook: t.hex(),
  createdAt: t.bigint().notNull(),
  blockNumber: t.bigint().notNull(),
}));

/**
 * Range orders placed by users
 */
export const order = onchainTable(
  "order",
  (t) => ({
    id: t.text().primaryKey(), // chainId-orderId
    chainId: t.integer().notNull(),
    orderId: t.bigint().notNull(),
    marketKey: t.hex().notNull(),
    owner: t.hex().notNull(),
    outcome: t.integer().notNull(), // 0 = NO, 1 = YES
    tickLower: t.integer().notNull(),
    tickUpper: t.integer().notNull(),
    liquidity: t.bigint().notNull(),
    collateralReserved: t.bigint().notNull(),
    crossingFilled: t.bigint().notNull(),
    crossingCost: t.bigint().notNull(),
    // Mutable state
    status: t.text().notNull(), // 'active' | 'cancelled' | 'filled'
    filledShares: t.bigint().notNull(),       // Total filled (from OrdersCrossed)
    claimedShares: t.bigint().notNull(),      // Already claimed
    pendingShares: t.bigint().notNull(),      // filledShares - claimedShares
    pendingUsdc: t.bigint().notNull(),        // USDC value of pending fills
    collateralUsed: t.bigint().notNull(),
    // Timestamps
    createdAt: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
  }),
  (table) => ({
    marketIdx: index().on(table.marketKey),
    ownerIdx: index().on(table.owner),
    statusIdx: index().on(table.status),
  })
);

/**
 * Fill claims - when users claim their filled shares
 */
export const fillClaim = onchainTable(
  "fill_claim",
  (t) => ({
    id: t.text().primaryKey(), // txHash-logIndex
    chainId: t.integer().notNull(),
    orderId: t.bigint().notNull(),
    marketKey: t.hex().notNull(),
    owner: t.hex().notNull(),
    filledShares: t.bigint().notNull(),
    collateralUsedWad: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    orderIdx: index().on(table.orderId),
    ownerIdx: index().on(table.owner),
    marketIdx: index().on(table.marketKey),
  })
);

/**
 * Market order executions (taker trades)
 */
export const marketOrder = onchainTable(
  "market_order",
  (t) => ({
    id: t.text().primaryKey(), // txHash-logIndex
    chainId: t.integer().notNull(),
    marketKey: t.hex().notNull(),
    taker: t.hex().notNull(),
    outcome: t.integer().notNull(),
    sharesRequested: t.bigint().notNull(),
    sharesFilled: t.bigint().notNull(),
    totalCost: t.bigint().notNull(),
    startTick: t.integer().notNull(),
    endTick: t.integer().notNull(),
    refunded: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    marketIdx: index().on(table.marketKey),
    takerIdx: index().on(table.taker),
  })
);

/**
 * Aggregated tick liquidity per market (for orderbook visualization)
 */
export const tickLiquidity = onchainTable(
  "tick_liquidity",
  (t) => ({
    id: t.text().primaryKey(), // chainId-marketKey-outcome-tick
    chainId: t.integer().notNull(),
    marketKey: t.hex().notNull(),
    outcome: t.integer().notNull(),
    tick: t.integer().notNull(),
    totalLiquidity: t.bigint().notNull(),
    orderCount: t.integer().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    marketOutcomeIdx: index().on(table.marketKey),
  })
);

/**
 * Orders crossed - when a new order crosses existing liquidity
 */
export const orderCrossed = onchainTable(
  "order_crossed",
  (t) => ({
    id: t.text().primaryKey(), // txHash-logIndex
    chainId: t.integer().notNull(),
    marketKey: t.hex().notNull(),
    newOrderId: t.bigint().notNull(),
    newOutcome: t.integer().notNull(),
    crossedShares: t.bigint().notNull(),
    newOrderCost: t.bigint().notNull(),
    oppositeOrderCost: t.bigint().notNull(),
    crossTick: t.integer().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    marketIdx: index().on(table.marketKey),
    orderIdx: index().on(table.newOrderId),
  })
);

/**
 * Tick crossed events - when market orders consume liquidity at a tick
 */
export const tickCrossed = onchainTable(
  "tick_crossed",
  (t) => ({
    id: t.text().primaryKey(), // txHash-logIndex
    chainId: t.integer().notNull(),
    marketKey: t.hex().notNull(),
    tick: t.integer().notNull(),
    liquidityDelta: t.bigint().notNull(), // Signed: positive = added, negative = removed
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    marketIdx: index().on(table.marketKey),
  })
);

/**
 * V9.9.7: Spot sell orders - users selling existing shares (not short sell)
 */
export const spotSellOrder = onchainTable(
  "spot_sell_order",
  (t) => ({
    id: t.text().primaryKey(), // chainId-sellId
    chainId: t.integer().notNull(),
    sellId: t.bigint().notNull(),
    marketKey: t.hex().notNull(),
    owner: t.hex().notNull(),
    outcome: t.integer().notNull(), // 0 = NO, 1 = YES
    tickLower: t.integer().notNull(),
    tickUpper: t.integer().notNull(),
    shares: t.bigint().notNull(),
    // Mutable state
    status: t.text().notNull(), // 'active' | 'cancelled' | 'filled'
    filledShares: t.bigint().notNull(),
    proceeds: t.bigint().notNull(), // USDC received from fills
    // Timestamps
    createdAt: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
  }),
  (table) => ({
    marketIdx: index().on(table.marketKey),
    ownerIdx: index().on(table.owner),
    statusIdx: index().on(table.status),
  })
);

/**
 * V9.9.7: Spot sell fills - when buyers purchase from spot sells
 */
export const spotSellFill = onchainTable(
  "spot_sell_fill",
  (t) => ({
    id: t.text().primaryKey(), // txHash-logIndex
    chainId: t.integer().notNull(),
    sellId: t.bigint().notNull(),
    marketKey: t.hex().notNull(),
    sharesFilled: t.bigint().notNull(),
    proceeds: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    sellIdx: index().on(table.sellId),
    marketIdx: index().on(table.marketKey),
  })
);
