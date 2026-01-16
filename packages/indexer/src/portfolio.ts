import { ponder } from "ponder:registry";
import schema from "ponder:schema";

const vaultBalanceId = (chainId: number, user: string) => `${chainId}-${user.toLowerCase()}`;
const vaultPositionId = (chainId: number, market: string, user: string) =>
  `${chainId}-${market.toLowerCase()}-${user.toLowerCase()}`;
const ammPositionId = (chainId: number, market: string, user: string) =>
  `${chainId}-${market.toLowerCase()}-${user.toLowerCase()}`;
const lpBalanceId = (chainId: number, market: string, user: string) =>
  `${chainId}-${market.toLowerCase()}-${user.toLowerCase()}`;
const lockEntryId = (chainId: number, user: string, unlockTime: bigint) =>
  `${chainId}-${user.toLowerCase()}-${unlockTime.toString()}`;

ponder.on("LaunchpadEngine:MarketCreated", async ({ event, context }) => {
  const { market, creator, initialLiquidity, deposit, lpTokens, symbol } = event.args;

  await context.db.insert(schema.launchpadMarket).values({
    address: market,
    chainId: context.chain.id,
    creator,
    name: null,
    symbol,
    initialLiquidity,
    deposit,
    totalLPSupply: lpTokens,
    isGraduated: false,
    createdAt: event.block.timestamp,
    graduatedAt: null,
    blockNumber: event.block.number,
  });

  const id = lpBalanceId(context.chain.id, market, creator);
  await context.db.insert(schema.lpBalance).values({
    id,
    chainId: context.chain.id,
    market,
    user: creator,
    balance: lpTokens,
    updatedAt: event.block.timestamp,
  });
});

ponder.on("LaunchpadEngine:MarketGraduated", async ({ event, context }) => {
  const { market, timestamp } = event.args;

  await context.db.update(schema.launchpadMarket, { address: market }).set({
    isGraduated: true,
    graduatedAt: timestamp,
  });
});

ponder.on("LaunchpadEngine:PositionTraded", async ({ event, context }) => {
  const { trader, market, outcome, deltaShares } = event.args;

  const id = ammPositionId(context.chain.id, market, trader);
  const existing = await context.db.find(schema.ammPosition, { id });

  if (existing) {
    const newYes = outcome === 1
      ? existing.yesShares + deltaShares
      : existing.yesShares;
    const newNo = outcome === 0
      ? existing.noShares + deltaShares
      : existing.noShares;

    await context.db.update(schema.ammPosition, { id }).set({
      yesShares: newYes > 0n ? newYes : 0n,
      noShares: newNo > 0n ? newNo : 0n,
      updatedAt: event.block.timestamp,
    });
  } else {
    await context.db.insert(schema.ammPosition).values({
      id,
      chainId: context.chain.id,
      market,
      user: trader,
      yesShares: outcome === 1 ? (deltaShares > 0n ? deltaShares : 0n) : 0n,
      noShares: outcome === 0 ? (deltaShares > 0n ? deltaShares : 0n) : 0n,
      updatedAt: event.block.timestamp,
    });
  }
});

ponder.on("LaunchpadEngine:LPRedeemed", async ({ event, context }) => {
  const { user, market, lpAmount } = event.args;

  const id = lpBalanceId(context.chain.id, market, user);
  const existing = await context.db.find(schema.lpBalance, { id });

  if (existing) {
    const newBalance = existing.balance > lpAmount ? existing.balance - lpAmount : 0n;
    await context.db.update(schema.lpBalance, { id }).set({
      balance: newBalance,
      updatedAt: event.block.timestamp,
    });
  }

  const marketData = await context.db.find(schema.launchpadMarket, { address: market });
  if (marketData) {
    const newSupply = marketData.totalLPSupply > lpAmount
      ? marketData.totalLPSupply - lpAmount
      : 0n;
    await context.db.update(schema.launchpadMarket, { address: market }).set({
      totalLPSupply: newSupply,
    });
  }
});

