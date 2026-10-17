// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address, Hex, PublicClient, TransactionReceipt } from 'viem';
import type { ReactNode } from 'react';
import { readSoothMarket } from '../../src/react/runtime.js';
import type { SoothMarketData, SoothResolvedMarket, SoothRuntime } from '../../src/react/runtime.js';
import { SoothProvider, useSoothMarket, useSoothTransactionRecovery } from '../../src/react/hooks.js';
import { formatSoothMarketReference } from '../../src/react/embed.js';
import { loadSoothPending, reconcileSoothPending, removeSoothPending } from '../../src/react/wallet.js';
import type { SoothPendingTransaction, SoothWalletAdapter } from '../../src/react/wallet.js';
import { sendSoothAction } from '../../src/react/trading.js';
import { deriveNodeChildren } from '../../src/factory/factoryTrade/nodeChildren.js';
import { noteReceipt } from '../../src/factory/factoryTrade/afterReceipt.js';

vi.mock('../../src/react/runtime.js', () => ({ readSoothMarket: vi.fn() }));
vi.mock('../../src/react/wallet.js', () => ({
  getInjectedSoothWallet: vi.fn(() => null), loadSoothPending: vi.fn(),
  reconcileSoothPending: vi.fn(), removeSoothPending: vi.fn(),
}));
vi.mock('../../src/react/trading.js', () => ({ sendSoothAction: vi.fn() }));
vi.mock('../../src/factory/factoryTrade/afterReceipt.js', () => ({ noteReceipt: vi.fn() }));
vi.mock('../../src/factory/factoryReceipt.js', () => ({ decodeFactoryReceiptEvents: () => [] }));

const address = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Address;
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex;
const accountA = address(4), accountB = address(5);
const context = {
  chainId: 46630, factory: address(1), nodeId: hash(1),
  release: { chainId: 46630, factory: address(1), releaseId: hash(2), interfaceVersion: 'sooth-factory-v7.1', startBlock: 1 },
  contracts: { ...deriveNodeChildren(address(2)), deployer: address(2) }, startBlock: 1n, blockNumber: 10n,
};
function resolvedMarket(id: number): SoothResolvedMarket {
  return {
    reference: { ...context, releaseId: context.release.releaseId, market: address(id), venue: 'amm' },
    context, client: {} as PublicClient, endpoints: [],
    question: `Market ${id}`, rules: 'Rules', canonicalUrl: 'https://example.test/v1/market',
  } as SoothResolvedMarket;
}
function marketData(market: Address, account: Address, balance: bigint): SoothMarketData {
  return {
    snapshot: { market, blockNumber: 10n },
    token: { address: address(6), decimals: 6, symbol: 'TEST' },
    account: { address: account, balance, allowance: 0n },
  } as SoothMarketData;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadSoothPending).mockReturnValue([]);
  vi.mocked(reconcileSoothPending).mockResolvedValue({ status: 'pending' });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('Sooth market hook asynchronous state', () => {
  it('ignores a prior account response after the wallet account changes', async () => {
    const resolved = resolvedMarket(10);
    const runtime: SoothRuntime = { resolveNode: vi.fn(), resolve: vi.fn().mockResolvedValue(resolved) };
    const oldRead = deferred<SoothMarketData>();
    const current = marketData(resolved.reference.market, accountB, 22n);
    vi.mocked(readSoothMarket).mockImplementation((_market, account) => account === accountA ? oldRead.promise : Promise.resolve(current));
    const { result, rerender } = renderHook(({ account }) => useSoothMarket(resolved.reference, { runtime, account }), { initialProps: { account: accountA } });
    await waitFor(() => expect(readSoothMarket).toHaveBeenCalledWith(resolved, accountA));
    rerender({ account: accountB });
    await waitFor(() => expect(result.current.data).toBe(current));
    await act(async () => { oldRead.resolve(marketData(resolved.reference.market, accountA, 99n)); });
    expect(result.current.data).toBe(current);
    expect(result.current.data?.account?.address).toBe(accountB);
    expect(result.current.error).toBeNull();
  });

  it('ignores old market data when another market finishes loading first', async () => {
    const first = resolvedMarket(10), second = resolvedMarket(11);
    const runtime: SoothRuntime = { resolveNode: vi.fn(), resolve: vi.fn(async reference => {
      const market = typeof reference === 'string' ? reference : reference.market;
      return market === first.reference.market ? first : second;
    }) };
    const oldRead = deferred<SoothMarketData>();
    const current = marketData(second.reference.market, accountA, 22n);
    vi.mocked(readSoothMarket).mockImplementation(resolved => resolved === first ? oldRead.promise : Promise.resolve(current));
    const { result, rerender } = renderHook(({ market }) => useSoothMarket(market, { runtime, account: accountA }), { initialProps: { market: first.reference } });
    await waitFor(() => expect(readSoothMarket).toHaveBeenCalledWith(first, accountA));
    rerender({ market: second.reference });
    await waitFor(() => expect(result.current.data).toBe(current));
    await act(async () => { oldRead.resolve(marketData(first.reference.market, accountA, 99n)); });
    expect(result.current.resolved).toBe(second);
    expect(result.current.data).toBe(current);
    expect(result.current.loading).toBe(false);
  });

  it('preserves the last market read with an explicit polling error, then clears the error on recovery', async () => {
    vi.useFakeTimers();
    const resolved = resolvedMarket(10);
    const runtime: SoothRuntime = { resolveNode: vi.fn(), resolve: vi.fn().mockResolvedValue(resolved) };
    const previous = marketData(resolved.reference.market, accountA, 12n);
    const recovered = marketData(resolved.reference.market, accountA, 15n);
    vi.mocked(readSoothMarket).mockResolvedValueOnce(previous).mockRejectedValueOnce(new Error('RPC unavailable')).mockResolvedValue(recovered);
    const { result } = renderHook(() => useSoothMarket(resolved.reference, { runtime, account: accountA, refreshInterval: 1_000 }));
    await act(async () => { await Promise.resolve(); });
    expect(result.current.data).toBe(previous);
    const updatedAt = result.current.updatedAt;
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(result.current.data).toBe(previous);
    expect(result.current.error).toBe('RPC unavailable');
    expect(result.current.updatedAt).toBe(updatedAt);
    expect(result.current.loading).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(result.current.data).toBe(recovered);
    expect(result.current.error).toBeNull();
  });
});

