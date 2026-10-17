import { describe, expect, it, vi } from 'vitest';
import type { Address, Hex } from 'viem';
import {
  fetchFactoryFills,
  fetchFactoryIndexedOrders,
  fetchFactoryRecentFills,
} from '../../src/factory/factoryIndexer.js';
import { supportedRelease } from './fixtures/release.js';

const address = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Address;
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex;
const identity = { chainId: supportedRelease.chainId, factory: supportedRelease.factory, nodeId: hash(1) };
const market = address(2);
const account = address(3);
const indexed = { blockNumber: 100, blockHash: hash(100), timestamp: 1_000 };
const location = { blockNumber: 99, logIndex: 2, blockHash: hash(99), transactionHash: hash(98), timestamp: 999 };
const order = {
  orderId: '7', market, maker: account, action: 'buy', outcome: 1, side: 'bid', yesTick: 400,
  amount: '2000000000000000000', remaining: '1000000000000000000', cashReserved: '400000', expiry: '0',
  status: 'open', placed: location, cancelled: null, updatedBlock: 99,
};
// Alpha packages/indexer/factory/book.ts fillOf emits timestamp, not blockTimestamp.
const fill = {
  ...location, market, maker: account, taker: address(4), orderId: '7', amount: '1000000000000000000',
  remaining: '1000000000000000000', cashReserved: '400000', yesTick: 400, settlementType: 0,
};
const response = (items: unknown[], changes: Record<string, unknown> = {}) => new Response(JSON.stringify({ indexed, items, next: null, ...changes }));
const baseUrl = 'https://indexer.example/';
const fillBatch = (first: number, count = 200) => Array.from({ length: count }, (_, i) => ({ ...fill, orderId: String(first + i), logIndex: first + i }));

describe('Factory indexed order identifiers', () => {
  const readers = [
    { name: 'orders', item: order, read: (fetch: typeof globalThis.fetch) => fetchFactoryIndexedOrders({ identity, market, account, options: { baseUrl, fetch } }) },
    { name: 'fills', item: fill, read: (fetch: typeof globalThis.fetch) => fetchFactoryFills({ identity, market, options: { baseUrl, fetch } }) },
    { name: 'recent fills', item: fill, read: (fetch: typeof globalThis.fetch) => fetchFactoryRecentFills({ identity, market, options: { baseUrl, fetch } }) },
  ];

  it.each(readers)('rejects noncanonical or out-of-range identifiers in $name', async ({ item, read }) => {
    for (const orderId of ['0', '00', '07', '-1', '0x7', 7, (1n << 64n).toString(), '999999999999999999999']) {
      const fetch = vi.fn().mockResolvedValueOnce(response([{ ...item, orderId }]));
      await expect(read(fetch)).rejects.toThrow('order ID');
    }
  });

  it.each(readers)('preserves the maximum uint64 identifier in $name without rounding', async ({ item, read }) => {
    const maximum = (1n << 64n) - 1n;
    const fetch = vi.fn().mockResolvedValueOnce(response([{ ...item, orderId: maximum.toString() }]));
    expect((await read(fetch)).items[0]!.orderId).toBe(maximum);
  });
});

describe('Factory indexer snapshot attempts', () => {
  it.each([{ blockNumber: 101 }, { blockHash: hash(101) }, { timestamp: 1_001 }])('restarts from the first page after snapshot movement: %j', async changed => {
    const replacement = { ...indexed, ...changed };
    const cancelled = { blockNumber: 100, logIndex: 3, transactionHash: hash(97), amount: '1000000000000000000', cashRefund: '400000' };
    const replacementOrder = { ...order, orderId: '9', status: 'cancelled', cancelled, remaining: '0', cashReserved: '0', updatedBlock: 100 };
    const fetch = vi.fn()
      .mockResolvedValueOnce(response([order], { next: 'second page' }))
      .mockResolvedValueOnce(response([{ ...order, orderId: '8' }], { indexed: replacement }))
      .mockResolvedValueOnce(response([replacementOrder], { indexed: replacement, next: 'second page' }))
      .mockResolvedValueOnce(response([], { indexed: replacement }));
    const result = await fetchFactoryIndexedOrders({ identity, market, account, options: { baseUrl, fetch, maxPages: 2, snapshotAttempts: 3 } });
    expect(result).toMatchObject({ indexed: replacement, complete: true, next: null });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      orderId: 9n, status: 'cancelled', placed: location, updatedBlock: 100,
      cancelled: { ...cancelled, amount: 10n ** 18n, cashRefund: 400_000n },
    });
    expect(fetch.mock.calls.map(([url]) => new URL(String(url)).searchParams.get('cursor'))).toEqual([null, 'second page', null, 'second page']);
  });

  it('makes one snapshot attempt by default and rejects mixed pages', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response([fill], { next: 'second' }))
      .mockResolvedValueOnce(response([fill], { indexed: { ...indexed, blockNumber: 101 } }));
    await expect(fetchFactoryFills({ identity, market, options: { baseUrl, fetch } })).rejects.toThrow('snapshot moved');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('stops after the configured total attempts when the snapshot keeps moving', async () => {
    const fetch = vi.fn();
    for (let attempt = 0; attempt < 3; attempt++) {
      fetch.mockResolvedValueOnce(response([fill], { next: 'second' }))
        .mockResolvedValueOnce(response([fill], { indexed: { ...indexed, blockHash: hash(101 + attempt) } }));
    }
    await expect(fetchFactoryFills({ identity, market, options: { baseUrl, fetch, maxPages: 50, snapshotAttempts: 3 } })).rejects.toThrow('snapshot moved');
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it.each([0, -1, 1.5, NaN, Infinity])('rejects an invalid attempt bound before making requests: %s', async snapshotAttempts => {
    const fetch = vi.fn();
    await expect(fetchFactoryFills({ identity, market, options: { baseUrl, fetch, snapshotAttempts } })).rejects.toThrow('attempt bound');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not restart HTTP failures, invalid data or strict page exhaustion', async () => {
    for (const result of [
      new Response('{}', { status: 503 }),
      response([{ ...fill, amount: '-1' }]),
      response([fill], { next: '' }),
      response([fill], { next: 'more' }),
    ]) {
      const fetch = vi.fn().mockResolvedValueOnce(result);
      await expect(fetchFactoryFills({ identity, market, options: { baseUrl, fetch, maxPages: 1, snapshotAttempts: 3 } })).rejects.toThrow();
      expect(fetch).toHaveBeenCalledTimes(1);
    }
  });
});

