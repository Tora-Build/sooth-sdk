/**
 * The numbers of one AMM trade, decided before any signature.
 *
 * Pure: the panel reads the quote, the wallet's balance, allowance and
 * position, and this module says what to approve, what bound to send and why
 * a trade cannot go. Every amount path is tested here without a chain.
 */
import { formatShares, tokenShortfall, wadToNativeCeil, type TradeToken } from './amounts.js';
import { planTokenApproval } from './tokenApproval.js';

/** How far a trade may move from its quote before the contract refuses it. */
export const DEFAULT_SLIPPAGE_BPS = 100n;
const BPS = 10_000n;

export interface AmmQuote {
  costWad: bigint;
  feeWad: bigint;
  netWad: bigint;
  newPriceWad: bigint;
}

/**
 * The most a buy may cost, WAD, rounded up. This remains the transaction
 * bound even when the user chooses a larger reusable approval.
 */
export function buyMaxCostWad(netWad: bigint, slippageBps: bigint = DEFAULT_SLIPPAGE_BPS): bigint {
  return (netWad * (BPS + slippageBps) + (BPS - 1n)) / BPS;
}

/** The least a sell accepts, WAD, rounded down. */
export function sellMinProceedsWad(
  netWad: bigint,
  slippageBps: bigint = DEFAULT_SLIPPAGE_BPS,
): bigint {
  return (netWad * (BPS - slippageBps)) / BPS;
}

export type AmmSide = 'buy' | 'sell';
export type AmmOutcome = 0 | 1;

export interface AmmTradeInput {
  side: AmmSide;
  outcome: AmmOutcome;
  /** Shares to buy or sell, WAD. */
  sharesWad: bigint;
  quote: AmmQuote | null;
  /** The market's collateral (`tokenA`), never assumed. */
  token: TradeToken;
  /** Wallet facts at the latest read. */
  balance: bigint;
  /** Allowance already granted to AMMEngine. */
  allowance: bigint;
  /** Optional finite reusable approval in native token units. */
  approvalLimitNative?: bigint;
  /** Authorization-only plan: collateral funding is checked when submitting the trade. */
  approvalOnly?: boolean;
  held: { yes: bigint; no: bigint };
  slippageBps?: bigint;
}

export type AmmTradePlan =
  | {
      ok: true;
      /** Signed share delta for `tradePositions`: positive buys, negative sells. */
      deltaShares: bigint;
      /** `maxCostOrMinProceeds` for `tradePositions`, WAD. */
      boundWad: bigint;
      /** Collateral the buy may pull, native units; 0 for a sell. */
      requiredNative: bigint;
      /** Approval to send first, or null when the existing allowance is sufficient. */
      approveNative: bigint | null;
    }
  | {
      ok: false;
      reason: string;
      /** The wallet cannot pay the bound: a funding hint applies. */ shortfall?: true;
    };

export function planAmmTrade(input: AmmTradeInput): AmmTradePlan {
  const slippage = input.slippageBps ?? DEFAULT_SLIPPAGE_BPS;
  if (slippage < 0n || slippage > BPS || (input.outcome !== 0 && input.outcome !== 1))
    return { ok: false, reason: 'Invalid slippage or outcome.' };
  if (input.quote && input.quote.netWad < 0n) return { ok: false, reason: 'Invalid quote.' };
  if (input.sharesWad <= 0n) return { ok: false, reason: 'Enter a number of shares above zero.' };
  if (!input.quote)
    return { ok: false, reason: 'No live quote yet; an unpriced trade is not signed.' };
  if (input.side === 'sell') {
    const held = input.outcome === 1 ? input.held.yes : input.held.no;
    if (input.sharesWad > held) {
      return {
        ok: false,
        reason: `This wallet holds ${formatShares(held)} ${input.outcome === 1 ? 'YES' : 'NO'} shares on this market.`,
      };
    }
    return {
      ok: true,
      deltaShares: -input.sharesWad,
      boundWad: sellMinProceedsWad(input.quote.netWad, slippage),
      requiredNative: 0n,
      approveNative: null,
    };
  }
  const boundWad = buyMaxCostWad(input.quote.netWad, slippage);
  const requiredNative = wadToNativeCeil(boundWad, input.token.decimals);
  const shortfall = tokenShortfall(input.balance, requiredNative, input.token, 'This buy');
  if (shortfall && !input.approvalOnly) return { ok: false, reason: shortfall, shortfall: true };
  const approval = planTokenApproval({
    allowance: input.allowance,
    requiredNative,
    approvalLimitNative: input.approvalLimitNative,
  });
  if (!approval.ok) return approval;
  return {
    ok: true,
    deltaShares: input.sharesWad,
    boundWad,
    requiredNative,
    approveNative: approval.approveNative,
  };
}