ponder.on("LaunchpadEngine:LiquidityIncreased", async ({ event, context }) => {
  const { market, creator, lpTokens } = event.args;

  const id = lpBalanceId(context.chain.id, market, creator);
  await context.db
    .insert(schema.lpBalance)
    .values({
      id,
      chainId: context.chain.id,
      market,
      user: creator,
      balance: lpTokens,
      updatedAt: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      balance: row.balance + lpTokens,
      updatedAt: event.block.timestamp,
    }));

  const marketData = await context.db.find(schema.launchpadMarket, { address: market });
  if (marketData) {
    await context.db.update(schema.launchpadMarket, { address: market }).set({
      totalLPSupply: marketData.totalLPSupply + lpTokens,
    });
  }
});

ponder.on("LaunchpadEngine:FeeDistributedPreGrad", async ({ event, context }) => {
  const { market, lpTokensMinted, trader } = event.args;

  if (lpTokensMinted > 0n) {
    const id = lpBalanceId(context.chain.id, market, trader);
    await context.db
      .insert(schema.lpBalance)
      .values({
        id,
        chainId: context.chain.id,
        market,
        user: trader,
        balance: lpTokensMinted,
        updatedAt: event.block.timestamp,
      })
      .onConflictDoUpdate((row) => ({
        balance: row.balance + lpTokensMinted,
        updatedAt: event.block.timestamp,
      }));

    const marketData = await context.db.find(schema.launchpadMarket, { address: market });
    if (marketData) {
      await context.db.update(schema.launchpadMarket, { address: market }).set({
        totalLPSupply: marketData.totalLPSupply + lpTokensMinted,
      });
    }
  }
});

ponder.on("TickBookVault:UsdcDeposited", async ({ event, context }) => {
  const { user, usdcAmountWad } = event.args;

  const id = vaultBalanceId(context.chain.id, user);
  await context.db
    .insert(schema.vaultBalance)
    .values({
      id,
      chainId: context.chain.id,
      user,
      availableUsdcWad: usdcAmountWad,
      reservedUsdcWad: 0n,
      updatedAt: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      availableUsdcWad: row.availableUsdcWad + usdcAmountWad,
      updatedAt: event.block.timestamp,
    }));
});

ponder.on("TickBookVault:UsdcWithdrawn", async ({ event, context }) => {
  const { user, usdcAmountWad } = event.args;

  const id = vaultBalanceId(context.chain.id, user);
  const existing = await context.db.find(schema.vaultBalance, { id });

  if (existing) {
    const newAvailable = existing.availableUsdcWad > usdcAmountWad
      ? existing.availableUsdcWad - usdcAmountWad
      : 0n;
    await context.db.update(schema.vaultBalance, { id }).set({
      availableUsdcWad: newAvailable,
      updatedAt: event.block.timestamp,
    });
  }
});

ponder.on("TickBookVault:UsdcReserved", async ({ event, context }) => {
  const { user, amountWad } = event.args;

  const id = vaultBalanceId(context.chain.id, user);
  const existing = await context.db.find(schema.vaultBalance, { id });

  if (existing) {
    const newAvailable = existing.availableUsdcWad > amountWad
      ? existing.availableUsdcWad - amountWad
      : 0n;
    await context.db.update(schema.vaultBalance, { id }).set({
      availableUsdcWad: newAvailable,
      reservedUsdcWad: existing.reservedUsdcWad + amountWad,
      updatedAt: event.block.timestamp,
    });
  }
});

ponder.on("TickBookVault:UsdcReleased", async ({ event, context }) => {
  const { user, amountWad } = event.args;

  const id = vaultBalanceId(context.chain.id, user);
  const existing = await context.db.find(schema.vaultBalance, { id });

  if (existing) {
    const newReserved = existing.reservedUsdcWad > amountWad
      ? existing.reservedUsdcWad - amountWad
      : 0n;
    await context.db.update(schema.vaultBalance, { id }).set({
      availableUsdcWad: existing.availableUsdcWad + amountWad,
      reservedUsdcWad: newReserved,
      updatedAt: event.block.timestamp,
    });
  }
});

