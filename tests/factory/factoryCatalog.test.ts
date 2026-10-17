import { describe, expect, it, vi } from 'vitest';
import type { Address, Hex } from 'viem';
import { fetchFactoryCatalogMarkets, fetchFactoryIndexedDepth, fetchFactoryTrades, factoryMarketKey, assertFactoryCatalogNewExposure, type FactoryIdentity, type FactoryNodeContext, type FactoryCatalogMarket, type FactoryCatalogPage } from '../../src/factory/factoryClient.js';
import { deriveNodeChildren } from '../../src/factory/factoryTrade.js';
import { parseFactoryCatalogMarket, parseFactoryCatalogOverrides } from '../../src/factory/schema.js';
import editorialSeed from './fixtures/catalog-overrides.json';
import fixture from './fixtures/indexer-markets.json';
const identity: FactoryIdentity = { chainId: 11155111, factory: '0x67926f892caba6a8b96ee45b0c927031371c9e85', nodeId: '0xc969cde7d701eb503ecac9c55de380ec2cd7b5e1333c4506872d99106f6b7dfb' };
const raw = fixture.items[0]!;
const market = raw.address as Address;
const item = { ...raw, identity, key: factoryMarketKey(identity, market), indexed: fixture.indexed, listing: { state: 'listed', reason: null, actor: null, at: null, source: 'node' }, listings: { node: null, market: null } };
const envelope = { indexed: fixture.indexed, catalogRevision: '1', facts: { source: 'live', ageSeconds: 0 }, overrides: { source: 'live', revision: '1', ageSeconds: 0 }, items: [item], next: null };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const context: FactoryNodeContext = { ...identity, release: { ...identity, releaseId: fixture.indexed.blockHash as Hex, interfaceVersion: 'test', startBlock: 1 }, contracts: { ...deriveNodeChildren(identity.factory), deployer: identity.factory }, startBlock: 1n, blockNumber: BigInt(fixture.indexed.blockNumber) };
const receivedAt = 1_000_000;
const policy = { context, now: receivedAt, liveBlock: { number: context.blockNumber, timestamp: BigInt(fixture.indexed.timestamp) } };
const page = (changes: Record<string, unknown> = {}) => ({ ...envelope, receivedAt, ...changes }) as FactoryCatalogPage<FactoryCatalogMarket> & { receivedAt: number };
describe('Factory catalog and indexed adapters', () => {
  it('authorizes a fresh listed exact-identity market with explicit age and lag bounds', () => {
    expect(assertFactoryCatalogNewExposure(page(), market, policy).address).toBe(market);
    expect(() => assertFactoryCatalogNewExposure(page(), market, { ...policy, maxAgeSeconds: -1 })).toThrow();
    expect(() => assertFactoryCatalogNewExposure(page(), identity.factory, policy)).toThrow();
    expect(() => assertFactoryCatalogNewExposure(page({ items: [{ ...item, listing: { ...item.listing, state: 'unlisted' } }] }), market, policy)).toThrow();
  });
  it('enforces explicit head age/lag budgets and rejects future timestamps', () => {
    expect(() => assertFactoryCatalogNewExposure(page(), market, { ...policy, maxIndexedAgeSeconds: 120, liveBlock: { ...policy.liveBlock, timestamp: policy.liveBlock.timestamp + 86_400n } })).toThrow();
    expect(() => assertFactoryCatalogNewExposure(page(), market, { ...policy, maxLagBlocks: 12, liveBlock: { ...policy.liveBlock, number: policy.liveBlock.number + 13n } })).toThrow();
    // The existing release has no default indexed-head age ceiling.
    expect(assertFactoryCatalogNewExposure(page(), market, { ...policy, liveBlock: { ...policy.liveBlock, timestamp: policy.liveBlock.timestamp + 86_400n } }).address).toBe(market);
    expect(() => assertFactoryCatalogNewExposure(page({ indexed: { ...fixture.indexed, timestamp: fixture.indexed.timestamp + 1 } }), market, policy)).toThrow();
    expect(() => assertFactoryCatalogNewExposure(page(), market, { ...policy, liveBlock: { ...policy.liveBlock, number: context.blockNumber - 1n } })).toThrow();
  });
  it('rejects missing, nonfinite, negative, or expired editorial age and missing revision', () => {
    for (const ageSeconds of [undefined, null, NaN, Infinity, -1, 601]) {
      expect(() => assertFactoryCatalogNewExposure(page({ overrides: { ...envelope.overrides, ageSeconds } }), market, policy)).toThrow();
    }
    for (const revision of [undefined, null, '', ' ']) {
      expect(() => assertFactoryCatalogNewExposure(page({ overrides: { ...envelope.overrides, revision } }), market, policy)).toThrow();
    }
  });
  it('permits controlled LKG under 600 seconds and retains expired data for exits', async () => {
    const fetch = vi.fn().mockResolvedValue(response({ ...envelope, facts: { source: 'last-known-good', ageSeconds: 4 }, overrides: { ...envelope.overrides, source: 'last-known-good' } }));
    const result = await fetchFactoryCatalogMarkets(identity, { baseUrl: 'https://catalog.example', fetch });
    expect(result.items[0]!.address).toBe(market);
    expect(result.facts.source).toBe('last-known-good');
    expect(assertFactoryCatalogNewExposure(result, market, { ...policy, now: result.receivedAt + 596_000 }).address).toBe(market);
    expect(() => assertFactoryCatalogNewExposure(result, market, { ...policy, now: result.receivedAt + 596_001 })).toThrow();
    expect(result.items[0]!.address).toBe(market);
  });
  it('preserves the worst editorial age across pages with the same revision', async () => {
    for (const ageSeconds of [601, null]) {
      const fetch = vi.fn().mockResolvedValueOnce(response({ ...envelope, items: [], next: '2' })).mockResolvedValueOnce(response({ ...envelope, overrides: { ...envelope.overrides, ageSeconds } }));
      const result = await fetchFactoryCatalogMarkets(identity, { baseUrl: 'https://catalog.example', fetch });
      expect(result.overrides.ageSeconds).toBe(ageSeconds);
      expect(() => assertFactoryCatalogNewExposure(result, market, { ...policy, now: result.receivedAt })).toThrow();
    }
  });
  it('requires real client receipt time and counts client-held age for live policy', () => {
    for (const invalid of [undefined, null, NaN, Infinity, -1, receivedAt + 1]) {
      expect(() => assertFactoryCatalogNewExposure(page({ receivedAt: invalid }), market, policy)).toThrow();
    }
    expect(() => assertFactoryCatalogNewExposure(page(), market, { ...policy, now: receivedAt + 600_001 })).toThrow();
  });
  it('propagates node disabled state and rejects market identity substitution', () => {
    expect(() => assertFactoryCatalogNewExposure(page({ items: [{ ...item, listings: { ...item.listings, node: { state: 'disabled' } } }] }), market, policy)).toThrow();
    expect(() => assertFactoryCatalogNewExposure(page({ items: [{ ...item, identity: { ...identity, nodeId: `0x${'01'.repeat(32)}` } }] }), market, policy)).toThrow();
  });
  it('does not represent static indexer editorial seeds as fresh live policy', async () => {
    const fetch = vi.fn().mockResolvedValue(response({ ...fixture, next: null }));
    const indexerAdapter = {
      node: vi.fn(() => { throw new Error('Market discovery must not compose a node'); }),
      market: vi.fn(({ item: record, indexed, identity: nodeIdentity }: Parameters<NonNullable<Parameters<typeof fetchFactoryCatalogMarkets>[1]['indexerAdapter']>['market']>[0]) => parseFactoryCatalogMarket({
        ...record, identity: nodeIdentity, key: factoryMarketKey(nodeIdentity, market), indexed,
        listing: item.listing, listings: item.listings,
      })),
    } satisfies NonNullable<Parameters<typeof fetchFactoryCatalogMarkets>[1]['indexerAdapter']>;
    const result = await fetchFactoryCatalogMarkets(identity, { baseUrl: 'https://indexer.example', source: 'indexer', indexerAdapter, overrides: parseFactoryCatalogOverrides(editorialSeed), releases: [], fetch });
    expect(indexerAdapter.market).toHaveBeenCalledWith(expect.objectContaining({ identity, item: raw, indexed: fixture.indexed }));
    expect(indexerAdapter.node).not.toHaveBeenCalled();
    expect(result.overrides).toMatchObject({ source: 'unavailable', ageSeconds: null });
    expect(result.facts.ageSeconds).toBe(Math.max(0, result.receivedAt / 1000 - fixture.indexed.timestamp));
    expect(() => assertFactoryCatalogNewExposure(result, market, { ...policy, now: result.receivedAt })).toThrow();
  });
  it('follows empty filtered pages and preserves exact identity', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response({ ...envelope, items: [], next: 'second' })).mockResolvedValueOnce(response(envelope));
    const page = await fetchFactoryCatalogMarkets(identity, { baseUrl: 'https://catalog.example', fetch });
    expect(page.items[0]!.key).toBe(item.key); expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[1]![0])).toContain('cursor=second');
  });
  it('rejects another identity even when the chain is the same', async () => {
    const fetch = vi.fn().mockResolvedValue(response({ ...envelope, items: [{ ...item, identity: { ...identity, nodeId: `0x${'00'.repeat(32)}` as Hex } }] }));
    await expect(fetchFactoryCatalogMarkets(identity, { baseUrl: 'https://catalog.example', fetch })).rejects.toThrow();
  });
  it('refuses snapshot drift and page exhaustion', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response({ ...envelope, next: '2' })).mockResolvedValueOnce(response({ ...envelope, catalogRevision: '2' }));
    await expect(fetchFactoryCatalogMarkets(identity, { baseUrl: 'https://catalog.example', fetch })).rejects.toThrow();
    const bounded = vi.fn().mockResolvedValue(response({ ...envelope, next: '2' }));
    await expect(fetchFactoryCatalogMarkets(identity, { baseUrl: 'https://catalog.example', fetch: bounded, maxPages: 1 })).rejects.toThrow();
  });
  it('does not replace an unavailable catalog with an empty list', async () => {
    await expect(fetchFactoryCatalogMarkets(identity, { baseUrl: 'https://catalog.example', fetch: vi.fn().mockResolvedValue(response({}, 503)) })).rejects.toThrow();
  });
  it('rejects a missing terminal cursor and oversized catalog pages', async () => {
    for (const data of [{ ...envelope, next: undefined }, { ...envelope, items: Array(201).fill(item) }]) {
      await expect(fetchFactoryCatalogMarkets(identity, { baseUrl: 'https://catalog.example', fetch: vi.fn().mockResolvedValue(response(data)) })).rejects.toThrow();
    }
  });
  it('rejects repeated market identities rather than double-counting portfolios', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response({ ...envelope, next: '2' })).mockResolvedValueOnce(response(envelope));
    await expect(fetchFactoryCatalogMarkets(identity, { baseUrl: 'https://catalog.example', fetch })).rejects.toThrow();
  });
  it('rejects inconsistent item snapshots and same-hash block-number substitution', async () => {
    const altered = { ...fixture.indexed, blockNumber: fixture.indexed.blockNumber + 1 };
    const fetch = vi.fn().mockResolvedValue(response({ ...envelope, items: [{ ...item, indexed: altered }] }));
    await expect(fetchFactoryCatalogMarkets(identity, { baseUrl: 'https://catalog.example', fetch })).rejects.toThrow();
    fetch.mockReset().mockResolvedValueOnce(response({ ...envelope, next: '2' })).mockResolvedValueOnce(response({ ...envelope, indexed: altered }));
    await expect(fetchFactoryCatalogMarkets(identity, { baseUrl: 'https://catalog.example', fetch })).rejects.toThrow();
  });
  it('decodes v2 depth in WAD and refuses out-of-range ticks', async () => {
    const fetch = vi.fn().mockResolvedValue(response({ indexed: fixture.indexed, bids: [{ yesTick: 400, amount: '1000000000000000000', orders: 2 }], asks: [] }));
    const depth = await fetchFactoryIndexedDepth({ identity, market, options: { baseUrl: 'https://indexer.example', fetch } });
    expect(depth.levels).toEqual([{ side: 0, yesTick: 400, amountWad: 10n ** 18n, orderCount: 2n }]);
    fetch.mockResolvedValue(response({ indexed: fixture.indexed, bids: [{ yesTick: 1000, amount: '1', orders: 1 }], asks: [] }));
    await expect(fetchFactoryIndexedDepth({ identity, market, options: { baseUrl: 'https://indexer.example', fetch } })).rejects.toThrow();
    fetch.mockResolvedValue(response({ indexed: fixture.indexed, bids: [{ yesTick: 400, amount: '1', orders: 1 }, { yesTick: 400, amount: '1', orders: 1 }], asks: [] }));
    await expect(fetchFactoryIndexedDepth({ identity, market, options: { baseUrl: 'https://indexer.example', fetch } })).rejects.toThrow();
    fetch.mockResolvedValue(response({ indexed: fixture.indexed, bids: [{ yesTick: 400, amount: (1n << 256n).toString(), orders: 1 }], asks: [] }));
    await expect(fetchFactoryIndexedDepth({ identity, market, options: { baseUrl: 'https://indexer.example', fetch } })).rejects.toThrow();
  });
  it('reads existing v2 trade history and keeps six-decimal collateral cost in WAD', async () => {
    const trade = { market, account: raw.creator, outcome: 0, side: 'buy', shares: '1000000000000000000', cost: '500000000000000000', averagePrice: '500000000000000000', qYes: '0', qNo: '1000000000000000000', blockNumber: 10, logIndex: 1, blockHash: fixture.indexed.blockHash, transactionHash: fixture.indexed.blockHash, timestamp: 123 };
    const fetch = vi.fn().mockResolvedValue(response({ indexed: fixture.indexed, items: [trade], next: null }));
    const page = await fetchFactoryTrades({ identity, market, options: { baseUrl: 'https://indexer.example', fetch } });
    expect(page.items[0]!.cost).toBe(500_000_000_000_000_000n);
    expect(String(fetch.mock.calls[0]![0])).toContain('/trades?');
    fetch.mockResolvedValue(response({ indexed: fixture.indexed, items: [{ ...trade, market: identity.factory }], next: null }));
    await expect(fetchFactoryTrades({ identity, market, options: { baseUrl: 'https://indexer.example', fetch } })).rejects.toThrow();
    fetch.mockImplementation(async () => response({ indexed: fixture.indexed, items: [], next: 'repeat' }));
    await expect(fetchFactoryTrades({ identity, market, options: { baseUrl: 'https://indexer.example', fetch } })).rejects.toThrow();
    fetch.mockImplementation(async () => response({ indexed: fixture.indexed, items: [] }));
    await expect(fetchFactoryTrades({ identity, market, options: { baseUrl: 'https://indexer.example', fetch } })).rejects.toThrow();
  });
});