describe('Factory bounded recent fills', () => {
  it('returns the last 400 visited fills after five pages with the unread cursor', async () => {
    const fetch = vi.fn();
    for (let page = 0; page < 5; page++) fetch.mockResolvedValueOnce(response(fillBatch(page * 200 + 1), { next: `page ${page + 2}` }));
    const result = await fetchFactoryRecentFills({ identity, market, maker: account, taker: fill.taker, options: { baseUrl, fetch } });
    expect(result).toMatchObject({ indexed, complete: false, next: 'page 6' });
    expect(result.items.map(item => item.orderId)).toEqual(Array.from({ length: 400 }, (_, i) => BigInt(601 + i)));
    expect(fetch).toHaveBeenCalledTimes(5);
    const urls = fetch.mock.calls.map(([url]) => new URL(String(url)));
    expect(urls[0]!.searchParams.get('limit')).toBe('200');
    expect(urls[0]!.searchParams.get('market')).toBe(market);
    expect(urls[0]!.searchParams.get('maker')).toBe(account);
    expect(urls[0]!.searchParams.get('taker')).toBe(fill.taker);
    expect(urls.map(url => url.searchParams.get('cursor'))).toEqual([null, 'page 2', 'page 3', 'page 4', 'page 5']);
  });

  it('reports source exhaustion on the last allowed page while retaining only the requested tail', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(fillBatch(1, 3), { next: 'second' }))
      .mockResolvedValueOnce(response(fillBatch(4, 3)));
    const result = await fetchFactoryRecentFills({ identity, market, maxItems: 2, options: { baseUrl, fetch, maxPages: 2 } });
    expect(result).toMatchObject({ complete: true, next: null });
    expect(result.items.map(item => item.orderId)).toEqual([5n, 6n]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('follows an empty page with a cursor and preserves actual fill timestamps', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response([], { next: 'after empty' }))
      .mockResolvedValueOnce(response([
        { ...fill, timestamp: 999, blockTimestamp: 123 },
        { ...fill, timestamp: null, blockTimestamp: 123 },
        { ...fill, timestamp: 0, blockTimestamp: 123 },
      ]));
    const result = await fetchFactoryRecentFills({ identity, market, options: { baseUrl, fetch } });
    expect(result).toMatchObject({ complete: true, next: null });
    expect(result.items.map(item => item.timestamp)).toEqual([999, null, 0]);
    expect(result.items[0]).toMatchObject({ amount: 10n ** 18n, cashReserved: 400_000n, blockHash: location.blockHash });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('returns a complete empty source', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response([]));
    expect(await fetchFactoryRecentFills({ identity, market, options: { baseUrl, fetch } })).toEqual({ indexed, items: [], complete: true, next: null });
  });

  it('discards the prior window when a snapshot restart is enabled', async () => {
    const replacement = { ...indexed, blockNumber: 101, blockHash: hash(101), timestamp: 1_001 };
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(fillBatch(1, 2), { next: 'second' }))
      .mockResolvedValueOnce(response(fillBatch(3, 2), { indexed: replacement }))
      .mockResolvedValueOnce(response(fillBatch(9, 2), { indexed: replacement, next: 'second' }))
      .mockResolvedValueOnce(response(fillBatch(11, 1), { indexed: replacement, next: 'third' }));
    const result = await fetchFactoryRecentFills({ identity, market, maxItems: 2, options: { baseUrl, fetch, maxPages: 2, snapshotAttempts: 2 } });
    expect(result).toMatchObject({ indexed: replacement, complete: false, next: 'third' });
    expect(result.items.map(item => item.orderId)).toEqual([10n, 11n]);
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('rejects repeated cursors even at the window page cap', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response([fill], { next: 'repeat' }))
      .mockResolvedValueOnce(response([fill], { next: 'repeat' }));
    await expect(fetchFactoryRecentFills({ identity, market, options: { baseUrl, fetch, maxPages: 2 } })).rejects.toThrow('cursor');
  });

  it.each([
    { timestamp: undefined, blockTimestamp: 999 },
    { timestamp: -1 },
    { market: address(9) },
    { amount: 'invalid' },
  ])('keeps strict wire parsing in bounded windows: %j', async changes => {
    const fetch = vi.fn().mockResolvedValueOnce(response([{ ...fill, ...changes }], { next: 'unread' }));
    await expect(fetchFactoryRecentFills({ identity, market, options: { baseUrl, fetch, maxPages: 1 } })).rejects.toThrow();
  });

  it.each([0, -1, 1.5, NaN, Infinity])('rejects an invalid window size before making requests: %s', async maxItems => {
    const fetch = vi.fn();
    await expect(fetchFactoryRecentFills({ identity, market, maxItems, options: { baseUrl, fetch } })).rejects.toThrow('item bound');
    expect(fetch).not.toHaveBeenCalled();
  });
});
