import { supportedRelease } from './fixtures/release.js';
import { describe, expect, it, vi } from 'vitest';
import type { Address, Hex, PublicClient } from 'viem';
import {
  discoverFactoryLpPositions,
  factoryMarketScope,
  factoryReadClient,
  factoryReadMemo,
  type BindingRead,
  type FactoryNodeContext,
  type FactoryReadClient,
} from '../../src/factory/factoryClient.js';
import { deriveNodeChildren } from '../../src/factory/factoryTrade.js';

const addr = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Address;
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex;
const release = { ...supportedRelease, startBlock: 10 };
const deployer = addr(2), market = addr(3), account = addr(4), otherMarket = addr(9);
const contracts = { ...deriveNodeChildren(deployer), deployer };
const context: FactoryNodeContext = { chainId: release.chainId, factory: release.factory, nodeId: hash(1), release, contracts, startBlock: 10n, blockNumber: 100n };

/** A viem-shaped client whose answers come from `answer`; every call is counted. */
function viemClient(answer: (call: BindingRead) => unknown) {
  const fake = {
    getChainId: vi.fn(async () => release.chainId),
    getBlockNumber: vi.fn(async () => 100n),
    readContract: vi.fn(async (call: BindingRead) => answer(call)),
  };
  return { fake, client: fake as unknown as PublicClient };
}
const named = (fake: { readContract: { mock: { calls: [BindingRead][] } } }, name: string) =>
  fake.readContract.mock.calls.filter(([call]) => call.functionName === name);

describe('factoryReadClient memo', () => {
  it('returns one adapter per viem client and asks its chain id once', async () => {
    const { fake, client } = viemClient(() => null);
    const a = factoryReadClient(client);
    expect(factoryReadClient(client)).toBe(a);
    await a.getChainId();
    await a.getChainId();
    expect(fake.getChainId).toHaveBeenCalledTimes(1);
    expect(factoryReadMemo(a)).toBeDefined();
  });
  it('asks the chain id again after a failed ask', async () => {
    const { fake, client } = viemClient(() => null);
    fake.getChainId.mockRejectedValueOnce(new Error('dropped'));
    const a = factoryReadClient(client);
    await expect(a.getChainId()).rejects.toThrow('dropped');
    await expect(a.getChainId()).resolves.toBe(release.chainId);
    expect(fake.getChainId).toHaveBeenCalledTimes(2);
  });
});

describe('factoryMarketScope binding memo', () => {
  it('reads marketFactory once per market and client after it matched', async () => {
    const { fake, client } = viemClient((call) => (call.functionName === 'marketFactory' ? contracts.marketFactory : null));
    const reader = factoryReadClient(client);
    await factoryMarketScope({ context, client: reader, market });
    await factoryMarketScope({ context, client: reader, market });
    expect(named(fake, 'marketFactory')).toHaveLength(1);
    // Another market is checked on its own.
    await factoryMarketScope({ context, client: reader, market: otherMarket });
    expect(named(fake, 'marketFactory')).toHaveLength(2);
  });
  it('never keeps a market that belongs to another node', async () => {
    const { fake, client } = viemClient((call) => (call.functionName === 'marketFactory' ? addr(77) : null));
    const reader = factoryReadClient(client);
    await expect(factoryMarketScope({ context, client: reader, market })).rejects.toThrow('Market belongs to another node');
    await expect(factoryMarketScope({ context, client: reader, market })).rejects.toThrow('Market belongs to another node');
    expect(named(fake, 'marketFactory')).toHaveLength(2);
  });
  it('checks every time for a reader without the memo', async () => {
    const readContract = vi.fn(async (call: BindingRead) => (call.functionName === 'marketFactory' ? contracts.marketFactory : null));
    const reader: FactoryReadClient = { getChainId: async () => release.chainId, getBlockNumber: async () => 100n, readContract };
    await factoryMarketScope({ context, client: reader, market });
    await factoryMarketScope({ context, client: reader, market });
    expect(readContract.mock.calls.filter(([call]) => call.functionName === 'marketFactory')).toHaveLength(2);
  });
});

describe('LP receipt discovery', () => {
  // Receipts 1 and 3 are this market's; 2 and 4 belong to another market.
  const answer = (call: BindingRead): unknown => {
    switch (call.functionName) {
      case 'marketFactory': return contracts.marketFactory;
      case 'nextPositionId': return 5n;
      case 'positionMarket': return call.args![0] === 1n || call.args![0] === 3n ? market : otherMarket;
      case 'balanceOf': return call.args![1] === 1n ? 0n : 5n;
      case 'totalSupply': return 10n;
      case 'residual': return 20n;
      default: throw new Error(`Unexpected read ${call.functionName}`);
    }
  };
  it('reads balances only for the requested market and keeps receipt markets between polls', async () => {
    const { fake, client } = viemClient(answer);
    const reader = factoryReadClient(client);
    const first = await discoverFactoryLpPositions({ context, client: reader, account, market });
    expect(first.positions.map((p) => p.positionId)).toEqual([3n]);
    expect(named(fake, 'positionMarket')).toHaveLength(4);
    expect(named(fake, 'balanceOf').map(([call]) => call.args![1])).toEqual([1n, 3n]);
    const second = await discoverFactoryLpPositions({ context, client: reader, account, market });
    expect(second.positions).toEqual(first.positions);
    expect(named(fake, 'positionMarket')).toHaveLength(4); // no new reads: markets never change
    expect(named(fake, 'balanceOf')).toHaveLength(4); // balances are read again every poll
  });
  it('gives the same receipts with and without the memo, across all markets', async () => {
    const { client } = viemClient(answer);
    const plain: FactoryReadClient = { getChainId: async () => release.chainId, getBlockNumber: async () => 100n, readContract: vi.fn(async (call: BindingRead) => answer(call)) };
    const withMemo = await discoverFactoryLpPositions({ context, client: factoryReadClient(client), account });
    const without = await discoverFactoryLpPositions({ context, client: plain, account });
    expect(withMemo.positions.map((p) => [p.positionId, p.market])).toEqual([[2n, otherMarket], [3n, market], [4n, otherMarket]]);
    expect(withMemo.positions).toEqual(without.positions);
  });
  it('does not keep an unset receipt market', async () => {
    const { fake, client } = viemClient((call) => (call.functionName === 'positionMarket' ? addr(0) : call.functionName === 'balanceOf' ? 0n : answer(call)));
    const reader = factoryReadClient(client);
    await discoverFactoryLpPositions({ context, client: reader, account });
    await discoverFactoryLpPositions({ context, client: reader, account });
    expect(named(fake, 'positionMarket')).toHaveLength(8);
  });
});
