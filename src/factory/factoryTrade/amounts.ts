import { formatUnits } from 'viem';

/** A venue token as the trade panel labels it: address, decimals, symbol. */
export interface TradeToken {
  address: `0x${string}`;
  decimals: number;
  symbol: string;
}

/** WAD to the token's native units, rounded up: this is what a transfer pulls. */
export function wadToNativeCeil(wad: bigint, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18 || wad < 0n)
    throw new Error(`Unsupported token decimals ${decimals}`);
  const scale = 10n ** BigInt(18 - decimals);
  return (wad + scale - 1n) / scale;
}

/** WAD to native units, rounded down: what a payout to the wallet becomes. */
export function wadToNativeFloor(wad: bigint, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18 || wad < 0n)
    throw new Error(`Unsupported token decimals ${decimals}`);
  return wad / 10n ** BigInt(18 - decimals);
}

/**
 * Every user-visible token amount carries its symbol. Each Factory node has
 * its own collateral; an unlabelled number on a page that can show two of
 * them is wrong by construction.
 */
export function formatTokenAmount(
  raw: bigint,
  token: TradeToken,
  maximumFractionDigits = 4,
): string {
  const value = Number(formatUnits(raw, token.decimals));
  return `${value.toLocaleString('en-US', {
    minimumFractionDigits: Math.min(2, maximumFractionDigits),
    maximumFractionDigits,
  })} ${token.symbol}`;
}

/** Outcome shares are WAD on both venues and are not a token. */
export function formatShares(wad: bigint): string {
  return Number(formatUnits(wad, 18)).toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function formatBps(bps: number | bigint): string {
  const value = Number(bps);
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: value % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value / 100)}%`;
}

/** A 0..1 WAD probability as a cent label with one decimal. */
export function formatWadCents(priceWad: bigint): string {
  const tenths = (priceWad + 5n * 10n ** 14n) / 10n ** 15n;
  return `${tenths / 10n}.${tenths % 10n}¢`;
}

/**
 * A token amount at four decimals at most, rounded away from the user's
 * favour: a need rounds up, a balance rounds down. No trailing zeros, so a
 * whole number reads as "1 EAST" and a long WAD remainder as "0.45 CON".
 */
export function formatTokenRounded(
  raw: bigint,
  token: TradeToken,
  mode: 'up' | 'down',
  decimals = 4,
): string {
  const unit = token.decimals > decimals ? 10n ** BigInt(token.decimals - decimals) : 1n;
  const rounded = mode === 'up' ? ((raw + unit - 1n) / unit) * unit : (raw / unit) * unit;
  const value = Number(formatUnits(rounded, token.decimals));
  return `${value.toLocaleString('en-US', { maximumFractionDigits: decimals })} ${token.symbol}`;
}

/** Plain words for a balance that does not cover a trade, naming the token. */
export function tokenShortfall(
  balance: bigint,
  required: bigint,
  token: TradeToken,
  purpose: string,
): string | null {
  if (balance >= required) return null;
  return `${purpose} needs ${formatTokenRounded(required, token, 'up')}, but this wallet has ${formatTokenRounded(balance, token, 'down')}.`;
}
