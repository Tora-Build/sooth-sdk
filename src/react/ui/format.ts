import type { SoothLocale } from './i18n.js';

/*
 * Display formatters ported from `@sooth/ui-hooks` format helpers. Money and share amounts
 * truncate rather than round so a balance never shows more than can actually be spent.
 */

const WAD_DECIMALS = 18;
const DASH = '—';

function intlLocale(locale: SoothLocale): string {
  return locale === 'zh' ? 'zh-CN' : 'en-US';
}

function finite(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Format a raw token amount with `decimals` places of precision, truncated to
 * `displayDecimals`. Trailing zeros are kept so columns align.
 */
export function formatTokenAmount(
  amount: bigint,
  decimals: number,
  displayDecimals = 2,
  options: { group?: boolean } = {},
): string {
  const safeDecimals = Math.max(0, Math.floor(decimals));
  const safeDisplay = Math.max(0, Math.min(Math.floor(displayDecimals), safeDecimals));
  const negative = amount < 0n;
  const absolute = negative ? -amount : amount;
  const divisor = 10n ** BigInt(safeDecimals);
  const wholeDigits = (absolute / divisor).toString();
  const whole =
    options.group === false ? wholeDigits : wholeDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (absolute % divisor)
    .toString()
    .padStart(safeDecimals, '0')
    .slice(0, safeDisplay);
  const truncatedToZero = wholeDigits === '0' && /^0*$/.test(fraction);
  const sign = negative && !truncatedToZero ? '-' : '';
  return safeDisplay === 0 ? `${sign}${whole}` : `${sign}${whole}.${fraction}`;
}

/** Token amount with its symbol, e.g. `12.50 USDC`. */
export function formatTokenWithSymbol(
  amount: bigint,
  decimals: number,
  symbol: string,
  displayDecimals = 2,
): string {
  return `${formatTokenAmount(amount, decimals, displayDecimals)} ${symbol}`;
}

/** Outcome shares are WAD (1e18) quantities. */
export function formatShares(wad: bigint, displayDecimals = 2): string {
  return formatTokenAmount(wad, WAD_DECIMALS, displayDecimals);
}

/** Convert a raw token amount to a JS number for charts and ratios only, never for signing. */
export function tokenAmountToNumber(amount: bigint, decimals: number): number {
  const safeDecimals = Math.max(0, Math.floor(decimals));
  const divisor = 10n ** BigInt(safeDecimals);
  const whole = amount / divisor;
  const remainder = amount % divisor;
  return Number(whole) + Number(remainder) / Number(divisor);
}

/** Price as cents, e.g. `0.625 → 62.5¢`. */
export function formatCents(price: number | null | undefined, fractionDigits = 1): string {
  if (!finite(price)) return DASH;
  return `${(price * 100).toFixed(fractionDigits)}¢`;
}

/** Fraction 0..1 as a percent, e.g. `0.625 → 62.5%`. */
export function formatPercent(fraction: number | null | undefined, fractionDigits = 1): string {
  if (!finite(fraction)) return DASH;
  return `${(fraction * 100).toFixed(fractionDigits)}%`;
}

/** Basis points as a percent, e.g. `150 → 1.5%`. */
export function formatBps(bps: number | bigint, fractionDigits = 2): string {
  const value = typeof bps === 'bigint' ? Number(bps) : bps;
  if (!finite(value)) return DASH;
  const fixed = (value / 100).toFixed(fractionDigits).replace(/\.?0+$/, '');
  return `${fixed}%`;
}

/**
 * Market probability for headline display. Values that would round to 0% or 100% while
 * the market is still uncertain are shown as `<1%` / `>99%`.
 */
export function formatProbability(yes: number | null | undefined): string {
  if (!finite(yes)) return DASH;
  const clamped = Math.min(1, Math.max(0, yes));
  if (clamped > 0 && clamped < 0.01) return '<1%';
  if (clamped < 1 && clamped > 0.99) return '>99%';
  return `${Math.round(clamped * 100)}%`;
}

/** Signed percentage-point change, e.g. `+3.2 pts`. */
export function formatProbabilityChange(before: number, after: number): string {
  if (!finite(before) || !finite(after)) return DASH;
  const delta = (after - before) * 100;
  const sign = delta > 0 ? '+' : delta < 0 ? '−' : '';
  return `${sign}${Math.abs(delta).toFixed(1)} pts`;
}

/** Compact amount, e.g. `12.3K` (en) or `1.2万` (zh). Optional prefix such as `$`. */
export function formatCompact(
  value: number | null | undefined,
  locale: SoothLocale = 'en',
  prefix = '',
): string {
  if (!finite(value)) return DASH;
  const magnitude = Math.abs(value);
  if (magnitude < 1000) {
    return `${value < 0 ? '-' : ''}${prefix}${magnitude.toFixed(magnitude >= 100 ? 0 : 2)}`;
  }
  const formatted = new Intl.NumberFormat(intlLocale(locale), {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(magnitude);
  return `${value < 0 ? '-' : ''}${prefix}${formatted}`;
}

/** Compact token amount from raw units, e.g. `12.3K USDC`. */
export function formatCompactToken(
  amount: bigint,
  decimals: number,
  symbol: string,
  locale: SoothLocale = 'en',
): string {
  return `${formatCompact(tokenAmountToNumber(amount, decimals), locale)} ${symbol}`;
}

/** `0x1234…abcd` */
export function shortAddress(address: string | null | undefined, lead = 6, tail = 4): string {
  if (!address) return DASH;
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

export interface SoothCountdown {
  /** Whole seconds remaining; 0 once the deadline has passed. */
  seconds: number;
  expired: boolean;
  days: number;
  hours: number;
  minutes: number;
}

/** Split the time until a unix-seconds deadline. `now` is milliseconds since epoch. */
export function countdownTo(deadline: bigint | number, now: number = Date.now()): SoothCountdown {
  const target = typeof deadline === 'bigint' ? Number(deadline) : deadline;
  const seconds = Math.max(0, Math.floor(target - now / 1000));
  return {
    seconds,
    expired: seconds === 0,
    days: Math.floor(seconds / 86_400),
    hours: Math.floor((seconds % 86_400) / 3_600),
    minutes: Math.floor((seconds % 3_600) / 60),
  };
}

/** Short countdown such as `3d 4h`, `5h 12m`, `9m` (en) or `3天 4小时` (zh). Empty once expired. */
export function formatCountdown(
  deadline: bigint | number,
  locale: SoothLocale = 'en',
  now: number = Date.now(),
): string {
  const { seconds, days, hours, minutes } = countdownTo(deadline, now);
  if (seconds === 0) return '';
  const unit =
    locale === 'zh'
      ? { d: '天', h: '小时', m: '分钟', sep: ' ' }
      : { d: 'd', h: 'h', m: 'm', sep: ' ' };
  if (days > 0) return `${days}${unit.d}${unit.sep}${hours}${unit.h}`;
  if (hours > 0) return `${hours}${unit.h}${unit.sep}${minutes}${unit.m}`;
  return `${Math.max(1, minutes)}${unit.m}`;
}

/** Absolute deadline in the viewer's time zone, e.g. `Mar 4, 2027, 14:00`. */
export function formatDeadline(
  deadline: bigint | number,
  locale: SoothLocale = 'en',
  timeZone?: string,
): string {
  const seconds = typeof deadline === 'bigint' ? Number(deadline) : deadline;
  if (!finite(seconds) || seconds <= 0) return DASH;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(seconds * 1000));
}

/** Chart axis label for a unix-seconds time; short form chosen from the visible span. */
export function formatChartTime(
  time: number,
  spanSeconds: number,
  locale: SoothLocale = 'en',
): string {
  const options: Intl.DateTimeFormatOptions =
    spanSeconds <= 86_400
      ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
      : { month: 'short', day: 'numeric' };
  return new Intl.DateTimeFormat(intlLocale(locale), options).format(new Date(time * 1000));
}
