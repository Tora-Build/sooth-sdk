// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address, Hex, PublicClient } from 'viem';
import { quoteSoothTrade, readSoothDepth, type SoothDepth, type SoothLiveQuote } from '../../src/react/data.js';
import { useSoothDepth, useSoothLiveQuote } from '../../src/react/dataHooks.js';
import type { SoothResolvedMarket } from '../../src/react/runtime.js';
import type { SoothTradeIntent } from '../../src/react/trading.js';

vi.mock('../../src/react/data.js', () => ({ quoteSoothTrade: vi.fn(), readSoothDepth: vi.fn() }));

const address = (n: number) => `0x${n.toString(16).padStart(40, '0')}` as Address;
const hash = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex;
const resolved = {
  reference: { chainId: 46630, factory: address(1), nodeId: hash(1), releaseId: hash(2), market: address(3), venue: 'amm' },
  client: {} as PublicClient, indexer: null,
} as unknown as SoothResolvedMarket;
const intent = (shares: string): SoothTradeIntent => ({ side: 'buy', outcome: 1, shares, price: '' });
const quote = (shares: bigint) => ({ shares }) as SoothLiveQuote;
const depth = (blockNumber: bigint) => ({ bids: [], asks: [], complete: true, source: 'rpc', blockNumber }) as SoothDepth;
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('live quote hook', () => {
  it('debounces typing into one read of the final intent', async () => {
    vi.mocked(quoteSoothTrade).mockResolvedValue(quote(3n));
    const view = renderHook(({ value }) => useSoothLiveQuote(resolved, value), { initialProps: { value: intent('1') } });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    view.rerender({ value: intent('12') });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    view.rerender({ value: intent('123') });
    expect(quoteSoothTrade).not.toHaveBeenCalled();
    expect(view.result.current.loading).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(quoteSoothTrade).toHaveBeenCalledOnce();
    expect(quoteSoothTrade).toHaveBeenCalledWith(resolved, intent('123'));
    expect(view.result.current).toMatchObject({ data: quote(3n), error: null, loading: false });
  });
  it('discards a slower result for an older intent and never shows it for the new one', async () => {
    const first = deferred<SoothLiveQuote>();
    const second = deferred<SoothLiveQuote>();
    vi.mocked(quoteSoothTrade).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const view = renderHook(({ value }) => useSoothLiveQuote(resolved, value), { initialProps: { value: intent('1') } });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    view.rerender({ value: intent('2') });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    await act(async () => { second.resolve(quote(2n)); });
    expect(view.result.current.data).toEqual(quote(2n));
    await act(async () => { first.resolve(quote(1n)); });
    expect(view.result.current.data).toEqual(quote(2n));
    view.rerender({ value: intent('3') });
    expect(view.result.current).toMatchObject({ data: null, loading: true });
  });
  it('refreshes unchanged inputs every market interval, preserves the last quote on failure, and stops on unmount', async () => {
    const first = { ...quote(1n), amountNative: 1_000_000n };
    const moved = { ...quote(1n), amountNative: 1_200_000n };
    vi.mocked(quoteSoothTrade)
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce(moved)
      .mockRejectedValueOnce(new Error('RPC unavailable'))
      .mockResolvedValue(first);
    const view = renderHook(() => useSoothLiveQuote(resolved, intent('1')));
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(view.result.current.data).toEqual(first);
    await act(async () => { await vi.advanceTimersByTimeAsync(14_700); });
    expect(view.result.current).toMatchObject({ data: moved, error: null, loading: false });
    expect(quoteSoothTrade).toHaveBeenLastCalledWith(resolved, intent('1'));
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(view.result.current).toMatchObject({ data: moved, error: 'RPC unavailable', loading: false });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(view.result.current).toMatchObject({ data: first, error: null, loading: false });
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(quoteSoothTrade).toHaveBeenCalledTimes(4);
  });
  it('recovers an initial quote error on the next market interval without changing inputs', async () => {
    vi.mocked(quoteSoothTrade)
      .mockRejectedValueOnce(new Error('RPC unavailable'))
      .mockResolvedValue(quote(1n));
    const view = renderHook(() => useSoothLiveQuote(resolved, intent('1')));
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(view.result.current).toMatchObject({ data: null, error: 'RPC unavailable', loading: false });
    await act(async () => { await vi.advanceTimersByTimeAsync(14_700); });
    expect(view.result.current).toMatchObject({ data: quote(1n), error: null, loading: false });
    expect(quoteSoothTrade).toHaveBeenCalledTimes(2);
  });
  it('debounces a new intent at a polling boundary and discards an older poll response', async () => {
    const oldPoll = deferred<SoothLiveQuote>();
    vi.mocked(quoteSoothTrade)
      .mockResolvedValueOnce(quote(1n))
      .mockReturnValueOnce(oldPoll.promise)
      .mockResolvedValue(quote(2n));
    const view = renderHook(({ value }) => useSoothLiveQuote(resolved, value), { initialProps: { value: intent('1') } });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(quoteSoothTrade).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(14_900); });
    view.rerender({ value: intent('2') });
    expect(view.result.current).toMatchObject({ data: null, loading: true });
    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    expect(quoteSoothTrade).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(view.result.current.data).toEqual(quote(2n));
    await act(async () => { oldPoll.resolve(quote(1n)); });
    expect(view.result.current.data).toEqual(quote(2n));
    expect(quoteSoothTrade).toHaveBeenLastCalledWith(resolved, intent('2'));
  });
  it('keeps quote polling single-flight and stops when the intent is cleared', async () => {
    const poll = deferred<SoothLiveQuote>();
    vi.mocked(quoteSoothTrade).mockResolvedValueOnce(quote(1n)).mockReturnValue(poll.promise);
    const view = renderHook(({ value }) => useSoothLiveQuote(resolved, value), {
      initialProps: { value: intent('1') as SoothTradeIntent | null },
    });
    await act(async () => { await vi.advanceTimersByTimeAsync(45_000); });
    expect(quoteSoothTrade).toHaveBeenCalledTimes(2);
    view.rerender({ value: null });
    await act(async () => { poll.resolve(quote(2n)); });
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(view.result.current).toMatchObject({ data: null, error: null, loading: false });
    expect(quoteSoothTrade).toHaveBeenCalledTimes(2);
  });
  it('stays idle without an intent', () => {
    const view = renderHook(() => useSoothLiveQuote(resolved, null));
    expect(view.result.current).toMatchObject({ data: null, error: null, loading: false });
    expect(quoteSoothTrade).not.toHaveBeenCalled();
  });
});

describe('depth hook', () => {
  it('polls while mounted, keeps the last depth on a failed poll, and stops on unmount', async () => {
    vi.mocked(readSoothDepth).mockResolvedValueOnce(depth(1n)).mockRejectedValueOnce(new Error('RPC unavailable')).mockResolvedValue(depth(3n));
    const view = renderHook(() => useSoothDepth(resolved));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(view.result.current.data?.blockNumber).toBe(1n);
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(view.result.current).toMatchObject({ data: depth(1n), error: 'RPC unavailable' });
    await act(async () => { await vi.advanceTimersByTimeAsync(15_000); });
    expect(view.result.current).toMatchObject({ data: depth(3n), error: null });
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(readSoothDepth).toHaveBeenCalledTimes(3);
  });
  it('does not read while disabled', async () => {
    renderHook(() => useSoothDepth(resolved, { enabled: false }));
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(readSoothDepth).not.toHaveBeenCalled();
  });
});
