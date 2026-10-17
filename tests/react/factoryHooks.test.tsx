// @vitest-environment jsdom
import React from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as factoryClient from '../../src/factory/factoryClient.js';
import type { Address, Hex } from 'viem';
import type { FactoryNodeContext, FactoryReadClient, FactoryCatalogSnapshot, FactoryCatalogMarket, FactoryCatalogNode } from '../../src/factory/factoryClient.js';
import { deriveNodeChildren, forgetReceipt } from '../../src/factory/factoryTrade.js';
import { useFactoryPositions, useFactoryLpPositions, useRefreshFactory, factoryQueryKey, useFactoryCatalogMarkets, useFactoryCatalogNodes } from '../../src/react/factoryHooks.js';
import { SUPPORTED_FACTORY_RELEASES } from '../../src/factory/releases.js';
const address = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Address;
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex;
const context: FactoryNodeContext = {
  chainId: 46630, factory: address(1), nodeId: hash(1),
  release: { ...SUPPORTED_FACTORY_RELEASES[1], factory: address(1), startBlock: 1 },
  contracts: { ...deriveNodeChildren(address(2)), deployer: address(2) }, startBlock: 1n, blockNumber: 10n,
};
const market = address(3), account = address(4);
function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  const client: FactoryReadClient = {
    getChainId: async () => 46630, getBlockNumber: async () => 10n,
    readContract: vi.fn(async call => call.functionName === 'marketFactory' ? context.contracts.marketFactory : [2n, 3n]),
  };
  return { queryClient, wrapper, client };
}
describe('Factory injected read hooks', () => {
  it('discovers arrivals in an initially empty catalog without remount or focus', async () => {
    const markets = vi.spyOn(factoryClient, 'fetchFactoryCatalogMarkets');
    const nodes = vi.spyOn(factoryClient, 'fetchFactoryCatalogNodes');
    const empty = { items: [], next: null, catalogRevision: '1', receivedAt: Date.now(),
      facts: { source: 'live' as const, ageSeconds: 0 }, overrides: { source: 'live' as const, ageSeconds: 0, revision: '1' },
      indexed: { blockNumber: 10, blockHash: hash(10), timestamp: 10 } };
    const arrived = { ...empty, items: [{ key: 'new-market' }] };
    markets.mockResolvedValueOnce(empty as FactoryCatalogSnapshot<FactoryCatalogMarket>)
      .mockResolvedValue(arrived as FactoryCatalogSnapshot<FactoryCatalogMarket>);
    nodes.mockResolvedValueOnce(empty as FactoryCatalogSnapshot<FactoryCatalogNode>)
      .mockResolvedValue({ ...empty, items: [{ key: 'new-node' }] } as FactoryCatalogSnapshot<FactoryCatalogNode>);
    const { wrapper, queryClient } = setup();
    vi.useFakeTimers();
    try {
      const { result, unmount } = renderHook(() => ({
        markets: useFactoryCatalogMarkets({ identity: context, options: { baseUrl: 'https://catalog.example' } }),
        nodes: useFactoryCatalogNodes({ chainId: context.chainId, factory: context.factory, options: { baseUrl: 'https://catalog.example' } }),
      }), { wrapper });
      await act(async () => { await vi.advanceTimersByTimeAsync(1); });
      expect(result.current.markets.data?.items).toEqual([]);
      expect(result.current.nodes.data?.items).toEqual([]);
      await act(async () => { await vi.advanceTimersByTimeAsync(15_001); });
      expect(result.current.markets.data?.items).toEqual(arrived.items);
      expect(result.current.nodes.data?.items).toEqual([{ key: 'new-node' }]);
      unmount();
    } finally {
      queryClient.clear(); vi.useRealTimers(); markets.mockRestore(); nodes.mockRestore();
    }
  });
  it('refreshes derived position and LP values immediately while isolating another release', async () => {
    const { wrapper, queryClient } = setup();
    const readPositions = vi.fn(async () => 1);
    const readLp = vi.fn(async () => 2);
    const readOther = vi.fn(async () => 3);
    const other = { ...context, release: { ...context.release, releaseId: hash(99) } };
    const { result, unmount } = renderHook(() => {
      useQuery({ queryKey: [...factoryQueryKey(context, 'portfolio-positions'), account], queryFn: readPositions, staleTime: Infinity });
      useQuery({ queryKey: [...factoryQueryKey(context, 'lp-values'), account], queryFn: readLp, staleTime: Infinity });
      useQuery({ queryKey: factoryQueryKey(other, 'lp-values'), queryFn: readOther, staleTime: Infinity });
      return useRefreshFactory(context);
    }, { wrapper });
    await waitFor(() => expect(readLp).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(readOther).toHaveBeenCalledTimes(1));
    await act(() => result.current(20n));
    expect(readPositions).toHaveBeenCalledTimes(2);
    expect(readLp).toHaveBeenCalledTimes(2);
    expect(readOther).toHaveBeenCalledTimes(1);
    unmount(); forgetReceipt(context); queryClient.clear();
  });
  it('passes LP scan bounds and refetches when the bound changes', async () => {
    const { wrapper, client } = setup();
    client.readContract = vi.fn(async call => {
      switch (call.functionName) {
        case 'marketFactory': return context.contracts.marketFactory;
        case 'nextPositionId': return 2n;
        case 'positionMarket': return market;
        case 'balanceOf': return 25n;
        case 'totalSupply': return 50n;
        case 'residual': return 200n;
        default: throw new Error(call.functionName);
      }
    });
    const getLogs = vi.fn(async () => [{ args: { market, positionId: 1n, deposit: 100n } }]);
    const eventClient = { ...client, getLogs };
    const { result, rerender } = renderHook(({ fromBlock }) => useFactoryLpPositions({ context, client: eventClient, market, account, fromBlock, refetchInterval: false }), { wrapper, initialProps: { fromBlock: 5n } });
    await waitFor(() => expect(result.current.data?.positions[0]?.valuationComplete).toBe(true));
    expect(getLogs).toHaveBeenLastCalledWith(expect.objectContaining({ fromBlock: 5n, toBlock: 10n }));
    rerender({ fromBlock: 8n });
    await waitFor(() => expect(getLogs).toHaveBeenLastCalledWith(expect.objectContaining({ fromBlock: 8n, toBlock: 10n })));
  });
  it('reads a position without any wallet framework', async () => {
    const { wrapper, client } = setup();
    const { result } = renderHook(() => useFactoryPositions({ context, client, markets: [market], account, refetchInterval: false }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.positions).toEqual([{ market, account, yes: 2n, no: 3n, blockNumber: 10n }]);
  });
  it('leaves disconnected queries disabled without inventing an empty portfolio', async () => {
    const { wrapper, client } = setup();
    const { result } = renderHook(() => useFactoryPositions({ context, client, markets: [market], refetchInterval: false }), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(result.current.data).toBeUndefined();
    expect(client.readContract).not.toHaveBeenCalled();
  });
  it('exposes transport failures instead of zero holdings', async () => {
    const { wrapper, client } = setup();
    client.readContract = vi.fn(async () => { throw new Error('RPC missing block'); });
    const { result } = renderHook(() => useFactoryPositions({ context, client, markets: [market], account, refetchInterval: false }), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('RPC missing block');
    expect(result.current.data).toBeUndefined();
  });
  it('pins post-receipt reads and isolates full node and release query keys', async () => {
    const { wrapper, client, queryClient } = setup();
    const { result } = renderHook(() => {
      const positions = useFactoryPositions({ context, client, markets: [market], account, refetchInterval: false });
      return { data: positions.data, isSuccess: positions.isSuccess, refresh: useRefreshFactory(context) };
    }, { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(() => result.current.refresh(20n));
    await waitFor(() => expect(result.current.data?.blockNumber).toBe(20n));
    const calls = vi.mocked(client.readContract).mock.calls;
    expect(calls.some(([call]) => call.blockNumber === 20n)).toBe(true);
    expect(factoryQueryKey(context)).not.toEqual(factoryQueryKey({ ...context, factory: address(99) }));
    expect(factoryQueryKey(context)).not.toEqual(factoryQueryKey({ ...context, nodeId: hash(99) }));
    expect(factoryQueryKey(context)).not.toEqual(factoryQueryKey({ ...context, release: { ...context.release, releaseId: hash(99) } }));
    forgetReceipt(context); queryClient.clear();
  });
});
