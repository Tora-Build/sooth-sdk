import { describe, expect, it, vi } from 'vitest';
import type { Address, Hex } from 'viem';
import {
  fetchFactoryFills,
  fetchFactoryIndexedInventory,
  fetchFactoryIndexedOrders,
  fetchFactoryPrices,
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
const inventory = {
  market, account, venue: 'book', yesOwned: '2000000000000000000', noOwned: '1000000000000000000',
  yesReserved: '1000000000000000000', noReserved: '0', cashReserved: '400000',
};
const fill = {
  ...location, market, maker: account, taker: address(4), orderId: '7', amount: '1000000000000000000',
  remaining: '1000000000000000000', cashReserved: '400000', yesTick: 400, settlementType: 0,
};
const price = { ...location, market, price: '400000000000000000', qYes: '2000000000000000000', qNo: '1000000000000000000' };
const response = (items: unknown[], changes: Record<string, unknown> = {}) => new Response(JSON.stringify({ indexed, items, next: null, ...changes }));
const optionsFor = (items: unknown[]) => ({ baseUrl: 'https://indexer.example/', fetch: vi.fn().mockResolvedValue(response(items)) });

describe('Factory indexed orders', () => {
  it('scopes discovery to the explicit endpoint, exact node, wallet and market', async () => {
    const options = optionsFor([order]);
    const result = await fetchFactoryIndexedOrders({ identity, market, account, options });
    expect(result).toMatchObject({ indexed, next: null, complete: true });
    expect(result.items).toEqual([{
      ...order, orderId: 7n, amount: 2n * 10n ** 18n, remaining: 10n ** 18n, cashReserved: 400_000n, expiry: 0n,
    }]);
    const url = new URL(String(options.fetch.mock.calls[0]![0]));
    expect(url.origin).toBe('https://indexer.example');
    expect(url.pathname).toBe(`/v2/chains/${identity.chainId}/factories/${identity.factory.toLowerCase()}/nodes/${identity.nodeId}/orders`);
    expect(Object.fromEntries(url.searchParams)).toEqual({ limit: '200', market, maker: account, resting: 'true' });
  });

  it('returns a complete empty page and permits requesting nonresting history', async () => {
    const options = optionsFor([]);
    expect(await fetchFactoryIndexedOrders({ identity, market, account, resting: false, options })).toEqual({ indexed, items: [], next: null, complete: true });
    expect(new URL(String(options.fetch.mock.calls[0]![0])).searchParams.get('resting')).toBe('false');
  });

  it('follows empty pages and preserves large order ids without numeric rounding', async () => {
    const options = optionsFor([]);
    options.fetch.mockReset()
      .mockResolvedValueOnce(response([], { next: 'a b' }))
      .mockResolvedValueOnce(response([{ ...order, orderId: '9007199254740993' }]));
    const result = await fetchFactoryIndexedOrders({ identity, market, account, options });
    expect(result.items[0]!.orderId).toBe(9_007_199_254_740_993n);
    expect(options.fetch).toHaveBeenCalledTimes(2);
    expect(new URL(String(options.fetch.mock.calls[1]![0])).searchParams.get('cursor')).toBe('a b');
  });

  it('retains cancellation evidence and decodes refunded native cash', async () => {
    const cancelled = { blockNumber: 100, logIndex: 3, transactionHash: hash(97), amount: '1000000000000000000', cashRefund: '400000' };
    const options = optionsFor([{ ...order, status: 'cancelled', remaining: '0', cashReserved: '0', cancelled, updatedBlock: 100 }]);
    const result = await fetchFactoryIndexedOrders({ identity, market, account, resting: false, options });
    expect(result.items[0]).toMatchObject({
      status: 'cancelled', placed: location, remaining: 0n, cashReserved: 0n, updatedBlock: 100,
      cancelled: { ...cancelled, amount: 10n ** 18n, cashRefund: 400_000n },
    });
  });

  it.each([
    { maker: address(9) }, { market: address(9) }, { orderId: '0x7' }, { orderId: '-1' },
    { orderId: 7 }, { amount: (1n << 256n).toString() }, { yesTick: 0 }, { yesTick: 1000 },
    { action: 'transfer' }, { side: 'buy' }, { outcome: 2 },
    { status: 'resting' }, { placed: null }, { cancelled: {} }, { updatedBlock: -1 },
  ])('rejects malformed or substituted orders: %j', async changes => {
    await expect(fetchFactoryIndexedOrders({ identity, market, account, options: optionsFor([{ ...order, ...changes }]) })).rejects.toThrow();
  });

  it('refuses pages from different snapshots, including a reused block hash', async () => {
    for (const changed of [{ blockNumber: 101 }, { blockHash: hash(101) }, { timestamp: 1_001 }]) {
      const options = optionsFor([]);
      options.fetch.mockReset()
        .mockResolvedValueOnce(response([], { next: 'second' }))
        .mockResolvedValueOnce(response([order], { indexed: { ...indexed, ...changed } }));
      await expect(fetchFactoryIndexedOrders({ identity, market, account, options })).rejects.toThrow();
    }
  });

  it('refuses absent, invalid or repeated cursors and bounded partial results', async () => {
    for (const next of [undefined, '', 2, 'repeat']) {
      const options = optionsFor([]);
      options.fetch.mockImplementation(async () => response([], { next }));
      await expect(fetchFactoryIndexedOrders({ identity, market, account, options })).rejects.toThrow();
    }
    const options = optionsFor([]);
    options.fetch.mockImplementation(async () => response([order], { next: 'more' }));
    await expect(fetchFactoryIndexedOrders({ identity, market, account, options: { ...options, maxPages: 1 } })).rejects.toThrow();
    expect(options.fetch).toHaveBeenCalledTimes(1);
  });

  it('propagates failed requests and refuses oversized pages', async () => {
    const options = optionsFor([]);
    options.fetch.mockResolvedValue(new Response('{}', { status: 503 }));
    await expect(fetchFactoryIndexedOrders({ identity, market, account, options })).rejects.toThrow();
    options.fetch.mockResolvedValue(response(Array(201).fill(order)));
    await expect(fetchFactoryIndexedOrders({ identity, market, account, options })).rejects.toThrow();
  });
});

describe('Factory indexed inventory, fills and prices', () => {
  it('keeps share balances in WAD and reserved cash in native units', async () => {
    const options = optionsFor([inventory]);
    const result = await fetchFactoryIndexedInventory({ identity, market, account, options });
    expect(result.items).toEqual([{
      ...inventory, yesOwned: 2n * 10n ** 18n, noOwned: 10n ** 18n,
      yesReserved: 10n ** 18n, noReserved: 0n, cashReserved: 400_000n,
    }]);
    const url = new URL(String(options.fetch.mock.calls[0]![0]));
    expect(url.searchParams.get('account')).toBe(account);
    expect(url.searchParams.get('market')).toBe(market);
  });

  it('rejects another account, market or unknown inventory venue', async () => {
    for (const changes of [{ account: address(9) }, { market: address(9) }, { venue: 'other' }]) {
      await expect(fetchFactoryIndexedInventory({ identity, market, account, options: optionsFor([{ ...inventory, ...changes }]) })).rejects.toThrow();
    }
  });

  it('preserves fill identity, native cash, WAD size and transaction location', async () => {
    const options = optionsFor([fill]);
    const result = await fetchFactoryFills({ identity, market, maker: account, taker: fill.taker, options });
    expect(result.items).toEqual([{
      ...fill, orderId: 7n, amount: 10n ** 18n, remaining: 10n ** 18n, cashReserved: 400_000n,
    }]);
    const url = new URL(String(options.fetch.mock.calls[0]![0]));
    expect(url.searchParams.get('maker')).toBe(account);
    expect(url.searchParams.get('taker')).toBe(fill.taker);
    for (const changes of [{ market: address(9) }, { maker: address(9) }, { taker: address(9) }, { settlementType: 4 }]) {
      await expect(fetchFactoryFills({ identity, market, maker: account, taker: fill.taker, options: optionsFor([{ ...fill, ...changes }]) })).rejects.toThrow();
    }
  });

  it('decodes historical prices in WAD and rejects another market', async () => {
    const options = optionsFor([price]);
    const result = await fetchFactoryPrices({ identity, market, options });
    expect(result.items[0]).toMatchObject({
      market, price: 400_000_000_000_000_000n, qYes: 2n * 10n ** 18n, qNo: 10n ** 18n,
      blockNumber: 99, logIndex: 2, blockHash: location.blockHash, timestamp: 999,
    });
    expect(new URL(String(options.fetch.mock.calls[0]![0])).pathname.endsWith(`/markets/${market}/prices`)).toBe(true);
    await expect(fetchFactoryPrices({ identity, market, options: optionsFor([{ ...price, market: address(9) }]) })).rejects.toThrow();
  });
});