ponder.on("TickBookVault:UsdcSpentToMarket", async ({ event, context }) => {
  const { user, amountWad } = event.args;

  const id = vaultBalanceId(context.chain.id, user);
  const existing = await context.db.find(schema.vaultBalance, { id });

  if (existing) {
    const newReserved = existing.reservedUsdcWad > amountWad
      ? existing.reservedUsdcWad - amountWad
      : 0n;
    await context.db.update(schema.vaultBalance, { id }).set({
      reservedUsdcWad: newReserved,
      updatedAt: event.block.timestamp,
    });
  }
});

ponder.on("TickBookVault:UsdcSpentFromAvailable", async ({ event, context }) => {
  const { user, amountWad } = event.args;

  const id = vaultBalanceId(context.chain.id, user);
  const existing = await context.db.find(schema.vaultBalance, { id });

  if (existing) {
    const newAvailable = existing.availableUsdcWad > amountWad
      ? existing.availableUsdcWad - amountWad
      : 0n;
    await context.db.update(schema.vaultBalance, { id }).set({
      availableUsdcWad: newAvailable,
      updatedAt: event.block.timestamp,
    });
  }
});

ponder.on("TickBookVault:UsdcCredited", async ({ event, context }) => {
  const { user, amountWad } = event.args;

  const id = vaultBalanceId(context.chain.id, user);
  await context.db
    .insert(schema.vaultBalance)
    .values({
      id,
      chainId: context.chain.id,
      user,
      availableUsdcWad: amountWad,
      reservedUsdcWad: 0n,
      updatedAt: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      availableUsdcWad: row.availableUsdcWad + amountWad,
      updatedAt: event.block.timestamp,
    }));
});

ponder.on("TickBookVault:OutcomeCredited", async ({ event, context }) => {
  const { market, user, outcome, sharesWad } = event.args;

  const id = vaultPositionId(context.chain.id, market, user);
  const existing = await context.db.find(schema.vaultPosition, { id });

  if (existing) {
    await context.db.update(schema.vaultPosition, { id }).set({
      yesSharesWad: outcome === 1 ? existing.yesSharesWad + sharesWad : existing.yesSharesWad,
      noSharesWad: outcome === 0 ? existing.noSharesWad + sharesWad : existing.noSharesWad,
      updatedAt: event.block.timestamp,
    });
  } else {
    await context.db.insert(schema.vaultPosition).values({
      id,
      chainId: context.chain.id,
      market,
      user,
      yesSharesWad: outcome === 1 ? sharesWad : 0n,
      noSharesWad: outcome === 0 ? sharesWad : 0n,
      updatedAt: event.block.timestamp,
    });
  }
});

ponder.on("TickBookVault:OutcomeLocked", async ({ event, context }) => {
  const { market, user, outcome, sharesWad } = event.args;

  const id = vaultPositionId(context.chain.id, market, user);
  const existing = await context.db.find(schema.vaultPosition, { id });

  if (existing) {
    await context.db.update(schema.vaultPosition, { id }).set({
      yesSharesWad: outcome === 1
        ? (existing.yesSharesWad > sharesWad ? existing.yesSharesWad - sharesWad : 0n)
        : existing.yesSharesWad,
      noSharesWad: outcome === 0
        ? (existing.noSharesWad > sharesWad ? existing.noSharesWad - sharesWad : 0n)
        : existing.noSharesWad,
      updatedAt: event.block.timestamp,
    });
  }
});

ponder.on("TickBookVault:OutcomeUnlocked", async ({ event, context }) => {
  const { market, user, outcome, sharesWad } = event.args;

  const id = vaultPositionId(context.chain.id, market, user);
  const existing = await context.db.find(schema.vaultPosition, { id });

  if (existing) {
    await context.db.update(schema.vaultPosition, { id }).set({
      yesSharesWad: outcome === 1 ? existing.yesSharesWad + sharesWad : existing.yesSharesWad,
      noSharesWad: outcome === 0 ? existing.noSharesWad + sharesWad : existing.noSharesWad,
      updatedAt: event.block.timestamp,
    });
  }
});

