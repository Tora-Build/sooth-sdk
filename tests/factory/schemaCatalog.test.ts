import { describe, expect, it, vi } from 'vitest';
import { FactoryCatalogError, fetchFactoryCatalogMarkets, type FactoryCatalogOptions } from '../../src/factory/factoryCatalog.js';
import { factoryMarketKey, parseFactoryCatalogMarket, parseFactoryCatalogNode, parseFactoryCatalogOverrides, type FactoryIdentity, type FactoryIndexedAt } from '../../src/factory/schema.js';
import fixture from './fixtures/indexer-markets.json';

const identity: FactoryIdentity = {
  chainId: 11155111,
  factory: '0x67926f892caba6a8b96ee45b0c927031371c9e85',
  nodeId: '0xc969cde7d701eb503ecac9c55de380ec2cd7b5e1333c4506872d99106f6b7dfb',
};
const indexed = fixture.indexed as FactoryIndexedAt;
const later: FactoryIndexedAt = { ...indexed, blockNumber: indexed.blockNumber + 1, blockHash: `0x${'22'.repeat(32)}`, timestamp: indexed.timestamp + 1 };
const raw = fixture.items[0]!;
const listing = { state: 'listed', source: 'default', reason: null, actor: null, at: null };
const item = (at = indexed, address = raw.address) => ({
  ...raw, address, identity, indexed: at,
  key: factoryMarketKey(identity, address as `0x${string}`),
  listing, listings: { node: null, market: null },
});
const page = (items: unknown[], next: string | null, extra: Record<string, unknown> = {}) => ({
  catalogRevision: 'r1', facts: { source: 'live', ageSeconds: 0 },
  overrides: { source: 'live', revision: 'r1', ageSeconds: 0 }, indexed, items, next, ...extra,
});
const response = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });
const baseUrl = 'https://registry.example';

// Ported from Market's registry source behavior tests.
describe('catalog HTTP errors', () => {
  it.each([
    [404, 'not_found', 'Catalog not available'],
    [503, 'unavailable', 'Catalog not available'],
    [502, 'bad_upstream', 'did not validate'],
    [501, 'unsupported_release', 'Unsupported release'],
    [400, 'invalid_request', 'HTTP 400'],
    [500, 'other', 'HTTP 500'],
  ] as const)('retains status %s and its %s error state', async (status, kind, message) => {
    const fetch = vi.fn().mockResolvedValue(response({}, status, status === 503 ? { 'retry-after': '10' } : {}));
    const error: unknown = await fetchFactoryCatalogMarkets(identity, { baseUrl, fetch }).catch(error => error);
    expect(error).toBeInstanceOf(FactoryCatalogError);
    expect(error).toMatchObject({ status, kind, retryAfterSeconds: status === 503 ? 10 : null, body: {} });
    expect((error as Error).message).toContain(message);
  });
  it('prefers a recognized body kind and explicit message while retaining the payload', async () => {
    const body = { error: 'unsupported_release', interfaceVersion: 'sooth-factory-v8', message: 'Release v8 needs a newer reader' };
    const fetch = vi.fn().mockResolvedValue(response(body, 503, { 'retry-after': '-1' }));
    await expect(fetchFactoryCatalogMarkets(identity, { baseUrl, fetch })).rejects.toMatchObject({ kind: 'unsupported_release', message: body.message, status: 503, retryAfterSeconds: null, body });
  });
  it('keeps malformed error bodies as HTTP errors without retrying discovery', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response('<html>outage</html>', { status: 503 }));
    await expect(fetchFactoryCatalogMarkets(identity, { baseUrl, fetch, snapshotAttempts: 3 })).rejects.toMatchObject({ kind: 'unavailable', body: null });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe('catalog page freshness', () => {
  it('merges empty pages, differing revisions and snapshots only when explicitly requested', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(page([item()], 'a', { overrides: { source: 'last-known-good', revision: 'old', ageSeconds: 900 } })))
      .mockResolvedValueOnce(response(page([], 'b', { catalogRevision: 'r2', indexed: later, facts: { source: 'last-known-good', ageSeconds: 42 }, overrides: { source: 'live', revision: 'new', ageSeconds: 0 } })))
      .mockResolvedValueOnce(response(page([item(later, `0x${'33'.repeat(20)}`)], null, { catalogRevision: 'r3', indexed: later, overrides: { source: 'live', revision: 'newer', ageSeconds: 1000 } })));
    const result = await fetchFactoryCatalogMarkets(identity, { baseUrl, fetch, pageConsistency: 'merge-freshness' });
    expect(result.items).toHaveLength(2);
    expect(result.items[0]!.indexed).toEqual(indexed);
    expect(result.items[1]!.indexed).toEqual(later);
    expect(result.indexed).toEqual(later);
    expect(result.catalogRevision).toBe('r3');
    expect(result.facts).toEqual({ source: 'last-known-good', ageSeconds: 42 });
    expect(result.overrides).toEqual({ source: 'last-known-good', revision: 'old', ageSeconds: 1000 });
    expect(result.next).toBeNull();
    expect(fetch.mock.calls.map(([url]) => new URL(url).searchParams.get('cursor'))).toEqual([null, 'a', 'b']);
  });
  it('keeps unavailable as the weakest source and takes the newest revision on ties', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(page([], 'a', { overrides: { source: 'unavailable', revision: 'old', ageSeconds: null } })))
      .mockResolvedValueOnce(response(page([], null, { catalogRevision: 'r2', overrides: { source: 'unavailable', revision: null, ageSeconds: 7 } })));
    const result = await fetchFactoryCatalogMarkets(identity, { baseUrl, fetch, pageConsistency: 'merge-freshness' });
    expect(result.overrides).toEqual({ source: 'unavailable', revision: null, ageSeconds: 7 });
  });
  it('retains strict snapshot consistency by default', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response(page([], 'a')))
      .mockResolvedValueOnce(response(page([], null, { catalogRevision: 'r2' })));
    await expect(fetchFactoryCatalogMarkets(identity, { baseUrl, fetch })).rejects.toThrow('snapshot moved');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

