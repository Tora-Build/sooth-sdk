/**
 * What one order-book ticket would do, from numbers already read: the exact
 * approval a buy needs, the collateral it reserves, whether it would trade on
 * arrival. Pure: the panel reads the book state, the wallet's inventory and
 * balance, and asks here before any signature. A plan that is not `ok` names
 * the reason in plain words and is never sent.
 */
import { formatUnits } from 'viem';
import { formatShares, tokenShortfall, type TradeToken } from './amounts.js';
import {
  BOOK_BUY,
  BOOK_SELL,
  bookBuyCashNative,
  bookBuyMaxTokenIn,
  bookOrderCrosses,
  type BookAction,
} from './bookOrder.js';
import { planTokenApproval } from './tokenApproval.js';

export interface BookOrderInput {
  action: BookAction;
  outcome: 0 | 1;
  /** The price of the outcome traded, in ticks (1..999), or null when the typed cents are not a price. */
  priceTick: number | null;
  /** Shares, WAD. */
  sharesWad: bigint;
  shareUnit: bigint;
  /** The book fee in basis points; null when the vault did not answer (a buy is then not planned). */
  feeBps: number | null;
  /** The book's collateral. */
  token: TradeToken;
  balance: bigint;
  /** Allowance already granted to OrderEngine. */
  allowance: bigint;
  /** Optional finite reusable approval in native token units. */
  approvalLimitNative?: bigint;
  /** Authorization-only plan: collateral funding is checked when submitting the order. */
  approvalOnly?: boolean;
  inventory: { yesOwned: bigint; noOwned: bigint; yesReserved: bigint; noReserved: bigint };
  bestBidTick?: number;
  bestAskTick?: number;
  postOnly: boolean;
}

export type BookOrderPlan =
  | {
      ok: true;
      /** Collateral the order reserves at its limit, native units; 0 for a sell. */
      cashNative: bigint;
      /** `maxTokenIn` for `placeOrder`: the cash plus the largest fee it could owe; 0 for a sell. */
      maxTokenIn: bigint;
      /** Approval to send first, or null when the existing allowance is sufficient. */
      approveNative: bigint | null;
      /** True when the order would trade on arrival instead of resting. */
      crosses: boolean;
    }
  | { ok: false; reason: string; shortfall?: true };

export function planBookOrder(input: BookOrderInput): BookOrderPlan {
  if (input.outcome !== 0 && input.outcome !== 1) return { ok: false, reason: 'Invalid outcome.' };
  if (
    input.feeBps !== null &&
    (!Number.isInteger(input.feeBps) || input.feeBps < 0 || input.feeBps > 10_000)
  )
    return { ok: false, reason: 'Invalid book fee.' };
  if (
    input.priceTick === null ||
    !Number.isInteger(input.priceTick) ||
    input.priceTick < 1 ||
    input.priceTick > 999
  )
    return { ok: false, reason: 'Enter a price in cents between 0.1 and 99.9.' };
  if (input.sharesWad <= 0n) return { ok: false, reason: 'Enter a number of shares above zero.' };
  if (input.sharesWad > (1n << 128n) - 1n)
    return { ok: false, reason: 'Share amount exceeds the order book limit.' };
  if (input.shareUnit <= 0n || input.sharesWad % input.shareUnit !== 0n) {
    // The unit is exact here: for an 18-decimal book token it is one WAD unit, which `formatShares` would show as 0.
    return {
      ok: false,
      reason: `The order book takes shares in steps of ${formatUnits(input.shareUnit, 18)}.`,
    };
  }
  const crosses = bookOrderCrosses({
    action: input.action,
    outcome: input.outcome,
    priceTick: input.priceTick,
    bestBidTick: input.bestBidTick,
    bestAskTick: input.bestAskTick,
  });
  if (input.postOnly && crosses)
    return {
      ok: false,
      reason:
        'This order would trade at once; a post-only order must rest. Change the price or turn post-only off.',
    };
  if (input.action === BOOK_SELL) {
    const free =
      input.outcome === 1
        ? input.inventory.yesOwned - input.inventory.yesReserved
        : input.inventory.noOwned - input.inventory.noReserved;
    if (input.sharesWad > free) {
      return {
        ok: false,
        reason: `This wallet has ${formatShares(free < 0n ? 0n : free)} free ${input.outcome === 1 ? 'YES' : 'NO'} shares on the order book.`,
      };
    }
    return { ok: true, cashNative: 0n, maxTokenIn: 0n, approveNative: null, crosses };
  }
  if (input.action !== BOOK_BUY) return { ok: false, reason: 'Unknown order action.' };
  if (input.feeBps === null)
    return {
      ok: false,
      reason: 'The book fee could not be read; a buy is not planned without it.',
    };
  const cashNative = bookBuyCashNative(input.priceTick, input.sharesWad, input.shareUnit);
  const maxTokenIn = bookBuyMaxTokenIn(
    input.priceTick,
    input.sharesWad,
    input.shareUnit,
    input.feeBps,
  );
  const approval = planTokenApproval({
    allowance: input.allowance,
    requiredNative: maxTokenIn,
    approvalLimitNative: input.approvalLimitNative,
  });
  if (!approval.ok) return approval;
  const shortfall = tokenShortfall(input.balance, maxTokenIn, input.token, 'This order');
  if (shortfall && !input.approvalOnly) return { ok: false, reason: shortfall, shortfall: true };
  return {
    ok: true,
    cashNative,
    maxTokenIn,
    approveNative: approval.approveNative,
    crosses,
  };
}
