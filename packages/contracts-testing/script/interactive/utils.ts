/**
 * Interactive Test Utilities
 * Formatting, parsing, and helper functions
 */

import { formatUnits, parseUnits, createPublicClient, http, type Chain, type PublicClient } from 'viem';

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

/**
 * Known error selectors for V10 contracts
 * Generated from: forge inspect TickBookPoolManager errors
 */
export const ERROR_SELECTORS: Record<string, string> = {
  // Known contract address prefixes (RPC returning address instead of error)
  '0x427be97e': 'RPC_ERROR: Returned contract address (gas estimation failed?)',
  '0x7e42f86b': 'RPC_ERROR: Returned contract address (Monad TickBookPoolManager)',
  // TickBookPoolManager errors
  '0xedd7c146': 'DuplicateMarket()',
  '0xcd4e6167': 'FeeTooHigh()',
  '0x39996567': 'InsufficientShares()',
  '0xc74a206d': 'InvalidOutcome()',
  '0x064847d0': 'InvalidTickRange()',
  '0xb03425ae': 'LiquidityOverflow()',
  '0xb521771a': 'MarketNotActive()',
  '0x3f22bf08': 'MarketNotLive()',
  '0xc301e07e': 'NoLiquidity()',
  '0x30cd7471': 'NotOwner()',
  '0x1d4ecc5b': 'OrderNotActive()',
  '0x8199f5f3': 'SlippageExceeded()',
  '0x35c3f177': 'SpotRangeTooWide()',
  '0x90797915': 'SpotSellNotActive()',
  '0xc7e13a01': 'TickOutOfRange()',
  // OpenZeppelin errors
  '0x1e4fbdf7': 'OwnableInvalidOwner(address)',
  '0x118cdaa7': 'OwnableUnauthorizedAccount(address)',
  '0x3ee5aeb5': 'ReentrancyGuardReentrantCall()',
  '0x5274afe7': 'SafeERC20FailedOperation(address)',
  // ERC20 errors
  '0xe450d38c': 'ERC20InsufficientBalance(address,uint256,uint256)',
  '0xfb8f41b2': 'ERC20InsufficientAllowance(address,uint256,uint256)',
  // Address library errors
  '0x1425ea42': 'AddressEmptyCode(address)',
  // Panic codes (special)
  '0x4e487b71': 'Panic(uint256)',
};

/**
 * Panic code meanings
 */
export const PANIC_CODES: Record<number, string> = {
  0x00: 'Generic compiler panic',
  0x01: 'Assert failed',
  0x11: 'Arithmetic overflow/underflow',
  0x12: 'Division by zero',
  0x21: 'Invalid enum value',
  0x22: 'Storage encoding error',
  0x31: 'Pop from empty array',
  0x32: 'Array out of bounds',
  0x41: 'Too much memory allocated',
  0x51: 'Zero-initialized function pointer',
};

/**
 * Decode an error from revert data or error message
 */
export function decodeError(errorData: string | Error): string {
  // Handle Error objects
  if (errorData instanceof Error) {
    const msg = errorData.message;
    
    // Try to extract hex revert data from error message
    const hexMatch = msg.match(/0x[a-fA-F0-9]+/);
    if (hexMatch) {
      const decoded = decodeErrorHex(hexMatch[0]);
      if (decoded !== hexMatch[0]) {
        return decoded;
      }
    }
    
    // Try to extract revert reason string
    const revertMatch = msg.match(/reverted with.*?["']([^"']+)["']/i)
      || msg.match(/reason:\s*([^\n]+)/i)
      || msg.match(/Error:\s*([^\n]+)/i);
    if (revertMatch) {
      return revertMatch[1].slice(0, 100);
    }
    
    // Return shortened message
    return msg.slice(0, 100);
  }
  
  return decodeErrorHex(errorData);
}

/**
 * Decode hex error data
 */