ponder.on("TickBookVault:OutcomeTransferred", async ({ event, context }) => {
  const { market, from, to, outcome, sharesWad } = event.args;

  const fromId = vaultPositionId(context.chain.id, market, from);
  const fromExisting = await context.db.find(schema.vaultPosition, { id: fromId });

  if (fromExisting) {
    await context.db.update(schema.vaultPosition, { id: fromId }).set({
      yesSharesWad: outcome === 1
        ? (fromExisting.yesSharesWad > sharesWad ? fromExisting.yesSharesWad - sharesWad : 0n)
        : fromExisting.yesSharesWad,
      noSharesWad: outcome === 0
        ? (fromExisting.noSharesWad > sharesWad ? fromExisting.noSharesWad - sharesWad : 0n)
        : fromExisting.noSharesWad,
      updatedAt: event.block.timestamp,
    });
  }

  const toId = vaultPositionId(context.chain.id, market, to);
  await context.db
    .insert(schema.vaultPosition)
    .values({
      id: toId,
      chainId: context.chain.id,
      market,
      user: to,
      yesSharesWad: outcome === 1 ? sharesWad : 0n,
      noSharesWad: outcome === 0 ? sharesWad : 0n,
      updatedAt: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      yesSharesWad: outcome === 1 ? row.yesSharesWad + sharesWad : row.yesSharesWad,
      noSharesWad: outcome === 0 ? row.noSharesWad + sharesWad : row.noSharesWad,
      updatedAt: event.block.timestamp,
    }));
});

ponder.on("TickBookVault:RedeemedResolved", async ({ event, context }) => {
  const { market, user } = event.args;

  const id = vaultPositionId(context.chain.id, market, user);
  await context.db.update(schema.vaultPosition, { id }).set({
    yesSharesWad: 0n,
    noSharesWad: 0n,
    updatedAt: event.block.timestamp,
  });
});

ponder.on("AMMEngine:PositionTraded", async ({ event, context }) => {
  const { user, market, outcome, deltaShares } = event.args;

  const id = ammPositionId(context.chain.id, market, user);
  const existing = await context.db.find(schema.ammPosition, { id });

  if (existing) {
    const newYes = outcome === 1
      ? existing.yesShares + deltaShares
      : existing.yesShares;
    const newNo = outcome === 0
      ? existing.noShares + deltaShares
      : existing.noShares;

    await context.db.update(schema.ammPosition, { id }).set({
      yesShares: newYes > 0n ? newYes : 0n,
      noShares: newNo > 0n ? newNo : 0n,
      updatedAt: event.block.timestamp,
    });
  } else {
    await context.db.insert(schema.ammPosition).values({
      id,
      chainId: context.chain.id,
      market,
      user,
      yesShares: outcome === 1 ? (deltaShares > 0n ? deltaShares : 0n) : 0n,
      noShares: outcome === 0 ? (deltaShares > 0n ? deltaShares : 0n) : 0n,
      updatedAt: event.block.timestamp,
    });
  }
});

ponder.on("AMMEngine:ProceedsLocked", async ({ event, context }) => {
  const { user, market, amount, unlockTime } = event.args;

  const id = lockEntryId(context.chain.id, user, unlockTime);
  await context.db.insert(schema.lockEntry).values({
    id,
    chainId: context.chain.id,
    user,
    market,
    amountWad: amount,
    unlockTime,
    claimed: false,
    createdAt: event.block.timestamp,
  });
});

ponder.on("AMMEngine:ProceedsClaimed", async ({ event, context }) => {
  const { user, amount } = event.args;

  const id = vaultBalanceId(context.chain.id, user);
  await context.db
    .insert(schema.vaultBalance)
    .values({
      id,
      chainId: context.chain.id,
      user,
      availableUsdcWad: amount,
      reservedUsdcWad: 0n,
      updatedAt: event.block.timestamp,
    })
    .onConflictDoUpdate((row) => ({
      availableUsdcWad: row.availableUsdcWad + amount,
      updatedAt: event.block.timestamp,
    }));
});

ponder.on("AMMEngine:PositionSettled", async ({ event, context }) => {
  const { user, market } = event.args;

  const id = ammPositionId(context.chain.id, market, user);
  await context.db.update(schema.ammPosition, { id }).set({
    yesShares: 0n,
    noShares: 0n,
    updatedAt: event.block.timestamp,
  });
});
