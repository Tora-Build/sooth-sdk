/// <reference types="ponder/virtual" />

import { and, asc, eq } from "ponder";
import { ponder } from "ponder:registry";
import schema from "ponder:schema";

const eventId = (txHash: string, logIndex: number) => `${txHash}-${logIndex}`;

// ─── MarketCreated → INSERT launchpadMarket ───────────────────────────────────

ponder.on("LaunchpadEngine:MarketCreated", async ({ event, context }) => {
  const { market, creator, initialLiquidity, deposit, lpTokens } = event.args;

  await context.db
    .insert(schema.launchpadMarket)
    .values({
      address: market,
      chainId: context.chain.id,
      creator,
      initialLiquidity,
      deposit,
      totalLPSupply: lpTokens,
      isGraduated: false,
      createdAt: event.block.timestamp,
      blockNumber: event.block.number,
    })
    .onConflictDoNothing();
});

// ─── MarketGraduated → UPDATE launchpadMarket ─────────────────────────────────

ponder.on("LaunchpadEngine:MarketGraduated", async ({ event, context }) => {
  const { market, timestamp } = event.args;

  const existing = await context.db.find(schema.launchpadMarket, { address: market });
  if (!existing) return;

  await context.db.update(schema.launchpadMarket, { address: market }).set({
    isGraduated: true,
    graduatedAt: timestamp,
  });
});

// ─── PositionTraded → UPSERT ammPosition ──────────────────────────────────────
// NOTE: AMMEngine also emits PositionTraded for the same trade (regular call,
// not delegatecall). If both handlers fire for the same trade, shares will be
// double-counted. AMMEngine handler also updates market reserves (yesReserves/
// noReserves) which this handler does not. Consider disabling one if both
// contracts emit for the same trade path.

ponder.on("LaunchpadEngine:PositionTraded", async ({ event, context }) => {
  const { trader, market, outcome, deltaShares } = event.args;
  const positionId = `${context.chain.id}-${market}-${trader}`;

  const existing = await context.db.find(schema.ammPosition, { id: positionId });

  if (existing) {
    await context.db.update(schema.ammPosition, { id: positionId }).set({
      yesShares: outcome === 1 ? existing.yesShares + deltaShares : existing.yesShares,
      noShares: outcome === 0 ? existing.noShares + deltaShares : existing.noShares,
      updatedAt: event.block.timestamp,
    });
  } else {
    await context.db.insert(schema.ammPosition).values({
      id: positionId,
      chainId: context.chain.id,
      market,
      user: trader,
      yesShares: outcome === 1 ? deltaShares : 0n,
      noShares: outcome === 0 ? deltaShares : 0n,
      updatedAt: event.block.timestamp,
    });
  }
});

// ─── LPBalanceUpdated → UPSERT lpBalance + UPDATE totalLPSupply ───────────────

ponder.on("LaunchpadEngine:LPBalanceUpdated", async ({ event, context }) => {
  const { market, user, newBalance, totalSupply } = event.args;
  const balanceId = `${context.chain.id}-${market}-${user}`;

  const existing = await context.db.find(schema.lpBalance, { id: balanceId });

  if (existing) {
    await context.db.update(schema.lpBalance, { id: balanceId }).set({
      balance: newBalance,
      updatedAt: event.block.timestamp,
    });
  } else {
    await context.db.insert(schema.lpBalance).values({
      id: balanceId,
      chainId: context.chain.id,
      market,
      user,
      balance: newBalance,
      updatedAt: event.block.timestamp,
    });
  }

  // Also update market totalLPSupply (authoritative source via totalSupply)
  const existingMarket = await context.db.find(schema.launchpadMarket, { address: market });
  if (existingMarket) {
    await context.db.update(schema.launchpadMarket, { address: market }).set({
      totalLPSupply: totalSupply,
    });
  }
});

// ─── LPTokenCreated → UPDATE launchpadMarket.lpToken ──────────────────────────

ponder.on("LaunchpadEngine:LPTokenCreated", async ({ event, context }) => {
  const { market, lpToken } = event.args;

  const existing = await context.db.find(schema.launchpadMarket, { address: market });
  if (!existing) return;

  await context.db.update(schema.launchpadMarket, { address: market }).set({
    lpToken,
  });
});

// ─── GraduationProgressUpdated → TODO: no direct schema field ─────────────────
// Event args: (market, feesAccruedWad, thresholdWad)
// TODO: Add graduationProgress / graduationThreshold fields to launchpadMarket
// schema to track graduation progress percentage.

