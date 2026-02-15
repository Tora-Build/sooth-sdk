import { onchainTable, index } from "ponder";

export const launchpadMarket = onchainTable(
  "launchpad_market",
  (t) => ({
    address: t.hex().primaryKey(),
    chainId: t.integer().notNull(),
    creator: t.hex().notNull(),
    name: t.text(),
    symbol: t.text(),
    initialLiquidity: t.bigint().notNull(),
    deposit: t.bigint().notNull(),
    totalLPSupply: t.bigint().notNull(),
    isGraduated: t.boolean().notNull(),
    createdAt: t.bigint().notNull(),
    graduatedAt: t.bigint(),
    blockNumber: t.bigint().notNull(),
    lpToken: t.hex(),
    trialEndTime: t.bigint(),
    isDismissed: t.boolean(),
    deadline: t.bigint(),
    isSettled: t.boolean(),
    isFinalized: t.boolean(),
    winningOutcome: t.integer(),
    yesReserves: t.bigint(),
    noReserves: t.bigint(),
    yesProbability: t.real(),
  }),
  (table) => ({
    creatorIdx: index().on(table.creator),
    chainIdx: index().on(table.chainId),
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

export const trialState = onchainTable(
  "trial_state",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    market: t.hex().notNull(),
    trialEndTime: t.bigint().notNull(),
    isDismissed: t.boolean().notNull(),
    totalLockedCost: t.bigint().notNull(),
    dismissedAt: t.bigint(),
    blockNumber: t.bigint().notNull(),
  }),
  (table) => ({
    marketIdx: index().on(table.market),
    chainIdx: index().on(table.chainId),
  })
);

export const refundClaim = onchainTable(
  "refund_claim",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    market: t.hex().notNull(),
    user: t.hex().notNull(),
    amount: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    marketIdx: index().on(table.market),
    userIdx: index().on(table.user),
  })
);

export const marketVeto = onchainTable(
  "market_veto",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    market: t.hex().notNull(),
    previousOutcome: t.integer().notNull(),
    previousTStar: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    marketIdx: index().on(table.market),
  })
);

export const protocolState = onchainTable("protocol_state", (t) => ({
  id: t.text().primaryKey(),
  chainId: t.integer().notNull(),
  isPaused: t.boolean().notNull(),
  updatedAt: t.bigint().notNull(),
  blockNumber: t.bigint().notNull(),
}));

export const market = onchainTable("market", (t) => ({
  marketKey: t.hex().primaryKey(),
  chainId: t.integer().notNull(),
  collateral: t.hex().notNull(),
  yesToken: t.hex().notNull(),
  noToken: t.hex().notNull(),
  active: t.boolean().notNull(),
  finalized: t.boolean().notNull(),
  outcome: t.integer(),
  createdAt: t.bigint().notNull(),
  blockNumber: t.bigint().notNull(),
}));

export const order = onchainTable(
  "order",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    marketKey: t.hex().notNull(),
    side: t.integer().notNull(),
    tick: t.integer().notNull(),
    maker: t.hex().notNull(),
    amount: t.bigint().notNull(),
    escrow: t.boolean().notNull(),
    status: t.text().notNull(),
    filledAmount: t.bigint().notNull(),
    createdAt: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    marketIdx: index().on(table.marketKey),
    makerIdx: index().on(table.maker),
    statusIdx: index().on(table.status),
  })
);

export const fill = onchainTable(
  "fill",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    marketKey: t.hex().notNull(),
    takerSide: t.integer().notNull(),
    yesTick: t.integer().notNull(),
    noTick: t.integer().notNull(),
    taker: t.hex().notNull(),
    maker: t.hex().notNull(),
    amount: t.bigint().notNull(),
    surplus: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    marketIdx: index().on(table.marketKey),
    takerIdx: index().on(table.taker),
    makerIdx: index().on(table.maker),
  })
);

export const mintMerge = onchainTable(
  "mint_merge",
  (t) => ({
    id: t.text().primaryKey(),
    chainId: t.integer().notNull(),
    marketKey: t.hex().notNull(),
    user: t.hex().notNull(),
    action: t.text().notNull(),
    amount: t.bigint().notNull(),
    timestamp: t.bigint().notNull(),
    blockNumber: t.bigint().notNull(),
    txHash: t.hex().notNull(),
  }),
  (table) => ({
    marketIdx: index().on(table.marketKey),
    userIdx: index().on(table.user),
  })
);