const indexerOptions: FactoryCatalogOptions = {
  baseUrl, source: 'indexer', snapshotAttempts: 3, maxPages: 50,
  overrides: parseFactoryCatalogOverrides({ schemaVersion: 1, revision: 'local', nodes: [], markets: [] }),
  releases: [],
  indexerAdapter: {
    node: input => parseFactoryCatalogNode(input.item),
    market: input => parseFactoryCatalogMarket({ ...input.item as object, identity: input.identity, indexed: input.indexed, key: factoryMarketKey(input.identity, (input.item as typeof raw).address as `0x${string}`), listing, listings: { node: null, market: null } }),
  },
};

describe('bounded catalog snapshot restarts', () => {
  it('discards prior attempt items and cursors before reading a fresh indexer snapshot', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(response({ indexed, items: [raw], next: 'a' }))
      .mockResolvedValueOnce(response({ indexed: later, items: [], next: null }))
      .mockResolvedValueOnce(response({ indexed: later, items: [raw], next: null }));
    const result = await fetchFactoryCatalogMarkets(identity, { ...indexerOptions, fetch });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]!.indexed).toEqual(later);
    expect(fetch.mock.calls.map(([url]) => new URL(url).searchParams.get('cursor'))).toEqual([null, 'a', null]);
  });
  it('fails at the configured attempt bound without returning partial results', async () => {
    const fetch = vi.fn(async (url: string) => response(new URL(url).searchParams.has('cursor')
      ? { indexed: later, items: [], next: null }
      : { indexed, items: [raw], next: 'a' }));
    await expect(fetchFactoryCatalogMarkets(identity, { ...indexerOptions, fetch })).rejects.toThrow('snapshot moved');
    expect(fetch).toHaveBeenCalledTimes(6);
  });
  it('does not restart invalid cursors and validates the attempt bound before fetching', async () => {
    const fetch = vi.fn().mockResolvedValue(response({ indexed, items: [], next: '' }));
    await expect(fetchFactoryCatalogMarkets(identity, { ...indexerOptions, fetch })).rejects.toThrow('cursor');
    expect(fetch).toHaveBeenCalledTimes(1);
    await expect(fetchFactoryCatalogMarkets(identity, { ...indexerOptions, fetch, snapshotAttempts: 0 })).rejects.toThrow('attempt bound');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
