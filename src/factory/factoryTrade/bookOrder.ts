/**
 * Order-book arithmetic for a Factory node's OrderEngine, kept pure so the
 * ticket's numbers can be tested without a chain. Copied from
 * apps/east/src/factory/bookOrder.ts (same release, same contract maths);
 * shared package after the milestone.
 *
 * Prices are thousandths ("ticks") of one unit of collateral, 1 to 999, and
 * are always quoted for the outcome being traded: BUY NO at 600 pays 0.6 per
 * NO share and is the same book level as SELL YES at 400.
 */

export const BOOK_BUY = 0;
export const BOOK_SELL = 1;
export const BOOK_SIDE_BID = 0;
export const BOOK_SIDE_ASK = 1;
const NUM_TICKS = 1_000n;

export type BookAction = typeof BOOK_BUY | typeof BOOK_SELL;

/** A price typed in cents (one decimal allowed) as a tick, or null. */
export function centsToTick(cents: string): number | null {
  if (!/^\d{1,2}(\.\d)?$/.test(cents.trim())) return null;
  const tick = Math.round(Number(cents) * 10);
  return tick >= 1 && tick <= 999 ? tick : null;
}

export function tickToCents(tick: number): string {
  return `${Math.floor(tick / 10)}.${tick % 10}¢`;
}

/** The YES-axis tick an order sits at: `BookLeg.normalize`. */
export function yesAxisTick(outcome: 0 | 1, priceTick: number): number {
  return outcome === 1 ? priceTick : 1_000 - priceTick;
}

/**
 * Collateral a BUY of `amountWad` shares reserves at `priceTick`, in the book
 * token's native units, rounded up: `BookLeg.reserveCash`.
 */
export function bookBuyCashNative(priceTick: number, amountWad: bigint, shareUnit: bigint): bigint {
  const numerator = (amountWad / shareUnit) * BigInt(priceTick);
  return (numerator + NUM_TICKS - 1n) / NUM_TICKS;
}

/**
 * The most a BUY can pull: its cash plus the largest taker fee it could owe.
 *
 * The fee is `feeBps` of min(p, 1 - p) per share, never more than `feeBps` of
 * the cash, so this bound holds wherever in the book the order fills. One
 * extra unit absorbs the fee's own rounding.
 */
export function bookBuyMaxTokenIn(
  priceTick: number,
  amountWad: bigint,
  shareUnit: bigint,
  feeBps: number,
): bigint {
  const cash = bookBuyCashNative(priceTick, amountWad, shareUnit);
  return cash + (cash * BigInt(feeBps) + 9_999n) / 10_000n + 1n;
}

/**
 * Collateral that `amountWad` complete sets (one YES and one NO share each)
 * split from or merge into, in the book token's native units. Undefined when
 * the amount is not one the contract accepts (`_checkAmount`), or is too
 * small to be worth a whole native unit.
 */
export function setsCollateralNative(amountWad: bigint, shareUnit: bigint): bigint | undefined {
  if (amountWad <= 0n || shareUnit <= 0n) return undefined;
  if (amountWad % shareUnit !== 0n || amountWad > (1n << 128n) - 1n) {
    return undefined;
  }
  return amountWad / shareUnit;
}

/**
 * Whether an order would trade on arrival instead of resting. A post-only
 * order that would is refused by the contract (`PostOnlyWouldTrade`).
 */
export function bookOrderCrosses(input: {
  action: BookAction;
  outcome: 0 | 1;
  priceTick: number;
  /** Best YES bid and ask in ticks; undefined when that side is empty. */
  bestBidTick?: number;
  bestAskTick?: number;
}): boolean {
  const tick = yesAxisTick(input.outcome, input.priceTick);
  // BUY YES and SELL NO are bids on the YES axis; the other two are asks.
  const isBid = (input.action === BOOK_BUY) === (input.outcome === 1);
  return isBid
    ? input.bestAskTick !== undefined && tick >= input.bestAskTick
    : input.bestBidTick !== undefined && tick <= input.bestBidTick;
}
