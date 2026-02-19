/// <reference types="ponder/virtual" />

import { and, eq } from "ponder";
import { ponder } from "ponder:registry";
import schema from "ponder:schema";

const eventId = (txHash: string, logIndex: number) => `${txHash}-${logIndex}`;

// ─── PositionTraded → UPSERT ammPosition + UPDATE market reserves ─────────────
// NOTE: LaunchpadEngine also emits PositionTraded for the same trade. See
// launchpad.ts for details on potential double-counting of deltaShares.

ponder.on("AMMEngine:PositionTraded", async ({ event, context }) => {
  const { user, market, outcome, deltaShares, newQYes, newQNo } = event.args;
  const positionId = `${context.chain.id}-${market}-${user}`;

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
      user,
      yesShares: outcome === 1 ? deltaShares : 0n,
      noShares: outcome === 0 ? deltaShares : 0n,
      updatedAt: event.block.timestamp,
    });
  }

  const existingMarket = await context.db.find(schema.launchpadMarket, { address: market });
  if (existingMarket) {
    await context.db.update(schema.launchpadMarket, { address: market }).set({
      yesReserves: newQYes,
      noReserves: newQNo,
    });
  }
});

// ─── ProceedsLocked → INSERT lockEntry ────────────────────────────────────────

ponder.on("AMMEngine:ProceedsLocked", async ({ event, context }) => {
  const { user, market, amount, unlockTime } = event.args;

  await context.db.insert(schema.lockEntry).values({
    id: eventId(event.transaction.hash, event.log.logIndex),
    chainId: context.chain.id,
    user,
    market,
    amountWad: amount,
    unlockTime: BigInt(unlockTime),
    claimed: false,
    createdAt: event.block.timestamp,
  });
});

// ─── ProceedsClaimed → UPDATE lockEntry.claimed ───────────────────────────────

ponder.on("AMMEngine:ProceedsClaimed", async ({ event, context }) => {
  const { user, market } = event.args;

  const unclaimed = await context.db.sql
    .select()
    .from(schema.lockEntry)
    .where(
      and(
        eq(schema.lockEntry.chainId, context.chain.id),
        eq(schema.lockEntry.user, user),
        eq(schema.lockEntry.market, market),
        eq(schema.lockEntry.claimed, false)
      )
    );

  for (const entry of unclaimed) {
    await context.db.update(schema.lockEntry, { id: entry.id }).set({
      claimed: true,
    });
  }
});

// ─── LockEntryRemoved → UPDATE lockEntry.claimed ─────────────────────────────

ponder.on("AMMEngine:LockEntryRemoved", async ({ event, context }) => {
  const { user, market, amount, unlockTime } = event.args;

  const matches = await context.db.sql
    .select()
    .from(schema.lockEntry)
    .where(
      and(
        eq(schema.lockEntry.chainId, context.chain.id),
        eq(schema.lockEntry.user, user),
        eq(schema.lockEntry.market, market),
        eq(schema.lockEntry.amountWad, amount),
        eq(schema.lockEntry.unlockTime, BigInt(unlockTime)),
        eq(schema.lockEntry.claimed, false)
      )
    );

  if (matches.length > 0) {
    await context.db.update(schema.lockEntry, { id: matches[0].id }).set({
      claimed: true,
    });
  }
});

// ─── LocksProcessed → batch UPDATE lockEntry ──────────────────────────────────

ponder.on("AMMEngine:LocksProcessed", async ({ event, context }) => {
  const { user, count } = event.args;

  const unclaimed = await context.db.sql
    .select()
    .from(schema.lockEntry)
    .where(
      and(
        eq(schema.lockEntry.chainId, context.chain.id),
        eq(schema.lockEntry.user, user),
        eq(schema.lockEntry.claimed, false)
      )
    )
    .limit(Number(count));

  for (const entry of unclaimed) {
    await context.db.update(schema.lockEntry, { id: entry.id }).set({
      claimed: true,
    });
  }
});

// ─── PositionSettled → UPDATE ammPosition (zero out shares) ───────────────────

ponder.on("AMMEngine:PositionSettled", async ({ event, context }) => {
  const { user, market, winningOutcome } = event.args;
  const positionId = `${context.chain.id}-${market}-${user}`;

  const existing = await context.db.find(schema.ammPosition, { id: positionId });
  if (existing) {
    await context.db.update(schema.ammPosition, { id: positionId }).set({
      yesShares: 0n,
      noShares: 0n,
      updatedAt: event.block.timestamp,
    });
  }

  const existingMarket = await context.db.find(schema.launchpadMarket, { address: market });
  if (existingMarket) {
    await context.db.update(schema.launchpadMarket, { address: market }).set({
      isSettled: true,
      winningOutcome,
    });
  }
});

// ─── Skipped events (no schema fields) ────────────────────────────────────────
// TODO: BalanceCredited(user, amount, newAvailableBalance, newLockedBalance)
// TODO: BalanceUsed(user, amount, newAvailableBalance)
// TODO: WalletPull(user, amount)
// TODO: LockedBalanceReduced(user, amount, newLockedBalance)
// TODO: RouterUpdated(router) — admin config, not user-facing
// TODO: LiquidityIncreased(market, deltaLiquidity, newLiquidity) — AMMEngine internal
