import { onchainTable, index } from "ponder";

export const launchpadMarket = onchainTable(
  "launchpad_market",
  (t) => ({
    address: t.hex().primaryKey(),
    chainId: t.integer().notNull(),
    creator: t.hex().notNull(),
    name: t.text(), // Market question (from TruthMarket.MarketCreated)
    symbol: t.text(), // Market symbol
    initialLiquidity: t.bigint().notNull(),
    deposit: t.bigint().notNull(),
    totalLPSupply: t.bigint().notNull(),
    isGraduated: t.boolean().notNull(),
    createdAt: t.bigint().notNull(),
    graduatedAt: t.bigint(),
    blockNumber: t.bigint().notNull(),
  }),
  (table) => ({
    creatorIdx: index().on(table.creator),
    chainIdx: index().on(table.chainId),
  })
);

export const vaultBalance = onchainTable(
  "vault_balance",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    user: t.hex().notNull(),
    availableUsdcWad: t.bigint().notNull(),
    reservedUsdcWad: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    userIdx: index().on(table.user),
    chainIdx: index().on(table.chainId),
  })
);

export const vaultPosition = onchainTable(
  "vault_position",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    market: t.hex().notNull(),
    user: t.hex().notNull(),
    yesSharesWad: t.bigint().notNull(),
    noSharesWad: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    userIdx: index().on(table.user),
    marketIdx: index().on(table.market),
  })
);

export const ammPosition = onchainTable(
  "amm_position",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    market: t.hex().notNull(),
    user: t.hex().notNull(),
    yesShares: t.bigint().notNull(),
    noShares: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    userIdx: index().on(table.user),
    marketIdx: index().on(table.market),
  })
);

export const lpBalance = onchainTable(
  "lp_balance",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    market: t.hex().notNull(),
    user: t.hex().notNull(),
    balance: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    userIdx: index().on(table.user),
    marketIdx: index().on(table.market),
  })
);

export const lockEntry = onchainTable(
  "lock_entry",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    user: t.hex().notNull(),
    market: t.hex().notNull(),
    amountWad: t.bigint().notNull(),
    unlockTime: t.bigint().notNull(),
    claimed: t.boolean().notNull(),
    createdAt: t.bigint().notNull(),
  }),
  (table) => ({
    userIdx: index().on(table.user),
  })
);

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
    // Fill growth snapshot at order creation (for accurate pending fill calculation)
    fillGrowthLastX128: t.bigint().notNull(),
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

/**
 * V10: Unified crossing events - spot-first + range crossing
 */
export const unifiedCrossing = onchainTable(
  "unified_crossing",
  (t) => ({
    id: t.text().primaryKey(), // txHash-logIndex
    chainId: t.integer().notNull(),
    marketKey: t.hex().notNull(),
    newOrderId: t.bigint().notNull(),
    newOutcome: t.integer().notNull(),
    spotFilled: t.bigint().notNull(),
    rangeFilled: t.bigint().notNull(),
    spotCost: t.bigint().notNull(),
    rangeCost: t.bigint().notNull(),
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
 * Fill growth state per market-outcome (replicates contract's fill growth accumulator)
 */
export const fillGrowthState = onchainTable(
  "fill_growth_state",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    marketKey: t.hex().notNull(),
    outcome: t.integer().notNull(),
    totalLiquidity: t.bigint().notNull(),
    fillGrowthX128: t.bigint().notNull(),
    updatedAt: t.bigint().notNull(),
  }),
  (table) => ({
    marketIdx: index().on(table.marketKey),
  })
);
