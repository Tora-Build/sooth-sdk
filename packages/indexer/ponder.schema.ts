import { onchainTable, index, primaryKey } from "@ponder/core";

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
    filledShares: t.bigint().notNull(),
    claimedShares: t.bigint().notNull(),
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
    marketOwnerIdx: index().on(table.marketKey, table.owner),
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
    marketOutcomeIdx: index().on(table.marketKey, table.outcome),
  })
);
