import { describe, expect, it } from 'vitest';
import {
  factoryDataPath, factoryMarketKey, factoryNodeKey, parseFactoryCatalogMarket,
  parseFactoryCatalogNode, parseFactoryCatalogNodeRecord, parseFactoryCatalogOverrides,
  parseFactoryIndexedAt, parseFactoryListing, parseFactoryMarketRecord,
  parseFactoryNodeMetadata, parseFactoryNodeRecord, parseFactoryNodeState,
  parseFactoryRelease, parseFactoryReleaseSeeds, type FactoryIdentity,
} from '../../src/factory/schema.js';
import { supportedRelease } from './fixtures/release.js';
import markets from './fixtures/indexer-markets.json';

const address = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as const;
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as const;
const release = parseFactoryRelease(supportedRelease);
const identity: FactoryIdentity = { chainId: release.chainId, factory: release.factory, nodeId: hash(1) };
const indexed = parseFactoryIndexedAt(markets.indexed);
const node = {
  ...identity, protocol: 'sooth-factory', releaseId: release.releaseId,
  interfaceVersion: release.interfaceVersion,
  contracts: { deployer: address(1), roles: address(2), marketFactory: address(3), amm: address(4), book: address(5), ammVault: address(6), bookVault: address(7), positionManager: address(8), truthImplementation: address(9) },
  bookToken: { address: address(10), decimals: 6 }, nodeAdmin: address(11), protocolAuthority: address(12),
  activation: { blockNumber: 10, blockHash: hash(10), transactionHash: hash(11), logIndex: 0 },
};
const listing = { state: 'disabled', reason: 'Exits remain available', actor: 'ops', at: null };
const catalogNode = {
  key: factoryNodeKey(identity), node, indexed, release, state: null,
  interface: { label: release.interfaceVersion, supported: true },
  status: { verification: 'verified', indexing: 'ready' },
  metadata: { label: 'Example' }, listing: { ...listing, source: 'node' },
};
const marketRecord = markets.items[0]!;
const catalogMarket = {
  ...marketRecord, identity, indexed,
  key: factoryMarketKey(identity, marketRecord.address as `0x${string}`),
  listing: { ...listing, source: 'node' }, listings: { node: listing, market: null },
};

// Behavioral cases extracted from the registry's factory and catalog schema suites.
describe('Factory identity and release wire contracts', () => {
  it('normalizes addresses without losing chain, factory or full node scope', () => {
    expect(factoryNodeKey(identity)).not.toBe(factoryNodeKey({ ...identity, chainId: 1 }));
    expect(factoryNodeKey(identity)).not.toBe(factoryNodeKey({ ...identity, factory: address(99) }));
    expect(factoryDataPath(identity)).toContain(identity.nodeId);
    expect(factoryNodeKey({ ...identity, factory: supportedRelease.factory })).toBe(factoryNodeKey(identity));
    expect(() => factoryNodeKey({ ...identity, nodeId: '0x1234' })).toThrow('bytes32');
    expect(() => factoryNodeKey({ ...identity, chainId: Number.MAX_SAFE_INTEGER + 1 })).toThrow('chain');
  });
  it('keeps unknown releases visible while strict reads require exact provenance', () => {
    const entries = parseFactoryReleaseSeeds({ releases: [release, { ...release, interfaceVersion: 'sooth-factory-v8' }, { ...release, sourceRevision: 'short' }] });
    expect(entries.map(entry => entry.supported)).toEqual([true, false, false]);
    expect(entries[1]!.release.interfaceVersion).toBe('sooth-factory-v8');
    expect(() => parseFactoryRelease({ ...release, interfaceVersion: 'sooth-factory-v8' })).toThrow('Unsupported');
    expect(() => parseFactoryRelease({ ...release, startBlock: -1 })).toThrow('start block');
    expect(() => parseFactoryRelease({ ...release, sourceRevision: 'short' })).toThrow('sourceRevision');
  });
  it('keeps future node labels in catalog records but refuses strict decoding', () => {
    const future = { ...node, interfaceVersion: 'sooth-factory-v8' };
    expect(parseFactoryCatalogNodeRecord(future).interfaceVersion).toBe('sooth-factory-v8');
    expect(() => parseFactoryNodeRecord(future)).toThrow('Unsupported');
    expect(() => parseFactoryNodeRecord({ ...node, contracts: { ...node.contracts, bookVault: undefined } })).toThrow('bookVault');
    expect(() => parseFactoryIndexedAt({ ...indexed, blockHash: '0x12' })).toThrow('bytes32');
  });
});

