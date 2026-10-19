import { useCallback, useEffect, useRef, useState } from 'react';
import type { Address } from 'viem';
import {
  quoteSoothTrade,
  readSoothDepth,
  readSoothLiquidity,
  readSoothMarketSummary,
  readSoothNodeMarkets,
  readSoothPriceHistory,
  type SoothChartInterval,
  type SoothDepth,
  type SoothLiquidity,
  type SoothLiveQuote,
  type SoothMarketSummary,
  type SoothPriceHistory,
} from './data.js';
import { formatSoothMarketReference } from './embed.js';
import { describeSoothError } from './errors.js';
import { formatSoothNodeReference } from './node.js';
import type { SoothResolvedMarket, SoothResolvedNode } from './runtime.js';
import type { SoothTradeIntent } from './trading.js';

export interface SoothDataState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

interface SoothReadState<T> {
  key: string | null;
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * One read per key. Data belongs to the key it was read for, so a new key never shows an
 * older result, even before its first read settles. Polling keeps the last data on failure
 * and stops on unmount. State is per hook instance.
 */
function useSoothRead<T>(
  key: string | null,
  read: () => Promise<T>,
  options: { interval?: number; debounceMs?: number } = {},
): SoothDataState<T> {
  const [state, setState] = useState<SoothReadState<T>>({
    key: null,
    data: null,
    error: null,
    loading: false,
  });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const latest = useRef(read);
  latest.current = read;
  const generation = useRef(0);
  const { interval, debounceMs = 0 } = options;
  useEffect(() => {
    const current = ++generation.current;
    if (key === null) {
      setState({ key, data: null, error: null, loading: false });
      return;
    }
    setState((previous) =>
      previous.key === key
        ? { ...previous, loading: true }
        : { key, data: null, error: null, loading: true },
    );
    let inFlight = false;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const data = await latest.current();
        if (generation.current === current) setState({ key, data, error: null, loading: false });
      } catch (reason) {
        if (generation.current === current)
          setState((previous) => ({
            ...previous,
            error: describeSoothError(reason),
            loading: false,
          }));
      } finally {
        inFlight = false;
      }
    };
    const start = setTimeout(() => void load(), debounceMs);
    const timer = interval ? setInterval(() => void load(), interval) : undefined;
    return () => {
      generation.current++;
      clearTimeout(start);
      clearInterval(timer);
    };
  }, [key, revision, interval, debounceMs]);
  const fresh = state.key === key;
  return {
    data: fresh ? state.data : null,
    error: fresh ? state.error : null,
    loading: key !== null && (!fresh || state.loading),
    refresh,
  };
}

export function useSoothPriceHistory(
  resolved: SoothResolvedMarket | null,
  range: SoothChartInterval,
): SoothDataState<SoothPriceHistory> {
  return useSoothRead(
    resolved ? `${formatSoothMarketReference(resolved.reference)}:${range}` : null,
    () => readSoothPriceHistory(resolved!, range),
    { interval: 30_000 },
  );
}

export function useSoothDepth(
  resolved: SoothResolvedMarket | null,
  options: { enabled?: boolean } = {},
): SoothDataState<SoothDepth> {
  return useSoothRead(
    resolved && options.enabled !== false ? formatSoothMarketReference(resolved.reference) : null,
    () => readSoothDepth(resolved!),
    { interval: 15_000 },
  );
}

/** Debounced while typing; a result for an older intent is never shown. */
export function useSoothLiveQuote(
  resolved: SoothResolvedMarket | null,
  intent: SoothTradeIntent | null,
): SoothDataState<SoothLiveQuote> {
  return useSoothRead(
    resolved && intent
      ? `${formatSoothMarketReference(resolved.reference)}:${intent.side}:${intent.outcome}:${intent.shares}:${intent.price}`
      : null,
    () => quoteSoothTrade(resolved!, intent!),
    { debounceMs: 300 },
  );
}

export function useSoothLiquidity(
  resolved: SoothResolvedMarket | null,
  account: Address | null | undefined,
): SoothDataState<SoothLiquidity> {
  return useSoothRead(
    resolved && account
      ? `${formatSoothMarketReference(resolved.reference)}:${account.toLowerCase()}`
      : null,
    () => readSoothLiquidity(resolved!, account!),
  );
}

export function useSoothNodeMarkets(
  resolvedNode: SoothResolvedNode | null,
  addresses: readonly Address[],
): SoothDataState<Map<Address, SoothMarketSummary>> {
  return useSoothRead(
    resolvedNode && addresses.length > 0
      ? `${formatSoothNodeReference(resolvedNode.reference)}:${addresses.join(',').toLowerCase()}`
      : null,
    () => readSoothNodeMarkets(resolvedNode!, addresses),
    { interval: 30_000 },
  );
}

export function useSoothMarketSummary(
  resolved: SoothResolvedMarket | null,
): SoothDataState<SoothMarketSummary> {
  return useSoothRead(
    resolved ? formatSoothMarketReference(resolved.reference) : null,
    () => readSoothMarketSummary(resolved!),
    { interval: 30_000 },
  );
}
