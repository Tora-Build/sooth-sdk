/**
 * Interactive Test Utilities
 * Formatting, parsing, and helper functions
 */

import { formatUnits, parseUnits } from 'viem';

export const WAD = 10n ** 18n;

// ANSI colors for terminal output
export const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

export function success(msg: string): string {
  return `${colors.green}${msg}${colors.reset}`;
}

export function error(msg: string): string {
  return `${colors.red}${msg}${colors.reset}`;
}

export function warn(msg: string): string {
  return `${colors.yellow}${msg}${colors.reset}`;
}

export function info(msg: string): string {
  return `${colors.cyan}${msg}${colors.reset}`;
}

export function dim(msg: string): string {
  return `${colors.dim}${msg}${colors.reset}`;
}

export function bold(msg: string): string {
  return `${colors.bright}${msg}${colors.reset}`;
}

/**
 * Format a WAD value as a human-readable number
 */
export function formatWad(value: bigint, decimals = 2): string {
  const formatted = formatUnits(value, 18);
  const num = parseFloat(formatted);
  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Parse a human-readable number to WAD
 */
export function parseWad(value: string): bigint {
  // Remove commas
  const cleaned = value.replace(/,/g, '');
  return parseUnits(cleaned, 18);
}

/**
 * Format an address as shortened form
 */
export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

/**
 * Format a transaction hash
 */
export function shortTx(hash: string): string {
  return `${hash.slice(0, 10)}...`;
}

/**
 * Parse tick range from string like "40-60" to { tickLower, tickUpper }
 */
export function parseTickRange(range: string): { tickLower: number; tickUpper: number } {
  const parts = range.split('-').map(p => parseInt(p.trim(), 10));
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
    throw new Error(`Invalid tick range: "${range}". Expected format: "40-60"`);
  }

  // Convert percentage to ticks (multiply by 10)
  let tickLower = parts[0];
  let tickUpper = parts[1];

  // If values look like percentages (1-100), convert to ticks (10-1000)
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

/**
 * Parse outcome string to uint8
 */
export function parseOutcome(outcome: string): 0 | 1 {
  const lower = outcome.toLowerCase();
  if (lower === 'yes' || lower === 'y' || lower === '1') {
    return 1;
  }
  if (lower === 'no' || lower === 'n' || lower === '0') {
    return 0;
  }
  throw new Error(`Invalid outcome: "${outcome}". Expected: yes/no/y/n/0/1`);
}

/**
 * Format outcome as string
 */
export function formatOutcome(outcome: number): string {
  return outcome === 1 ? 'YES' : 'NO';
}

/**
 * Format tick as percentage
 */
export function formatTick(tick: number): string {
  return `${(tick / 10).toFixed(1)}%`;
}

/**
 * Format a table row
 */
export function tableRow(cols: string[], widths: number[]): string {
  return cols.map((col, i) => col.padEnd(widths[i])).join(' | ');
}

/**
 * Format a horizontal line for tables
 */
export function tableLine(widths: number[]): string {
  return widths.map(w => '-'.repeat(w)).join('-+-');
}

/**
 * Print a formatted table
 */
export function printTable(headers: string[], rows: string[][], widths?: number[]): void {
  const colWidths = widths || headers.map((h, i) =>
    Math.max(h.length, ...rows.map(r => (r[i] || '').length))
  );

  console.log(tableRow(headers, colWidths));
  console.log(tableLine(colWidths));
  for (const row of rows) {
    console.log(tableRow(row, colWidths));
  }
}

/**
 * Sleep for ms milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Spinner for async operations
 */
export class Spinner {
  private frames = ['|', '/', '-', '\\'];
  private index = 0;
  private interval: ReturnType<typeof setInterval> | null = null;
  private message: string;

  constructor(message: string) {
    this.message = message;
  }

  start(): void {
    process.stdout.write(`  ${this.frames[0]} ${this.message}`);
    this.interval = setInterval(() => {
      this.index = (this.index + 1) % this.frames.length;
      process.stdout.write(`\r  ${this.frames[this.index]} ${this.message}`);
    }, 100);
  }

  stop(finalMessage?: string): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    process.stdout.write('\r' + ' '.repeat(this.message.length + 10) + '\r');
    if (finalMessage) {
      console.log(finalMessage);
    }
  }

  succeed(msg?: string): void {
    this.stop(`  ${success('✓')} ${msg || this.message}`);
  }

  fail(msg?: string): void {
    this.stop(`  ${error('✗')} ${msg || this.message}`);
  }
}

/**
 * Box drawing for headers
 */
export function printBox(lines: string[], width = 60): void {
  const top = '╔' + '═'.repeat(width - 2) + '╗';
  const bottom = '╚' + '═'.repeat(width - 2) + '╝';

  // Strip ANSI codes for length calculation
  const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '');

  console.log(top);
  for (const line of lines) {
    const visualLen = stripAnsi(line).length;
    const padding = Math.max(0, width - 4 - visualLen);
    console.log(`║ ${line}${' '.repeat(padding)} ║`);
  }
  console.log(bottom);
}

/**
 * Parse command and arguments from input
 */
export function parseCommand(input: string): { command: string; args: string[] } {
  const trimmed = input.trim();
  if (!trimmed) {
    return { command: '', args: [] };
  }

  const parts = trimmed.split(/\s+/);
  return {
    command: parts[0].toLowerCase(),
    args: parts.slice(1),
  };
}
