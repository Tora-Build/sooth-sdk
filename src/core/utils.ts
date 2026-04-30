import {
  formatUnits,
  parseUnits,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  type Address,
} from 'viem';
import type { OutputLine, OutputLineType } from './types.js';

export function formatWad(value: bigint, decimals = 2): string {
  const formatted = formatUnits(value, 18);
  const num = parseFloat(formatted);
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function parseWad(value: string): bigint {
  const cleaned = value.replace(/,/g, '');
  return parseUnits(cleaned, 18);
}

export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function shortTx(hash: string): string {
  return `${hash.slice(0, 10)}...`;
}

export function parseTickRange(range: string): { tickLower: number; tickUpper: number } {
  const parts = range.split('-').map((p) => parseInt(p.trim(), 10));

  if (parts.length === 1 && !isNaN(parts[0])) {
    let tick = parts[0];
    if (tick <= 100) tick *= 10;
    return { tickLower: tick, tickUpper: tick };
  }

  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
    throw new Error(`Invalid tick range: "${range}". Expected format: "40-60" or single tick "50"`);
  }

  let tickLower = parts[0];
  let tickUpper = parts[1];

  if (tickLower <= 100 && tickUpper <= 100) {
    tickLower *= 10;
    tickUpper *= 10;
  }

  if (tickLower >= tickUpper) {
    throw new Error(`tickLower (${tickLower}) must be less than tickUpper (${tickUpper})`);
  }

  if (tickLower < 1 || tickUpper > 999) {
    throw new Error(`Ticks must be in range 1-999 (got ${tickLower}-${tickUpper})`);
  }

  return { tickLower, tickUpper };
}

export function parseOutcome(outcome: string): 0 | 1 {
  const lower = outcome.toLowerCase();
  if (lower === 'yes' || lower === 'y' || lower === '1') return 1;
  if (lower === 'no' || lower === 'n' || lower === '0') return 0;
  throw new Error(`Invalid outcome: "${outcome}". Expected: yes/no/y/n/0/1`);
}

export function formatOutcome(outcome: number): string {
  return outcome === 1 ? 'YES' : 'NO';
}

export function formatTick(tick: number): string {
  return `${(tick / 10).toFixed(1)}%`;
}

export function computeMarketKey(
  truthMarket: string,
  yesToken: string,
  noToken: string,
): `0x${string}` {
  return keccak256(
    encodeAbiParameters(parseAbiParameters('address, address, address'), [
      truthMarket as Address,
      yesToken as Address,
      noToken as Address,
    ]),
  );
}

export function computeMarketKeyWithHook(
  truthMarket: string,
  yesToken: string,
  noToken: string,
  hook: string = '0x0000000000000000000000000000000000000000',
): `0x${string}` {
  return keccak256(
    encodeAbiParameters(parseAbiParameters('address, address, address, address'), [
      truthMarket as Address,
      yesToken as Address,
      noToken as Address,
      hook as Address,
    ]),
  );
}

export function line(type: OutputLineType, text: string): OutputLine {
  return { type, text };
}

export function success(text: string): OutputLine {
  return line('success', text);
}

export function error(text: string): OutputLine {
  return line('error', text);
}

export function info(text: string): OutputLine {
  return line('info', text);
}

export function warn(text: string): OutputLine {
  return line('warn', text);
}

export function dim(text: string): OutputLine {
  return line('dim', text);
}

export function bold(text: string): OutputLine {
  return line('bold', text);
}

export function plain(text: string): OutputLine {
  return line('plain', text);
}

export function lines(...items: OutputLine[]): OutputLine[] {
  return items;
}

export function separator(width = 40): OutputLine {
  return dim('\u2500'.repeat(width));
}

export function tableRow(cols: string[], widths: number[]): string {
  return cols.map((col, i) => col.padEnd(widths[i])).join(' | ');
}

export function tableLine(widths: number[]): string {
  return widths.map((w) => '-'.repeat(w)).join('-+-');
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getOrderType(tickLower: number, tickUpper: number): 'limit' | 'market' | 'range' {
  if (tickLower === tickUpper) return 'limit';
  if ((tickLower === 1 || tickLower === 10) && (tickUpper === 999 || tickUpper === 9990))
    return 'market';
  return 'range';
}

/**
 * Convert WAD (1e18) value to token units for a given decimal count.
 * Example: wadToTokenUnits(1000000000000000000n, 6) => 1000000n (1 USDC)
 */
export function wadToTokenUnits(wad: bigint, tokenDecimals: number): bigint {
  const diff = 18 - tokenDecimals;
  if (diff < 0) return wad * 10n ** BigInt(-diff);
  return wad / 10n ** BigInt(diff);
}

/**
 * Convert token units to WAD (1e18) for a given decimal count.
 * Example: tokenUnitsToWad(1000000n, 6) => 1000000000000000000n
 */
export function tokenUnitsToWad(units: bigint, tokenDecimals: number): bigint {
  const diff = 18 - tokenDecimals;
  if (diff < 0) return units / 10n ** BigInt(-diff);
  return units * 10n ** BigInt(diff);
}