describe('Sooth pending transaction recovery', () => {
  it('retains account identities and recovers receipts without connecting or sending another action', async () => {
    vi.useFakeTimers();
    const resolved = resolvedMarket(10);
    const market = formatSoothMarketReference(resolved.reference);
    const pendingA: SoothPendingTransaction = {
      version: 1, market, account: accountA, chainId: 46630, hash: hash(20),
      to: context.contracts.amm, data: '0x1234', submittedAt: 1, label: 'Buy YES shares',
    };
    const pendingB = { ...pendingA, account: accountB, hash: hash(21) };
    vi.mocked(loadSoothPending).mockReturnValue([pendingA, pendingB]);
    const wallet: SoothWalletAdapter = {
      connect: vi.fn(), getSession: vi.fn(), switchChain: vi.fn(), sendTransaction: vi.fn(),
    };
    const wrapper = ({ children }: { children: ReactNode }) => <SoothProvider wallet={wallet}>{children}</SoothProvider>;
    const onEvent = vi.fn(), onConfirmed = vi.fn();
    const { result } = renderHook(() => useSoothTransactionRecovery(resolved, onEvent, onConfirmed), { wrapper });
    await act(async () => { await Promise.resolve(); });
    expect(loadSoothPending).toHaveBeenCalledWith(market);
    expect(result.current.pending.filter(record => record.account === accountA)).toEqual([pendingA]);
    expect(result.current.pending.filter(record => record.account === accountB)).toEqual([pendingB]);
    expect(removeSoothPending).not.toHaveBeenCalled();

    const receipt = { blockNumber: 25n } as TransactionReceipt;
    vi.mocked(reconcileSoothPending).mockImplementation(async (_client, record) => record.account === accountA ? { status: 'confirmed', receipt } : { status: 'pending' });
    await act(async () => { await vi.advanceTimersByTimeAsync(4_000); });
    expect(result.current.pending).toEqual([pendingB]);
    expect(removeSoothPending).toHaveBeenCalledWith(market, pendingA.hash);
    expect(noteReceipt).toHaveBeenCalledWith(context, 25n);
    expect(onEvent).toHaveBeenCalledWith({ type: 'transaction-confirmed', hash: pendingA.hash, chainId: 46630 });

    vi.mocked(reconcileSoothPending).mockResolvedValue({ status: 'failed', receipt });
    await act(async () => { await vi.advanceTimersByTimeAsync(4_000); });
    expect(result.current.pending).toEqual([]);
    expect(result.current.result).toContain('No automatic retry was made');
    expect(onEvent).toHaveBeenCalledWith({ type: 'transaction-failed', hash: pendingB.hash, chainId: 46630 });
    expect(onConfirmed).toHaveBeenCalledTimes(2);
    expect(sendSoothAction).not.toHaveBeenCalled();
    expect(wallet.connect).not.toHaveBeenCalled();
    expect(wallet.switchChain).not.toHaveBeenCalled();
    expect(wallet.sendTransaction).not.toHaveBeenCalled();
  });
});
