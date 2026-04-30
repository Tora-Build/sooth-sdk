import { createPublicClient, http, type Chain, type PublicClient } from 'viem';

export {
  WAD,
  formatWad,
  parseWad,
  shortAddress,
  shortTx,
  parseTickRange,
  parseOutcome,
  formatOutcome,
  formatTick,
  tableRow,
  tableLine,
  sleep,
  getOrderType,
  ERROR_SELECTORS,
  PANIC_CODES,
  decodeError,
  decodeErrorHex,
  isTransientError,
  isContractError,
  isNoDataError,
} from '../core/index.js';

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

export function printTable(headers: string[], rows: string[][], widths?: number[]): void {
  const colWidths =
    widths || headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] || '').length)));

  const tableRow = (cols: string[]) => cols.map((col, i) => col.padEnd(colWidths[i])).join(' | ');
  const tableLine = () => colWidths.map((w) => '-'.repeat(w)).join('-+-');

  console.log(tableRow(headers));
  console.log(tableLine());
  for (const row of rows) {
    console.log(tableRow(row));
  }
}

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
    this.stop(`  ${success('\u2713')} ${msg || this.message}`);
  }

  fail(msg?: string): void {
    this.stop(`  ${error('\u2717')} ${msg || this.message}`);
  }
}

export function printBox(lines: string[], width = 60): void {
  const top = '\u2554' + '\u2550'.repeat(width - 2) + '\u2557';
  const bottom = '\u255A' + '\u2550'.repeat(width - 2) + '\u255D';

  const stripAnsi = (str: string) => str.replace(/\x1b\[[0-9;]*m/g, '');

  console.log(top);
  for (const line of lines) {
    const visualLen = stripAnsi(line).length;
    const padding = Math.max(0, width - 4 - visualLen);
    console.log(`\u2551 ${line}${' '.repeat(padding)} \u2551`);
  }
  console.log(bottom);
}

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

export function getRpcCandidates(
  primaryRpc: string,
  chain: Chain,
  extraRpcs: string[] = [],
): string[] {
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

type ReadContractArgs = Parameters<PublicClient['readContract']>[0];

export async function readContractWithRpcFallback<T>(
  chain: Chain,
  primaryRpc: string,
  args: ReadContractArgs,
  extraRpcs: string[] = [],
): Promise<T> {
  const { isContractError, isTransientError, isNoDataError, decodeError } =
    await import('../core/index.js');
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

  const hint =
    candidates.length > 1 ? `Tried RPCs: ${candidates.join(', ')}` : `RPC: ${primaryRpc}`;

  throw new Error(`${decodeError(lastError || new Error('Unknown error'))}. ${hint}`);
}
