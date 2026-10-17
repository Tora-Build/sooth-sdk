import { wadToNativeFloor } from './amounts.js';

/** Outcome encoding is protocol-wide: NO = 0, YES = 1, INVALID = 2. */
const WAD = 10n ** 18n;

/** Collateral per settled share, WAD. */
export function redemptionWad(winningOutcome: number, outcome: 0 | 1): bigint {
  if (winningOutcome === 2) return WAD / 2n;
  return winningOutcome === outcome ? WAD : 0n;
}

/** Sum both INVALID sides before dividing, preserving fractional carry. */
export function positionPayoutWad(
  winningOutcome: number,
  yesShares: bigint,
  noShares: bigint,
): bigint {
  return (
    (yesShares * redemptionWad(winningOutcome, 1) + noShares * redemptionWad(winningOutcome, 0)) /
    WAD
  );
}

/** LP principal uses the original deposit denominator, not circulating receipt supply. */
export function liquidityValueWad(residualWad: bigint, units: bigint, depositWad: bigint): bigint {
  if (depositWad <= 0n || units <= 0n) return 0n;
  return (residualWad * units) / depositWad;
}

/** Timeout invalidation is INVALID regardless of the stored proposal outcome. */
export function settledOutcomeOnChain(
  isSettled: boolean,
  outcome: number,
  settlementKind: number,
): 0 | 1 | 2 | null {
  if (!isSettled) return null;
  if (settlementKind === 2) return 2;
  if (outcome !== 0 && outcome !== 1 && outcome !== 2)
    throw new Error(`Unknown outcome ${outcome} on a settled market`);
  return outcome;
}

/** Native AMM payout after summing INVALID sides and rounding at the token boundary. */
export function ammPayoutNative(
  outcome: number,
  yes: bigint,
  no: bigint,
  decimals: number,
): bigint {
  return wadToNativeFloor(outcome === 1 ? yes : outcome === 0 ? no : (yes + no) / 2n, decimals);
}

/** Book INVALID carry is one native half-unit and belongs to the book account ledger. */
export function bookPayoutNative(
  outcome: number,
  yesFree: bigint,
  noFree: bigint,
  shareUnit: bigint,
  invalidRemainder: bigint,
): bigint {
  if (
    yesFree < 0n ||
    noFree < 0n ||
    shareUnit <= 0n ||
    invalidRemainder < 0n ||
    invalidRemainder > 1n
  )
    throw new Error('Book inventory or carry unavailable');
  return outcome === 1
    ? yesFree / shareUnit
    : outcome === 0
      ? noFree / shareUnit
      : ((yesFree + noFree) / shareUnit + invalidRemainder) / 2n;
}