ponder.on("LaunchpadEngine:GraduationProgressUpdated", async ({ event, context }) => {
  // No-op: schema lacks graduation progress fields.
  // To surface this data, add feesAccruedWad / thresholdWad columns to
  // launchpadMarket and uncomment below:
  //
  // const { market, feesAccruedWad, thresholdWad } = event.args;
  // const existing = await context.db.find(schema.launchpadMarket, { address: market });
  // if (!existing) return;
  // await context.db.update(schema.launchpadMarket, { address: market }).set({
  //   feesAccruedWad,
  //   thresholdWad,
  // });
});

// ─── MarketDismissed → UPDATE launchpadMarket.isDismissed ─────────────────────

ponder.on("LaunchpadEngine:MarketDismissed", async ({ event, context }) => {
  const { market } = event.args;

  const existing = await context.db.find(schema.launchpadMarket, { address: market });
  if (!existing) return;

  await context.db.update(schema.launchpadMarket, { address: market }).set({
    isDismissed: true,
  });
});

// ─── RefundClaimed → INSERT refundClaim ───────────────────────────────────────

ponder.on("LaunchpadEngine:RefundClaimed", async ({ event, context }) => {
  const { market, user, amount } = event.args;

  await context.db.insert(schema.refundClaim).values({
    id: eventId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    market,
    user,
    amount,
    timestamp: event.block.timestamp,
    blockNumber: event.block.number,
    txHash: event.transaction.hash,
  });
});

// ─── LiquidityIncreased → UPDATE launchpadMarket.totalLPSupply (delta) ────────

ponder.on("LaunchpadEngine:LiquidityIncreased", async ({ event, context }) => {
  const { market, lpTokens } = event.args;

  const existing = await context.db.find(schema.launchpadMarket, { address: market });
  if (!existing) return;

  // Delta-based update; LPBalanceUpdated (if emitted in same tx) will set
  // authoritative totalSupply and overwrite this value.
  await context.db.update(schema.launchpadMarket, { address: market }).set({
    totalLPSupply: existing.totalLPSupply + lpTokens,
  });
});

// ─── FeeDistributedPreGrad → log-only ─────────────────────────────────────────
// Event args: (market, totalFee, toBBase, lpTokensMinted, trader)
// TODO: Add fee tracking fields to schema if pre-grad fee breakdown is needed.

ponder.on("LaunchpadEngine:FeeDistributedPreGrad", async ({ event, context }) => {
  // No-op: schema lacks fee distribution fields.
  // lpTokensMinted could update totalLPSupply, but LPBalanceUpdated is the
  // authoritative source for that field.
});

// ─── FeeDistributedPostGrad → log-only ────────────────────────────────────────
// Event args: (market, totalFee, toBBase, toLPYield, toProtocol)
// TODO: Add post-graduation fee fields to schema if fee breakdown is needed.

ponder.on("LaunchpadEngine:FeeDistributedPostGrad", async ({ event, context }) => {
  // No-op: schema lacks fee distribution fields.
});

// ─── LPRedeemed → UPDATE lpBalance ────────────────────────────────────────────
// Note: LPBalanceUpdated is the authoritative source for balance. This handler
// provides a safety-net update when LPBalanceUpdated doesn't fire.

ponder.on("LaunchpadEngine:LPRedeemed", async ({ event, context }) => {
  const { user, market, lpAmount } = event.args;
  const balanceId = `${context.chain.id}-${market}-${user}`;

  const existing = await context.db.find(schema.lpBalance, { id: balanceId });
  if (!existing) return;

  await context.db.update(schema.lpBalance, { id: balanceId }).set({
    balance: existing.balance - lpAmount,
    updatedAt: event.block.timestamp,
  });
});

// ─── Skipped events (no schema fields) ────────────────────────────────────────
// TODO: FeesAccrued(market, amountUsdc, totalAccrued) — add fee tracking columns
// TODO: BaseLiquidityIncreased(market, amountWad, newBBase, newBCurrent) — add bBase/bCurrent columns
// TODO: LPYieldPoolUpdated(market, amountUsdc, newTotal) — add lpYieldPool column

ponder.on("LaunchpadEngine:FeesAccrued", async () => {
  // No-op: schema lacks fee accrual fields.
});

ponder.on("LaunchpadEngine:BaseLiquidityIncreased", async () => {
  // No-op: schema lacks bBase / bCurrent fields.
});

ponder.on("LaunchpadEngine:LPYieldPoolUpdated", async () => {
  // No-op: schema lacks LP yield pool fields.
});