describe('Factory schema validation', () => {
  it('preserves optional indexer state without inventing older fields', () => {
    const market = parseFactoryMarketRecord(marketRecord);
    expect(market.state.amm).toMatchObject({ configVersion: 1, finalizedAs: null });
    expect(market.state.creationCall).toMatchObject({ embedded: false, input: null });
    expect(market.state.invalidationBuffer).toBe('604800');
    const { amm: _amm, book: _book, creationCall: _call, invalidationBuffer: _buffer, resolutionAttempted: _attempt, permissionlessAtCreation: _permissionless, ...older } = marketRecord.state;
    const old = parseFactoryMarketRecord({ ...marketRecord, state: older });
    expect('amm' in old.state).toBe(false);
    expect('creationCall' in old.state).toBe(false);
    expect(old.state.phase).toBe(market.state.phase);
    expect(() => parseFactoryMarketRecord({ ...marketRecord, state: { ...marketRecord.state, phase: 'unknown' } })).toThrow('state.phase');
    expect(() => parseFactoryMarketRecord({ ...marketRecord, state: { ...marketRecord.state, resolutionAttempted: 'no' } })).toThrow('resolutionAttempted');
  });
  it('retains fee versions, terms and extension state', () => {
    const state = { roles: {}, creation: { paused: false, permissionless: true, tokens: [], creators: [], adjudicators: [] }, extension: { value: 1 }, fees: { amm: { activeVersion: 1, versions: [{ version: 1, configHash: hash(2), publishedBlock: 100, terms: { feeBps: 100 } }] }, book: { activeVersion: null, versions: [] } } };
    const parsed = parseFactoryNodeState(state)!;
    expect(parsed.fees?.amm.versions[0]?.terms).toEqual({ feeBps: 100 });
    expect(parsed.extension).toEqual({ value: 1 });
    const { fees: _fees, ...older } = state;
    expect('fees' in parseFactoryNodeState(older)!).toBe(false);
    expect(() => parseFactoryNodeState({ ...state, fees: { ...state.fees, amm: { versions: 'invalid' } } })).toThrow('state.fees.amm.versions');
  });
  it('rejects malformed editorial wire fields without leaking a private actor', () => {
    expect(() => parseFactoryListing({ state: 'hidden' })).toThrow('listing.state');
    expect(() => parseFactoryListing({ ...listing, reason: 'x'.repeat(501) })).toThrow('500');
    expect(() => parseFactoryListing({ ...listing, at: 'yesterday' })).toThrow('ISO-8601');
    expect(() => parseFactoryListing({ ...listing, actor: 'private@example.org' })).toThrow('listing.actor');
    try { parseFactoryListing({ ...listing, actor: 'private@example.org' }); } catch (error) { expect(String(error)).not.toContain('private@example.org'); }
    expect(() => parseFactoryNodeMetadata({ endpoints: { appUrl: 'javascript:alert(1)' } })).toThrow('http');
    expect(() => parseFactoryNodeMetadata({ branding: { color: 'red' } })).toThrow('#rrggbb');
    expect(parseFactoryNodeMetadata(undefined).branding).toEqual({ iconUrl: null, color: null });
  });
  it('rejects duplicate normalized override identities and ignores document extensions', () => {
    const document = { schemaVersion: 1, revision: 'r1', nodes: [{ ...identity, metadata: { label: 'Example' } }], markets: [], extension: true };
    expect(parseFactoryCatalogOverrides(document).nodes[0]?.metadata.label).toBe('Example');
    expect('extension' in parseFactoryCatalogOverrides(document)).toBe(false);
    expect(() => parseFactoryCatalogOverrides({ ...document, nodes: [document.nodes[0], { ...document.nodes[0], factory: supportedRelease.factory }] })).toThrow('Duplicate');
    expect(() => parseFactoryCatalogOverrides({ ...document, revision: '' })).toThrow('revision');
    expect(() => parseFactoryCatalogOverrides({ ...document, schemaVersion: 2 })).toThrow('schema');
  });
});

describe('composed catalog wire validation', () => {
  it('preserves disabled market facts and both service-owned listing decisions', () => {
    const parsed = parseFactoryCatalogMarket(catalogMarket);
    expect(parsed.listing).toEqual(catalogMarket.listing);
    expect(parsed.listings).toEqual(catalogMarket.listings);
    expect(parsed.state).toEqual(parseFactoryMarketRecord(marketRecord).state);
    expect(parsed.canSettle).toBe(marketRecord.canSettle);
    expect(parsed.creation).toEqual(marketRecord.creation);
    expect(() => parseFactoryCatalogMarket({ ...catalogMarket, listings: { node: { state: 'unknown' }, market: null } })).toThrow('listing.state');
    expect(() => parseFactoryCatalogMarket({ ...catalogMarket, identity: { ...identity, chainId: 1 } })).toThrow('key');
  });
  it('binds release and interface to the node while preserving unsupported records', () => {
    expect(parseFactoryCatalogNode(catalogNode).release).toEqual(release);
    expect(() => parseFactoryCatalogNode({ ...catalogNode, release: { ...release, factory: address(99) } })).toThrow('release');
    expect(() => parseFactoryCatalogNode({ ...catalogNode, interface: { label: 'sooth-factory-v8', supported: true } })).toThrow('interface');
    expect(() => parseFactoryCatalogNode({ ...catalogNode, status: { verification: 'trusted', indexing: 'ready' } })).toThrow('verification');
    const future = parseFactoryCatalogNode({ ...catalogNode, node: { ...node, interfaceVersion: 'sooth-factory-v8' }, interface: { label: 'sooth-factory-v8', supported: false }, release: null });
    expect(future.interface).toEqual({ label: 'sooth-factory-v8', supported: false });
    expect(future.node.contracts).toEqual(node.contracts);
    expect(future.listing.state).toBe('disabled');
  });
});