export function decodeErrorHex(hex: string): string {
  if (!hex || !hex.startsWith('0x')) {
    return hex || 'Unknown error';
  }
  
  if (hex.length < 10) {
    return `Unknown error: ${hex}`;
  }
  
  if (hex.length === 42) {
    return `RPC error (returned address): ${hex.slice(0, 10)}...`;
  }
  
  const selector = hex.slice(0, 10).toLowerCase();
  const data = hex.slice(10);
  
  // Check for known error
  const knownError = ERROR_SELECTORS[selector];
  if (knownError) {
    // Special handling for Panic
    if (knownError === 'Panic(uint256)' && data.length >= 64) {
      const panicCode = parseInt(data.slice(0, 64), 16);
      const meaning = PANIC_CODES[panicCode] || `Unknown panic code 0x${panicCode.toString(16)}`;
      return `Panic(0x${panicCode.toString(16)}): ${meaning}`;
    }
    
    // For errors with parameters, include truncated data
    if (knownError.includes('(') && !knownError.endsWith('()') && data.length > 0) {
      return `${knownError} [data: 0x${data.slice(0, 40)}${data.length > 40 ? '...' : ''}]`;
    }
    
    return knownError;
  }
  
  // Check for standard Error(string) - selector 0x08c379a0
  if (selector === '0x08c379a0' && data.length >= 128) {
    try {
      // Skip offset (32 bytes) and length (32 bytes), then decode string
      const stringLength = parseInt(data.slice(64, 128), 16);
      const stringData = data.slice(128, 128 + stringLength * 2);
      const decoded = Buffer.from(stringData, 'hex').toString('utf-8');
      return `Error: "${decoded}"`;
    } catch {
      // Fall through
    }
  }
  
  // Unknown selector
  return `Unknown error [${selector}]: 0x${data.slice(0, 40)}${data.length > 40 ? '...' : ''}`;
}

/**
 * Check if an error is transient (network/RPC issues vs contract revert)
 */
export function isTransientError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return msg.includes('timeout') ||
    msg.includes('network') ||
    msg.includes('nonce') ||
    msg.includes('already known') ||
    msg.includes('replacement transaction') ||
    msg.includes('connection') ||
    msg.includes('econnrefused') ||
    msg.includes('socket') ||
    msg.includes('rate limit') ||
    msg.includes('429') ||
    msg.includes('returned no data ("0x")');
}

/**
 * Check if an error is a contract revert
 */
export function isContractError(error: Error): boolean {
  const msg = error.message.toLowerCase();
  return msg.includes('revert') ||
    msg.includes('overflow') ||
    msg.includes('underflow') ||
    msg.includes('insufficient') ||
    msg.includes('panic') ||
    msg.includes('execution reverted');
}

export function isNoDataError(error: Error): boolean {
  return error.message.toLowerCase().includes('returned no data ("0x")');
}

type ReadContractArgs = Parameters<PublicClient['readContract']>[0];

export function getRpcCandidates(primaryRpc: string, chain: Chain, extraRpcs: string[] = []): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  const push = (rpc: string | undefined) => {
    const value = rpc?.trim();
    if (!value) return;
    if (seen.has(value)) return;
    seen.add(value);
    candidates.push(value);
  };

  push(primaryRpc);
  for (const rpc of extraRpcs) push(rpc);
  for (const rpc of chain.rpcUrls?.default?.http ?? []) push(rpc);

  return candidates;
}

export async function readContractWithRpcFallback<T>(
  chain: Chain,
  primaryRpc: string,
  args: ReadContractArgs,
  extraRpcs: string[] = [],
): Promise<T> {
  const candidates = getRpcCandidates(primaryRpc, chain, extraRpcs);

  let lastError: Error | undefined;
  for (const rpc of candidates) {
    const client = createPublicClient({
      chain,
      transport: http(rpc),
    });

    try {
      const result = await client.readContract(args);
      return result as unknown as T;
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      lastError = errorObj;

      if (isContractError(errorObj)) throw errorObj;
      if (isTransientError(errorObj) || isNoDataError(errorObj)) continue;

      throw errorObj;
    }
  }

  const hint = candidates.length > 1
    ? `Tried RPCs: ${candidates.join(', ')}`
    : `RPC: ${primaryRpc}`;

  throw new Error(`${decodeError(lastError || new Error('Unknown error'))}. ${hint}`);
}
