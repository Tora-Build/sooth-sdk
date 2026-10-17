/** Read-only v2 data adapters. Indexed figures are display data, never signing authority. */
import { parseFactoryIndexedAt, type FactoryIndexedAt } from './schema.js';
import type { Address, Hex } from 'viem';
import {
  factoryAddress,
  factoryHash,
  factoryNodeKey,
  type FactoryIdentity,
} from './factoryClient.js';
import type { FactoryBookLevel } from './factoryPortfolio.js';

export interface FactoryIndexerOptions {
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
  signal?: AbortSignal;
  /** Maximum pages per snapshot attempt; strict readers reject an unfinished list. */
  maxPages?: number;
  timeoutMs?: number;
  /** Total snapshot attempts, including the first. Defaults to one; only snapshot movement restarts a read. */
  snapshotAttempts?: number;
}
export interface FactoryIndexedPage<T> {
  indexed: FactoryIndexedAt;
  items: T[];
  next: null;
  complete: true;
}
/** Completeness describes source exhaustion; a window may retain only its last maxItems items. */
export type FactoryIndexedWindow<T> =
  | FactoryIndexedPage<T>
  | { indexed: FactoryIndexedAt; items: T[]; next: string; complete: false };
export interface FactoryIndexedOrder {
  orderId: bigint;
  market: Address;
  maker: Address;
  action: 'buy' | 'sell';
  outcome: 0 | 1;
  side: 'bid' | 'ask';
  yesTick: number;
  amount: bigint;
  remaining: bigint;
  cashReserved: bigint;
  expiry: bigint;
  status: 'open' | 'expired' | 'filled' | 'cancelled' | null;
  placed: {
    blockNumber: number;
    logIndex: number;
    blockHash: Hex;
    transactionHash: Hex;
    timestamp: number | null;
  };
  cancelled: {
    blockNumber: number;
    logIndex: number;
    transactionHash: Hex;
    amount: bigint;
    cashRefund: bigint;
  } | null;
  updatedBlock: number;
}
export interface FactoryIndexedInventory {
  market: Address;
  account: Address;
  venue: 'amm' | 'book';
  yesOwned: bigint;
  noOwned: bigint;
  yesReserved: bigint;
  noReserved: bigint;
  cashReserved: bigint;
}
export interface FactoryIndexedTrade {
  market: Address;
  account: Address;
  outcome: 0 | 1;
  side: 'buy' | 'sell';
  shares: bigint;
  cost: bigint;
  averagePrice: bigint;
  qYes: bigint;
  qNo: bigint;
  blockNumber: number;
  logIndex: number;
  blockHash: Hex;
  transactionHash: Hex;
  timestamp: number | null;
}
export interface FactoryIndexedFill {
  market: Address;
  maker: Address;
  taker: Address;
  orderId: bigint;
  amount: bigint;
  remaining: bigint;
  cashReserved: bigint;
  yesTick: number;
  settlementType: number;
  blockNumber: number;
  logIndex: number;
  blockHash: Hex;
  transactionHash: Hex;
  timestamp: number | null;
}
export interface FactoryPricePoint {
  market: Address;
  price: bigint;
  qYes: bigint;
  qNo: bigint;
  blockNumber: number;
  logIndex: number;
  blockHash: Hex;
  timestamp: number | null;
}
const record = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Invalid indexed object');
  return v as Record<string, unknown>;
};
const amount = (v: unknown): bigint => {
  if (typeof v !== 'string' || !/^\d{1,78}$/.test(v) || BigInt(v) >= 1n << 256n)
    throw new Error('Invalid indexed amount');
  return BigInt(v);
};
const orderId = (v: unknown): bigint => {
  if (typeof v !== 'string' || !/^[1-9]\d{0,19}$/.test(v))
    throw new Error('Invalid indexed order ID');
  const id = BigInt(v);
  if (id >= 1n << 64n) throw new Error('Invalid indexed order ID');
  return id;
};
const integer = (v: unknown): number => {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0)
    throw new Error('Invalid indexed integer');
  return v;
};
const tick = (v: unknown): number => {
  const n = integer(v);
  if (n < 1 || n > 999) throw new Error('Invalid indexed tick');
  return n;
};
const outcome = (v: unknown): 0 | 1 => {
  if (v !== 0 && v !== 1) throw new Error('Invalid indexed outcome');
  return v;
};
const side = (v: unknown): 'buy' | 'sell' => {
  if (v !== 'buy' && v !== 'sell') throw new Error('Invalid indexed side');
  return v;
};
const timestamp = (v: unknown) => (v === null ? null : integer(v));
const location = (r: Record<string, unknown>) => ({
  blockNumber: integer(r.blockNumber),
  logIndex: integer(r.logIndex),
  blockHash: factoryHash(r.blockHash),
  timestamp: timestamp(r.timestamp),
});
export function factoryDataPath(identity: FactoryIdentity): string {
  factoryNodeKey(identity);
  return `/v2/chains/${identity.chainId}/factories/${factoryAddress(identity.factory)}/nodes/${factoryHash(identity.nodeId)}`;
}
async function request(url: URL, options: FactoryIndexerOptions) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(abort, options.timeoutMs ?? 12_000);
  try {
    const response = await (options.fetch ?? globalThis.fetch)(url.toString(), {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Factory indexer HTTP ${response.status}`);
    return record(await response.json());
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}
function pages<T>(
  identity: FactoryIdentity,
  path: string,
  filters: Record<string, string | undefined>,
  options: FactoryIndexerOptions,
  parse: (item: unknown) => T,
): Promise<FactoryIndexedPage<T>>;
function pages<T>(
  identity: FactoryIdentity,
  path: string,
  filters: Record<string, string | undefined>,
  options: FactoryIndexerOptions,
  parse: (item: unknown) => T,
  maxItems: number,
): Promise<FactoryIndexedWindow<T>>;
async function pages<T>(
  identity: FactoryIdentity,
  path: string,
  filters: Record<string, string | undefined>,
  options: FactoryIndexerOptions,
  parse: (item: unknown) => T,
  maxItems?: number,
): Promise<FactoryIndexedWindow<T>> {
  const url = new URL(`${options.baseUrl.replace(/\/$/, '')}${factoryDataPath(identity)}${path}`);
  url.searchParams.set('limit', '200');
  for (const [key, value] of Object.entries(filters))
    if (value !== undefined) url.searchParams.set(key, value);
  const max = options.maxPages ?? 100;
  const attempts = options.snapshotAttempts ?? 1;
  if (!Number.isSafeInteger(max) || max <= 0) throw new Error('Invalid indexer page bound');
  if (!Number.isSafeInteger(attempts) || attempts <= 0)
    throw new Error('Invalid indexer snapshot attempt bound');
  if (maxItems !== undefined && (!Number.isSafeInteger(maxItems) || maxItems <= 0))
    throw new Error('Invalid indexed window item bound');
  snapshots: for (let attempt = 0; attempt < attempts; attempt++) {
    url.searchParams.delete('cursor');
    const items: T[] = [];
    const seen = new Set<string>();
    let indexed: FactoryIndexedAt | undefined;
    for (let page = 0; page < max; page++) {
      const data = await request(url, options);
      const current = parseFactoryIndexedAt(data.indexed);
      if (
        indexed &&
        (current.blockHash !== indexed.blockHash ||
          current.blockNumber !== indexed.blockNumber ||
          current.timestamp !== indexed.timestamp)
      )
        continue snapshots;
      indexed = current;
      if (!Array.isArray(data.items) || data.items.length > 200)
        throw new Error('Indexed response has invalid or oversized items');
      for (const item of data.items) items.push(parse(item));
      if (maxItems !== undefined && items.length > maxItems)
        items.splice(0, items.length - maxItems);
      if (data.next === null) return { indexed, items, next: null, complete: true };
      if (typeof data.next !== 'string' || !data.next || seen.has(data.next))
        throw new Error('Invalid indexed cursor');
      if (maxItems !== undefined && page + 1 === max)
        return { indexed, items, next: data.next, complete: false };
      seen.add(data.next);
      url.searchParams.set('cursor', data.next);
    }
    throw new Error('Indexed discovery exceeds its page bound; results are incomplete');
  }
  throw new Error('Indexed snapshot moved between pages');
}
function scoped(
  raw: unknown,
  filter: { market?: Address; account?: Address; maker?: Address; taker?: Address },
) {
  const r = record(raw);
  for (const key of ['market', 'account', 'maker', 'taker'] as const)
    if (filter[key] && factoryAddress(r[key]) !== factoryAddress(filter[key]))
      throw new Error(`Indexed ${key} differs from the requested identity`);
  return r;
}
type NodeRequest = { identity: FactoryIdentity; options: FactoryIndexerOptions };
export function fetchFactoryIndexedOrders(
  input: NodeRequest & { market: Address; account: Address; resting?: boolean },
) {
  return pages(
    input.identity,
    '/orders',
    { market: input.market, maker: input.account, resting: String(input.resting ?? true) },
    input.options,
    (raw) => {
      const r = scoped(raw, { market: input.market, maker: input.account });
      if (r.side !== 'bid' && r.side !== 'ask') throw new Error('Invalid indexed book side');
      if (
        r.status !== null &&
        r.status !== 'open' &&
        r.status !== 'expired' &&
        r.status !== 'filled' &&
        r.status !== 'cancelled'
      )
        throw new Error('Invalid indexed order status');
      const placed = record(r.placed);
      const cancelled = r.cancelled === null ? null : record(r.cancelled);
      return {
        orderId: orderId(r.orderId),
        market: factoryAddress(r.market),
        maker: factoryAddress(r.maker),
        action: side(r.action),
        outcome: outcome(r.outcome),
        side: r.side,
        yesTick: tick(r.yesTick),
        amount: amount(r.amount),
        remaining: amount(r.remaining),
        cashReserved: amount(r.cashReserved),
        expiry: amount(r.expiry),
        status: r.status,
        placed: { ...location(placed), transactionHash: factoryHash(placed.transactionHash) },
        cancelled:
          cancelled === null
            ? null
            : {
                blockNumber: integer(cancelled.blockNumber),
                logIndex: integer(cancelled.logIndex),
                transactionHash: factoryHash(cancelled.transactionHash),
                amount: amount(cancelled.amount),
                cashRefund: amount(cancelled.cashRefund),
              },
        updatedBlock: integer(r.updatedBlock),
      } satisfies FactoryIndexedOrder;
    },
  );
}
export function fetchFactoryIndexedInventory(
  input: NodeRequest & { account: Address; market?: Address },
) {
  return pages(
    input.identity,
    '/inventory',
    { account: input.account, market: input.market },
    input.options,
    (raw) => {
      const r = scoped(raw, input);
      if (r.venue !== 'amm' && r.venue !== 'book') throw new Error('Invalid indexed venue');
      return {
        market: factoryAddress(r.market),
        account: factoryAddress(r.account),
        venue: r.venue,
        yesOwned: amount(r.yesOwned),
        noOwned: amount(r.noOwned),
        yesReserved: amount(r.yesReserved),
        noReserved: amount(r.noReserved),
        cashReserved: amount(r.cashReserved),
      } satisfies FactoryIndexedInventory;
    },
  );
}
export function fetchFactoryTrades(input: NodeRequest & { market: Address; account?: Address }) {
  return pages(
    input.identity,
    '/trades',
    { market: input.market, account: input.account },
    input.options,
    (raw) => {
      const r = scoped(raw, input);
      return {
        ...location(r),
        market: factoryAddress(r.market),
        account: factoryAddress(r.account),
        outcome: outcome(r.outcome),
        side: side(r.side),
        shares: amount(r.shares),
        cost: amount(r.cost),
        averagePrice: amount(r.averagePrice),
        qYes: amount(r.qYes),
        qNo: amount(r.qNo),
        transactionHash: factoryHash(r.transactionHash),
      } satisfies FactoryIndexedTrade;
    },
  );
}
type FillRequest = NodeRequest & { market: Address; maker?: Address; taker?: Address };
function parseFill(raw: unknown, filter: FillRequest): FactoryIndexedFill {
  const r = scoped(raw, filter);
  const settlementType = integer(r.settlementType);
  if (settlementType > 3) throw new Error('Invalid fill settlement type');
  return {
    ...location(r),
    market: factoryAddress(r.market),
    maker: factoryAddress(r.maker),
    taker: factoryAddress(r.taker),
    orderId: orderId(r.orderId),
    amount: amount(r.amount),
    remaining: amount(r.remaining),
    cashReserved: amount(r.cashReserved),
    yesTick: tick(r.yesTick),
    settlementType,
    transactionHash: factoryHash(r.transactionHash),
  };
}
export function fetchFactoryFills(
  input: FillRequest,
): Promise<FactoryIndexedPage<FactoryIndexedFill>> {
  return pages(
    input.identity,
    '/fills',
    { market: input.market, maker: input.maker, taker: input.taker },
    input.options,
    (raw) => parseFill(raw, input),
  );
}
/**
 * Retains the last maxItems fills from at most maxPages oldest-first pages.
 * Defaults match Market's chart: five pages, last 400 fills. If the page bound
 * leaves newer fills unread, next retains their cursor and complete is false;
 * these items are the tail of the visited prefix, not the latest fills overall.
 */
export function fetchFactoryRecentFills(
  input: FillRequest & { maxItems?: number },
): Promise<FactoryIndexedWindow<FactoryIndexedFill>> {
  return pages(
    input.identity,
    '/fills',
    { market: input.market, maker: input.maker, taker: input.taker },
    { ...input.options, maxPages: input.options.maxPages ?? 5 },
    (raw) => parseFill(raw, input),
    input.maxItems ?? 400,
  );
}
export function fetchFactoryPrices(input: NodeRequest & { market: Address }) {
  return pages(
    input.identity,
    `/markets/${factoryAddress(input.market)}/prices`,
    {},
    input.options,
    (raw) => {
      const r = scoped(raw, input);
      return {
        ...location(r),
        market: factoryAddress(r.market),
        price: amount(r.price),
        qYes: amount(r.qYes),
        qNo: amount(r.qNo),
      } satisfies FactoryPricePoint;
    },
  );
}
export async function fetchFactoryIndexedDepth(input: NodeRequest & { market: Address }) {
  const url = new URL(
    `${input.options.baseUrl.replace(/\/$/, '')}${factoryDataPath(input.identity)}/markets/${factoryAddress(input.market)}/depth`,
  );
  const data = await request(url, input.options);
  const indexed = parseFactoryIndexedAt(data.indexed);
  const levels: FactoryBookLevel[] = [];
  for (const [key, bookSide] of [
    ['bids', 0],
    ['asks', 1],
  ] as const) {
    if (!Array.isArray(data[key]) || data[key].length > 999)
      throw new Error('Invalid indexed depth');
    const seen = new Set<number>();
    for (const value of data[key] as unknown[]) {
      const r = record(value);
      const yesTick = tick(r.yesTick);
      if (seen.has(yesTick)) throw new Error('Duplicate indexed depth tick');
      seen.add(yesTick);
      levels.push({
        side: bookSide,
        yesTick,
        amountWad: amount(r.amount),
        orderCount: BigInt(integer(r.orders)),
      });
    }
  }
  return {
    indexed,
    blockNumber: BigInt(indexed.blockNumber),
    levels,
    fromTick: 1,
    toTick: 999,
    complete: true as const,
  };
}
