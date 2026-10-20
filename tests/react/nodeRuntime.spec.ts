import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address, Hash } from 'viem';
import { createSoothRuntime, type SoothRuntimeConfiguration } from '../../src/react/runtime.js';
import { verifyFactoryNode, assertMarketBinding } from '../../src/factory/factoryClient.js';
import { fetchFactoryCatalogMarkets, fetchFactoryCatalogNodes } from '../../src/factory/factoryCatalog.js';
import type { FactoryNodeContext } from '../../src/factory/factoryClient.js';
import type { FactoryCatalogSnapshot } from '../../src/factory/factoryCatalog.js';
import type { FactoryCatalogMarket, FactoryCatalogNode } from '../../src/factory/schema.js';

vi.mock('../../src/factory/factoryClient.js', () => ({ verifyFactoryNode: vi.fn(), assertMarketBinding: vi.fn() }));
vi.mock('../../src/factory/factoryCatalog.js', () => ({ fetchFactoryCatalogMarkets: vi.fn(), fetchFactoryCatalogNodes: vi.fn() }));
const address = (digit: string) => `0x${digit.repeat(40)}` as Address;
const hash = (digit: string) => `0x${digit.repeat(64)}` as Hash;
const reference = { chainId: 46630, factory: address('1'), nodeId: hash('2'), releaseId: hash('3') };
const configuration: SoothRuntimeConfiguration = {
  chains: [{ id: 46630, name: 'Test', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://one.test', 'https://two.test'] }],
  releases: [{ ...reference, interfaceVersion: 'sooth-factory-v7.1', sourceRevision: 'test', artifactRevision: 'test', sdkAbiHash: hash('4'), releaseManifestHash: hash('5'), startBlock: 1 }],
  canonicalOrigin: 'https://host.test', catalogUrl: 'https://catalog.test',
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(fetchFactoryCatalogNodes).mockResolvedValue({ items: [{ node: { ...reference, contracts: { deployer: address('6') } }, interface: { supported: true } }] } as unknown as FactoryCatalogSnapshot<FactoryCatalogNode>);
  vi.mocked(fetchFactoryCatalogMarkets).mockResolvedValue({ items: [] } as unknown as FactoryCatalogSnapshot<FactoryCatalogMarket>);
  vi.mocked(verifyFactoryNode).mockResolvedValue({ ...reference, release: configuration.releases[0] } as FactoryNodeContext);
});
describe('trusted node runtime', () => {
  it('authenticates the node without requiring a market or loading individual market snapshots', async () => {
    const runtime = createSoothRuntime(configuration);
    const node = await runtime.resolveNode(reference);
    expect(node.reference).toEqual(reference);
    expect(node.catalog.items).toEqual([]);
    expect(verifyFactoryNode).toHaveBeenCalledOnce();
    expect(verifyFactoryNode).toHaveBeenCalledWith(expect.objectContaining({ identity: reference, release: configuration.releases[0], catalog: { deployer: address('6') } }));
    expect(assertMarketBinding).not.toHaveBeenCalled();
    await node.refreshCatalog();
    expect(fetchFactoryCatalogMarkets).toHaveBeenLastCalledWith(reference, { baseUrl: 'https://catalog.test/' });
  });
  it('rejects releases outside host configuration before fetching remote catalogs', async () => {
    await expect(createSoothRuntime(configuration).resolveNode({ ...reference, releaseId: hash('9') })).rejects.toThrow('not supported');
    expect(fetchFactoryCatalogNodes).not.toHaveBeenCalled();
    expect(verifyFactoryNode).not.toHaveBeenCalled();
  });
  it('rejects an indexer node that reports another release', async () => {
    vi.mocked(fetchFactoryCatalogNodes).mockResolvedValue({ items: [{ node: { ...reference, releaseId: hash('9') }, interface: { supported: true } }] } as unknown as FactoryCatalogSnapshot<FactoryCatalogNode>);
    await expect(createSoothRuntime(configuration).resolveNode(reference)).rejects.toThrow('does not match');
    expect(verifyFactoryNode).not.toHaveBeenCalled();
  });
  it('exposes only the trusted indexer URL from host configuration', async () => {
    expect((await createSoothRuntime(configuration).resolveNode(reference)).indexer).toBeNull();
    const node = await createSoothRuntime({ ...configuration, indexerUrl: 'https://indexer.test' }).resolveNode(reference);
    expect(node.indexer).toEqual({ baseUrl: 'https://indexer.test/' });
    expect(() => createSoothRuntime({ ...configuration, indexerUrl: 'not a url' })).toThrow();
  });
  it('propagates authenticated binding failures instead of displaying unverified catalogs', async () => {
    vi.mocked(verifyFactoryNode).mockRejectedValue(new Error('Independent endpoints disagree'));
    await expect(createSoothRuntime(configuration).resolveNode(reference)).rejects.toThrow('Independent endpoints disagree');
  });
});
